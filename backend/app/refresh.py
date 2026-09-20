"""Cycle de rafraîchissement : interroge YouTube pour chaque chaîne suivie,
recalcule les outliers et journalise les nouveaux."""

from __future__ import annotations

import datetime as dt
import logging

from sqlalchemy.orm import Session

from .config import settings
from .models import Channel, Video, VideoSnapshot
from .outliers import compute_outliers
from .youtube_client import YouTubeClient, YouTubeAPIError

logger = logging.getLogger("outlier_bot.refresh")

# Conformité "YouTube API Services - Developer Policies" (section III.E.4.d) :
# les données non authentifiées (Non-Authorized Data, ce que nous récupérons
# via une simple clé API) ne doivent pas être conservées plus de 30 jours
# sans être rafraîchies. Le cycle de 2h rafraîchit déjà les stats vidéo bien
# avant ce délai ; on purge en plus l'historique de vues au-delà de 30 jours.
SNAPSHOT_RETENTION_DAYS = 30

refresh_state = {
    "in_progress": False,
    "last_started_at": None,
    "last_finished_at": None,
}


def _apply_channel_metadata(channel: Channel, resolved) -> None:
    channel.title = resolved.title
    channel.handle = resolved.handle
    channel.thumbnail_url = resolved.thumbnail_url
    channel.subscriber_count = resolved.subscriber_count
    channel.uploads_playlist_id = resolved.uploads_playlist_id


async def refresh_channel_metadata(db: Session, client: YouTubeClient, channels: list[Channel]) -> None:
    """Rafraîchit titre/miniature/abonnés de toutes les chaînes en un minimum
    d'appels (par lots de 50), pour ne jamais laisser une métadonnée figée
    (conformité + fiabilité du nombre d'abonnés affiché)."""
    if not channels:
        return
    ids = [c.youtube_channel_id for c in channels]
    resolved_by_id = {r.youtube_channel_id: r for r in await client.get_channels(ids)}
    for channel in channels:
        resolved = resolved_by_id.get(channel.youtube_channel_id)
        if resolved is None:
            channel.last_error = "Chaîne introuvable sur YouTube (a-t-elle été supprimée ?)"
            continue
        _apply_channel_metadata(channel, resolved)
    db.commit()


def purge_old_snapshots(db: Session) -> None:
    cutoff = dt.datetime.utcnow() - dt.timedelta(days=SNAPSHOT_RETENTION_DAYS)
    db.query(VideoSnapshot).filter(VideoSnapshot.captured_at < cutoff).delete()
    db.commit()


async def refresh_channel(db: Session, client: YouTubeClient, channel: Channel) -> None:
    if not channel.uploads_playlist_id:
        channel.last_error = "Pas de playlist de mises en ligne pour cette chaîne"
        return

    video_ids = await client.get_playlist_video_ids(
        channel.uploads_playlist_id, max_results=settings.max_videos_per_channel
    )
    if not video_ids:
        channel.last_error = None
        channel.last_refreshed_at = dt.datetime.utcnow()
        return

    videos_data = await client.get_videos(video_ids)
    videos_data = compute_outliers(
        videos_data,
        multiplier=settings.outlier_multiplier,
        min_views_floor=settings.min_views_floor,
        min_history=settings.min_history_videos,
    )

    now = dt.datetime.utcnow()
    existing = {
        v.youtube_video_id: v
        for v in db.query(Video).filter(Video.channel_id == channel.id).all()
    }

    for data in videos_data:
        video = existing.get(data["youtube_video_id"])
        was_outlier = video.is_outlier if video else False

        if video is None:
            video = Video(youtube_video_id=data["youtube_video_id"], channel_id=channel.id)
            db.add(video)

        video.title = data["title"]
        video.thumbnail_url = data["thumbnail_url"]
        video.published_at = data["published_at"]
        video.view_count = data["view_count"]
        video.like_count = data["like_count"]
        video.comment_count = data["comment_count"]
        video.baseline_views = data["baseline_views"]
        video.outlier_score = data["outlier_score"]
        video.is_outlier = data["is_outlier"]
        video.last_checked_at = now

        if video.is_outlier and not was_outlier:
            video.first_detected_outlier_at = now
        if not video.is_outlier:
            video.first_detected_outlier_at = None

        db.add(VideoSnapshot(youtube_video_id=data["youtube_video_id"], view_count=data["view_count"]))

    channel.last_refreshed_at = now
    channel.last_error = None


async def refresh_all_channels(db: Session) -> None:
    if refresh_state["in_progress"]:
        logger.info("Rafraîchissement déjà en cours, on saute ce cycle")
        return

    refresh_state["in_progress"] = True
    refresh_state["last_started_at"] = dt.datetime.utcnow()
    try:
        if not settings.youtube_api_key:
            logger.warning("YOUTUBE_API_KEY non configurée : rafraîchissement ignoré")
            return

        channels = db.query(Channel).all()
        async with YouTubeClient(settings.youtube_api_key) as client:
            try:
                await refresh_channel_metadata(db, client, channels)
            except YouTubeAPIError as exc:
                logger.warning("Erreur YouTube lors du rafraîchissement des métadonnées de chaînes: %s", exc)
                db.rollback()

            for channel in channels:
                try:
                    await refresh_channel(db, client, channel)
                    db.commit()
                except YouTubeAPIError as exc:
                    logger.warning("Erreur YouTube pour %s: %s", channel.youtube_channel_id, exc)
                    channel.last_error = str(exc)
                    db.commit()
                except Exception:
                    logger.exception("Erreur inattendue pour la chaîne %s", channel.youtube_channel_id)
                    db.rollback()

        purge_old_snapshots(db)
    finally:
        refresh_state["in_progress"] = False
        refresh_state["last_finished_at"] = dt.datetime.utcnow()
