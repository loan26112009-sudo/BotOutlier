from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..discovery import discover_channels_by_query, discover_similar_channels
from ..models import Channel
from ..routers.channels import _get_or_create_niche
from ..schemas import BulkAddRequest, DiscoverByQueryRequest, DiscoverBySeedRequest, DiscoveredChannel
from ..youtube_client import YouTubeClient, YouTubeAPIError

router = APIRouter(prefix="/discover", tags=["discover"])


async def _to_discovered(db: Session, client: YouTubeClient, ids: list[str]) -> list[DiscoveredChannel]:
    if not ids:
        return []
    tracked = {c.youtube_channel_id for c in db.query(Channel).filter(Channel.youtube_channel_id.in_(ids)).all()}
    channels = await client.get_channels(ids)
    return [
        DiscoveredChannel(
            youtube_channel_id=c.youtube_channel_id,
            title=c.title,
            description=(c.description or "")[:200],
            thumbnail_url=c.thumbnail_url,
            subscriber_count=c.subscriber_count,
            view_count=c.view_count,
            already_tracked=c.youtube_channel_id in tracked,
        )
        for c in channels
    ]


@router.post("/similar", response_model=list[DiscoveredChannel])
async def similar(payload: DiscoverBySeedRequest, db: Session = Depends(get_db)):
    if not settings.youtube_api_key:
        raise HTTPException(400, "YOUTUBE_API_KEY non configurée côté serveur (voir .env)")
    async with YouTubeClient(settings.youtube_api_key) as client:
        try:
            ids = await discover_similar_channels(client, payload.channel, limit=payload.limit)
            return await _to_discovered(db, client, ids)
        except YouTubeAPIError as exc:
            raise HTTPException(502, str(exc))


@router.post("/query", response_model=list[DiscoveredChannel])
async def by_query(payload: DiscoverByQueryRequest, db: Session = Depends(get_db)):
    if not settings.youtube_api_key:
        raise HTTPException(400, "YOUTUBE_API_KEY non configurée côté serveur (voir .env)")
    async with YouTubeClient(settings.youtube_api_key) as client:
        try:
            ids = await discover_channels_by_query(client, payload.query, limit=payload.limit)
            return await _to_discovered(db, client, ids)
        except YouTubeAPIError as exc:
            raise HTTPException(502, str(exc))


@router.post("/add-bulk")
async def add_bulk(payload: BulkAddRequest, db: Session = Depends(get_db)):
    if not settings.youtube_api_key:
        raise HTTPException(400, "YOUTUBE_API_KEY non configurée côté serveur (voir .env)")

    niche = _get_or_create_niche(db, payload.niche)
    added = []
    async with YouTubeClient(settings.youtube_api_key) as client:
        try:
            resolved_channels = await client.get_channels(payload.channel_ids)
        except YouTubeAPIError as exc:
            raise HTTPException(502, str(exc))

    for resolved in resolved_channels:
        existing = db.query(Channel).filter(Channel.youtube_channel_id == resolved.youtube_channel_id).first()
        if existing:
            existing.niche_id = niche.id
            added.append(existing.youtube_channel_id)
            continue
        channel = Channel(
            youtube_channel_id=resolved.youtube_channel_id,
            title=resolved.title,
            handle=resolved.handle,
            thumbnail_url=resolved.thumbnail_url,
            subscriber_count=resolved.subscriber_count,
            uploads_playlist_id=resolved.uploads_playlist_id,
            niche_id=niche.id,
        )
        db.add(channel)
        added.append(resolved.youtube_channel_id)

    db.commit()
    return {"added": added, "niche": niche.name}
