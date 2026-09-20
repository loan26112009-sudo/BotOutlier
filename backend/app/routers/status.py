import datetime as dt

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import Channel, Niche
from ..refresh import refresh_state
from ..scheduler import get_next_run_time
from ..schemas import StatusOut

router = APIRouter(tags=["status"])


@router.get("/status", response_model=StatusOut)
def status(db: Session = Depends(get_db)):
    last_finished = refresh_state["last_finished_at"]
    next_run = get_next_run_time()

    return StatusOut(
        tracked_channels=db.query(Channel).count(),
        tracked_niches=db.query(Niche).count(),
        last_refresh_started_at=refresh_state["last_started_at"],
        last_refresh_finished_at=last_finished,
        next_refresh_at=next_run,
        refresh_interval_hours=settings.refresh_interval_hours,
        youtube_api_key_configured=bool(settings.youtube_api_key),
        refresh_in_progress=refresh_state["in_progress"],
    )
