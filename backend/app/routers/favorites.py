from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import FavoritePick, Niche
from ..routers.channels import _get_or_create_niche
from ..schemas import FavoriteCreate, FavoriteOut, FavoriteUpdate

router = APIRouter(prefix="/favorites", tags=["favorites"])


@router.get("", response_model=list[FavoriteOut])
def list_favorites(niche: str | None = None, db: Session = Depends(get_db)):
    q = db.query(FavoritePick)
    if niche:
        q = q.join(Niche, FavoritePick.niche_id == Niche.id).filter(Niche.name.ilike(niche))
    return q.order_by(FavoritePick.created_at.desc()).all()


@router.get("/check")
def check_favorites(ids: str, db: Session = Depends(get_db)):
    id_list = [i for i in ids.split(",") if i]
    if not id_list:
        return {"favorited": []}
    rows = db.query(FavoritePick.youtube_video_id).filter(FavoritePick.youtube_video_id.in_(id_list)).all()
    return {"favorited": [r[0] for r in rows]}


@router.post("", response_model=FavoriteOut)
def add_favorite(payload: FavoriteCreate, db: Session = Depends(get_db)):
    existing = db.query(FavoritePick).filter(FavoritePick.youtube_video_id == payload.youtube_video_id).first()
    if existing:
        return existing

    niche_id = _get_or_create_niche(db, payload.niche).id if payload.niche else None

    fav = FavoritePick(
        youtube_video_id=payload.youtube_video_id,
        title=payload.title,
        channel_title=payload.channel_title,
        channel_youtube_id=payload.channel_youtube_id,
        thumbnail_url=payload.thumbnail_url,
        url=payload.url,
        niche_id=niche_id,
        source_page=payload.source_page,
    )
    db.add(fav)
    db.commit()
    db.refresh(fav)
    return fav


@router.patch("/{youtube_video_id}", response_model=FavoriteOut)
def update_favorite(youtube_video_id: str, payload: FavoriteUpdate, db: Session = Depends(get_db)):
    fav = db.query(FavoritePick).filter(FavoritePick.youtube_video_id == youtube_video_id).first()
    if not fav:
        raise HTTPException(404, "Favori introuvable")
    if payload.niche is not None:
        fav.niche_id = _get_or_create_niche(db, payload.niche).id if payload.niche else None
    db.commit()
    db.refresh(fav)
    return fav


@router.delete("/{youtube_video_id}")
def remove_favorite(youtube_video_id: str, db: Session = Depends(get_db)):
    fav = db.query(FavoritePick).filter(FavoritePick.youtube_video_id == youtube_video_id).first()
    if not fav:
        raise HTTPException(404, "Favori introuvable")
    db.delete(fav)
    db.commit()
    return {"ok": True}
