from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Channel, Niche
from ..schemas import NicheCreate, NicheOut

router = APIRouter(prefix="/niches", tags=["niches"])


@router.get("", response_model=list[NicheOut])
def list_niches(db: Session = Depends(get_db)):
    niches = db.query(Niche).order_by(Niche.name).all()
    out = []
    for n in niches:
        count = db.query(Channel).filter(Channel.niche_id == n.id).count()
        out.append(NicheOut(id=n.id, name=n.name, created_at=n.created_at, channel_count=count))
    return out


@router.post("", response_model=NicheOut)
def create_niche(payload: NicheCreate, db: Session = Depends(get_db)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "Nom de niche vide")
    existing = db.query(Niche).filter(Niche.name.ilike(name)).first()
    if existing:
        return NicheOut(id=existing.id, name=existing.name, created_at=existing.created_at, channel_count=0)
    niche = Niche(name=name)
    db.add(niche)
    db.commit()
    db.refresh(niche)
    return NicheOut(id=niche.id, name=niche.name, created_at=niche.created_at, channel_count=0)


@router.delete("/{niche_id}")
def delete_niche(niche_id: int, db: Session = Depends(get_db)):
    niche = db.query(Niche).get(niche_id)
    if not niche:
        raise HTTPException(404, "Niche introuvable")
    db.delete(niche)
    db.commit()
    return {"ok": True}
