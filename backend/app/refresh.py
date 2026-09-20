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

refresh_state = {
    "in_progress": False,
    "last_started_at": None,
    "last_finished_at": None,
}


async def refresh_channel(db: Session, client: YouTubeClient, channel: Channel) -> None:
    if not channel.uploads_playlist_id or not channel.title:
        info = await client.get_channels([channel.youtube_channel_id])
        if not info:
            channel.last_error = "Chaîne introuvable sur YouTube (a-t-elle été supprimée ?)"
            return
        resolved = info[0]
        channel.title = resolved.title
        channel.handle = resolved.handle
        channel.thumbnail_url = resolved.thumbnail_url
        channel.subscriber_count = resolved.subscriber_count
        channel.uploads_playlist_id = resolved.uploads_playlist_id

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
    finally:
        refresh_state["in_progress"] = False
        refresh_state["last_finished_at"] = dt.datetime.utcnow()
