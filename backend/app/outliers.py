"""Calcul du score d'outlier pour un lot de vidéos d'une même chaîne.

Principe : pour chaque vidéo, on compare ses vues à la médiane des vues des
*autres* vidéos récentes de la chaîne (baseline robuste, peu sensible aux
outliers déjà présents dans l'échantillon). Si la vidéo dépasse cette
baseline d'un facteur donné ET franchit un plancher de vues absolu (pour
ignorer le bruit sur les toutes petites chaînes), elle est marquée outlier.
"""

from __future__ import annotations

import statistics
from typing import TypedDict


class VideoStats(TypedDict, total=False):
    youtube_video_id: str
    view_count: int
    baseline_views: float | None
    outlier_score: float | None
    is_outlier: bool


def compute_outliers(
    videos: list[dict],
    multiplier: float,
    min_views_floor: int,
    min_history: int,
) -> list[dict]:
    n = len(videos)
    if n < min_history:
        for v in videos:
            v["baseline_views"] = None
            v["outlier_score"] = None
            v["is_outlier"] = False
        return videos

    all_views = [v["view_count"] for v in videos]

    for v in videos:
        others = [views for vid, views in zip(videos, all_views) if vid is not v]
        if len(others) < max(min_history - 1, 3):
            baseline = None
        else:
            baseline = statistics.median(others)

        v["baseline_views"] = baseline

        if baseline and baseline > 0:
            score = v["view_count"] / baseline
        else:
            score = None

        v["outlier_score"] = score
        v["is_outlier"] = bool(
            score is not None and score >= multiplier and v["view_count"] >= min_views_floor
        )

    return videos
