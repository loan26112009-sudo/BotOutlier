from sqlalchemy.orm import Session

from .models import Niche

DEFAULT_NICHES = ["Divertissement", "Gaming", "GTA", "Fortnite", "Cinéma", "Mac"]


def ensure_default_niches(db: Session) -> None:
    existing = {n.name for n in db.query(Niche).all()}
    for name in DEFAULT_NICHES:
        if name not in existing:
            db.add(Niche(name=name))
    db.commit()
