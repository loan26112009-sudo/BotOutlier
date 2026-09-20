"""Client léger pour l'API YouTube Data v3.

Quotas à garder en tête (quota par défaut : 10 000 unités/jour) :
- channels.list, videos.list, playlistItems.list : 1 unité / appel (jusqu'à 50 ids en une fois)
- search.list : 100 unités / appel (utilisé uniquement pour la résolution par nom et la découverte,
  jamais pendant le rafraîchissement automatique)
"""

from __future__ import annotations

import datetime as dt
import re
from dataclasses import dataclass

import httpx

BASE_URL = "https://www.googleapis.com/youtube/v3"


class YouTubeAPIError(RuntimeError):
    pass


class YouTubeQuotaExceeded(YouTubeAPIError):
    pass


@dataclass
class ResolvedChannel:
    youtube_channel_id: str
    title: str | None
    handle: str | None
    thumbnail_url: str | None
    subscriber_count: int | None
    uploads_playlist_id: str | None
    description: str | None = None
    view_count: int | None = None


def _parse_channel_reference(raw: str) -> tuple[str, str]:
    """Devine le type de référence fourni par l'utilisateur (URL, @handle, ID, texte libre)."""
    raw = raw.strip()

    m = re.search(r"youtube\.com/channel/([A-Za-z0-9_-]+)", raw)
    if m:
        return "id", m.group(1)

    m = re.search(r"youtube\.com/@([A-Za-z0-9_.-]+)", raw)
    if m:
        return "handle", m.group(1)

    m = re.search(r"youtube\.com/(?:c|user)/([A-Za-z0-9_.-]+)", raw)
    if m:
        return "legacy", m.group(1)

    if raw.startswith("@"):
        return "handle", raw[1:]

    if re.fullmatch(r"UC[A-Za-z0-9_-]{22}", raw):
        return "id", raw

    return "query", raw


def _parse_datetime(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)


def _chunk(items: list[str], size: int = 50):
    for i in range(0, len(items), size):
        yield items[i : i + size]


