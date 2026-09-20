import datetime as dt

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Channel, Niche, Video
from ..schemas import OutlierOut, VideoOut

router = APIRouter(prefix="/outliers", tags=["outliers"])


@router.get("", response_model=list[OutlierOut])
def list_outliers(
    niche: str | None = None,
    min_score: float | None = None,
    only_new: bool = False,
    new_since_minutes: int = 180,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    q = (
        db.query(Video, Channel, Niche)
        .join(Channel, Video.channel_id == Channel.id)
        .join(Niche, Channel.niche_id == Niche.id)
        .filter(Video.is_outlier.is_(True))
    )
    if niche:
        q = q.filter(Niche.name.ilike(niche))
    if min_score is not None:
        q = q.filter(Video.outlier_score >= min_score)
    if only_new:
        cutoff = dt.datetime.utcnow() - dt.timedelta(minutes=new_since_minutes)
        q = q.filter(Video.first_detected_outlier_at >= cutoff)

    q = q.order_by(Video.outlier_score.desc()).limit(limit)

    cutoff_new = dt.datetime.utcnow() - dt.timedelta(minutes=new_since_minutes)
    results = []
    for video, channel, niche_row in q.all():
        is_new = bool(video.first_detected_outlier_at and video.first_detected_outlier_at >= cutoff_new)
        results.append(
            OutlierOut(
                video=VideoOut.model_validate(video),
                channel_title=channel.title,
                channel_id=channel.youtube_channel_id,
                niche=niche_row.name,
                is_new=is_new,
            )
        )
    return results
