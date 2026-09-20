from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.orm import Session

from ..db import SessionLocal
from ..refresh import refresh_all_channels, refresh_state

router = APIRouter(prefix="/refresh", tags=["refresh"])


async def _run_refresh():
    db = SessionLocal()
    try:
        await refresh_all_channels(db)
    finally:
        db.close()


@router.post("/run")
async def run_refresh(background_tasks: BackgroundTasks):
    if refresh_state["in_progress"]:
        return {"ok": False, "message": "Un rafraîchissement est déjà en cours"}
    background_tasks.add_task(_run_refresh)
    return {"ok": True, "message": "Rafraîchissement lancé en arrière-plan"}
