from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import Channel, Niche
from ..schemas import ChannelCreate, ChannelOut
from ..youtube_client import YouTubeClient, YouTubeAPIError

router = APIRouter(prefix="/channels", tags=["channels"])


def _get_or_create_niche(db: Session, name: str) -> Niche:
    niche = db.query(Niche).filter(Niche.name.ilike(name.strip())).first()
    if niche:
        return niche
    niche = Niche(name=name.strip())
    db.add(niche)
    db.commit()
    db.refresh(niche)
    return niche


@router.get("", response_model=list[ChannelOut])
def list_channels(niche: str | None = None, db: Session = Depends(get_db)):
    q = db.query(Channel)
    if niche:
        q = q.join(Niche).filter(Niche.name.ilike(niche))
    return q.order_by(Channel.title).all()


@router.post("", response_model=ChannelOut)
async def add_channel(payload: ChannelCreate, db: Session = Depends(get_db)):
    if not settings.youtube_api_key:
        raise HTTPException(400, "YOUTUBE_API_KEY non configurée côté serveur (voir .env)")

    niche = _get_or_create_niche(db, payload.niche)

    async with YouTubeClient(settings.youtube_api_key) as client:
        try:
            resolved = await client.resolve_channel(payload.channel)
        except YouTubeAPIError as exc:
            raise HTTPException(502, str(exc))

    if not resolved:
        raise HTTPException(404, f"Impossible de trouver la chaîne YouTube pour '{payload.channel}'")

    existing = db.query(Channel).filter(Channel.youtube_channel_id == resolved.youtube_channel_id).first()
    if existing:
        existing.niche_id = niche.id
        db.commit()
        db.refresh(existing)
        return existing

    channel = Channel(
        youtube_channel_id=resolved.youtube_channel_id,
        title=resolved.title,
        handle=resolved.handle,
        thumbnail_url=resolved.thumbnail_url,
        subscriber_count=resolved.subscriber_count,
        uploads_playlist_id=resolved.uploads_playlist_id,
        niche_id=niche.id,
        added_by=payload.added_by,
    )
    db.add(channel)
    db.commit()
    db.refresh(channel)
    return channel


@router.delete("/{channel_id}")
def delete_channel(channel_id: int, db: Session = Depends(get_db)):
    channel = db.query(Channel).get(channel_id)
    if not channel:
        raise HTTPException(404, "Chaîne introuvable")
    db.delete(channel)
    db.commit()
    return {"ok": True}
