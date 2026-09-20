"""Découverte de nouvelles chaînes : soit à partir d'une chaîne "graine"
(on cherche des chaînes similaires via ses mots-clés), soit à partir d'un
mot-clé de niche (ex: "gaming", "GTA", "cinéma").

L'API YouTube n'expose plus de "relatedToChannelId", donc la similarité est
approximée par une recherche texte sur le titre/la description de la chaîne
graine. C'est un point de départ pragmatique, pas une similarité sémantique
parfaite.
"""

from __future__ import annotations

import re

from .youtube_client import YouTubeClient

STOPWORDS = {
    "the", "and", "for", "with", "from", "this", "that", "your", "you", "our",
    "les", "des", "une", "un", "la", "le", "de", "du", "et", "pour", "sur",
    "official", "channel", "chaine", "chaîne", "youtube", "com", "http", "https", "www",
}


def _keywords_from_text(text: str, limit: int = 4) -> list[str]:
    words = re.findall(r"[A-Za-zÀ-ÖØ-öø-ÿ0-9']{3,}", text.lower())
    seen: list[str] = []
    for w in words:
        if w in STOPWORDS or w in seen:
            continue
        seen.append(w)
        if len(seen) >= limit:
            break
    return seen


async def discover_similar_channels(
    client: YouTubeClient, seed_channel_ref: str, limit: int = 15
) -> list[str]:
    seed = await client.resolve_channel(seed_channel_ref)
    if not seed:
        return []

    text = " ".join(filter(None, [seed.title, (seed.description or "")[:300]]))
    keywords = _keywords_from_text(text, limit=5)
    query = " ".join(keywords) if keywords else (seed.title or "")
    if not query:
        return []

    candidate_ids = await client.search_channels(query, limit=limit + 1)
    return [cid for cid in candidate_ids if cid != seed.youtube_channel_id][:limit]


async def discover_channels_by_query(
    client: YouTubeClient, query: str, limit: int = 15
) -> list[str]:
    return await client.search_channels(query, limit=limit)