class YouTubeClient:
    def __init__(self, api_key: str, timeout: float = 20.0):
        self.api_key = api_key
        self._client = httpx.AsyncClient(base_url=BASE_URL, timeout=timeout)

    async def __aenter__(self) -> "YouTubeClient":
        return self

    async def __aexit__(self, *exc):
        await self._client.aclose()

    async def close(self):
        await self._client.aclose()

    async def _get(self, path: str, params: dict) -> dict:
        if not self.api_key:
            raise YouTubeAPIError("YOUTUBE_API_KEY non configurée")
        params = {**params, "key": self.api_key}
        resp = await self._client.get(path, params=params)
        if resp.status_code == 403:
            body = resp.text
            if "quotaExceeded" in body:
                raise YouTubeQuotaExceeded("Quota YouTube API dépassé pour aujourd'hui")
            raise YouTubeAPIError(f"Accès refusé par l'API YouTube: {body[:300]}")
        if resp.status_code >= 400:
            raise YouTubeAPIError(f"Erreur API YouTube ({resp.status_code}): {resp.text[:300]}")
        return resp.json()

    async def _channels_by(self, **kwargs) -> list[dict]:
        data = await self._get(
            "/channels",
            {
                "part": "snippet,statistics,contentDetails,brandingSettings",
                "maxResults": 50,
                **kwargs,
            },
        )
        return data.get("items", [])

    async def search_channel_id_by_query(self, query: str) -> str | None:
        data = await self._get(
            "/search",
            {"part": "snippet", "type": "channel", "q": query, "maxResults": 1},
        )
        items = data.get("items", [])
        if not items:
            return None
        return items[0]["snippet"].get("channelId") or items[0]["id"].get("channelId")

    async def resolve_channel(self, raw: str) -> ResolvedChannel | None:
        kind, value = _parse_channel_reference(raw)

        items: list[dict] = []
        if kind == "id":
            items = await self._channels_by(id=value)
        elif kind == "handle":
            items = await self._channels_by(forHandle=f"@{value}")
        elif kind == "legacy":
            items = await self._channels_by(forUsername=value)
            if not items:
                items = await self._channels_by(forHandle=f"@{value}")

        if not items and kind != "id":
            channel_id = await self.search_channel_id_by_query(value)
            if channel_id:
                items = await self._channels_by(id=channel_id)
        elif not items and kind == "query":
            channel_id = await self.search_channel_id_by_query(value)
            if channel_id:
                items = await self._channels_by(id=channel_id)

        if not items:
            return None

        item = items[0]
        snippet = item.get("snippet", {})
        stats = item.get("statistics", {})
        content = item.get("contentDetails", {})
        thumbnails = snippet.get("thumbnails", {})
        thumb = thumbnails.get("medium") or thumbnails.get("default") or {}

        return ResolvedChannel(
            youtube_channel_id=item["id"],
            title=snippet.get("title"),
            handle=snippet.get("customUrl"),
            thumbnail_url=thumb.get("url"),
            subscriber_count=int(stats["subscriberCount"]) if stats.get("subscriberCount") else None,
            uploads_playlist_id=content.get("relatedPlaylists", {}).get("uploads"),
            description=snippet.get("description"),
            view_count=int(stats["viewCount"]) if stats.get("viewCount") else None,
        )

    async def get_channels(self, channel_ids: list[str]) -> list[ResolvedChannel]:
        results: list[ResolvedChannel] = []
        for batch in _chunk(channel_ids):
            items = await self._channels_by(id=",".join(batch))
            for item in items:
                snippet = item.get("snippet", {})
                stats = item.get("statistics", {})
                content = item.get("contentDetails", {})
                thumbnails = snippet.get("thumbnails", {})
                thumb = thumbnails.get("medium") or thumbnails.get("default") or {}
                results.append(
                    ResolvedChannel(
                        youtube_channel_id=item["id"],
                        title=snippet.get("title"),
                        handle=snippet.get("customUrl"),
                        thumbnail_url=thumb.get("url"),
                        subscriber_count=int(stats["subscriberCount"]) if stats.get("subscriberCount") else None,
                        uploads_playlist_id=content.get("relatedPlaylists", {}).get("uploads"),
                        description=snippet.get("description"),
                        view_count=int(stats["viewCount"]) if stats.get("viewCount") else None,
                    )
                )
        return results

    async def get_playlist_video_ids(self, playlist_id: str, max_results: int = 30) -> list[str]:
        video_ids: list[str] = []
        page_token = None
        while len(video_ids) < max_results:
            data = await self._get(
                "/playlistItems",
                {
                    "part": "contentDetails",
                    "playlistId": playlist_id,
                    "maxResults": min(50, max_results - len(video_ids)),
                    **({"pageToken": page_token} if page_token else {}),
                },
            )
            for item in data.get("items", []):
                vid = item.get("contentDetails", {}).get("videoId")
                if vid:
                    video_ids.append(vid)
            page_token = data.get("nextPageToken")
            if not page_token:
                break
        return video_ids[:max_results]

    async def get_videos(self, video_ids: list[str]) -> list[dict]:
        results: list[dict] = []
        for batch in _chunk(video_ids):
            data = await self._get(
                "/videos",
                {"part": "snippet,statistics", "id": ",".join(batch), "maxResults": 50},
            )
            for item in data.get("items", []):
                snippet = item.get("snippet", {})
                stats = item.get("statistics", {})
                thumbnails = snippet.get("thumbnails", {})
                thumb = thumbnails.get("medium") or thumbnails.get("default") or {}
                results.append(
                    {
                        "youtube_video_id": item["id"],
                        "title": snippet.get("title"),
                        "thumbnail_url": thumb.get("url"),
                        "published_at": _parse_datetime(snippet.get("publishedAt")),
                        "view_count": int(stats.get("viewCount", 0)),
                        "like_count": int(stats.get("likeCount", 0)) if stats.get("likeCount") else 0,
                        "comment_count": int(stats.get("commentCount", 0)) if stats.get("commentCount") else 0,
                    }
                )
        return results

    async def search_channels(self, query: str, limit: int = 15) -> list[str]:
        """Coûte 100 unités de quota : ne jamais appeler dans la boucle de rafraîchissement."""
        data = await self._get(
            "/search",
            {
                "part": "snippet",
                "type": "channel",
                "q": query,
                "maxResults": min(50, limit),
                "order": "relevance",
            },
        )
        ids = []
        for item in data.get("items", []):
            cid = item.get("snippet", {}).get("channelId") or item.get("id", {}).get("channelId")
            if cid:
                ids.append(cid)
        return ids
