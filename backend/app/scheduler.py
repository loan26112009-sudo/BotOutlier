import datetime as dt

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from .config import settings
from .db import SessionLocal
from .refresh import refresh_all_channels

scheduler = AsyncIOScheduler()
JOB_ID = "refresh_outliers"


async def _job():
    db = SessionLocal()
    try:
        await refresh_all_channels(db)
    finally:
        db.close()


def start_scheduler():
    if scheduler.running:
        return
    scheduler.add_job(
        _job,
        trigger=IntervalTrigger(hours=settings.refresh_interval_hours),
        id=JOB_ID,
        next_run_time=dt.datetime.now(),  # premier rafraîchissement immédiat au démarrage
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()


def get_next_run_time() -> dt.datetime | None:
    job = scheduler.get_job(JOB_ID)
    if not job:
        return None
    return job.next_run_time.replace(tzinfo=None) if job.next_run_time else None
