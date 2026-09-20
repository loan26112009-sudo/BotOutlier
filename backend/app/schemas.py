import datetime as dt

from pydantic import BaseModel, ConfigDict


class NicheCreate(BaseModel):
    name: str


class NicheOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    created_at: dt.datetime
    channel_count: int = 0


class ChannelCreate(BaseModel):
    channel: str  # URL, @handle, ID YouTube ou nom
    niche: str
    added_by: str | None = None


class ChannelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    youtube_channel_id: str
    title: str | None
    handle: str | None
    thumbnail_url: str | None
    subscriber_count: int | None
    niche_id: int
    last_refreshed_at: dt.datetime | None
    last_error: str | None


class VideoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    youtube_video_id: str
    title: str | None
    thumbnail_url: str | None
    published_at: dt.datetime | None
    view_count: int
    like_count: int
    comment_count: int
    baseline_views: float | None
    outlier_score: float | None
    is_outlier: bool
    first_detected_outlier_at: dt.datetime | None


class OutlierOut(BaseModel):
    video: VideoOut
    channel_title: str | None
    channel_id: str
    niche: str
    is_new: bool


class DiscoveredChannel(BaseModel):
    youtube_channel_id: str
    title: str | None
    description: str | None
    thumbnail_url: str | None
    subscriber_count: int | None
    view_count: int | None
    already_tracked: bool = False


class DiscoverBySeedRequest(BaseModel):
    channel: str
    limit: int = 15


class DiscoverByQueryRequest(BaseModel):
    query: str
    limit: int = 15


class BulkAddRequest(BaseModel):
    niche: str
    channel_ids: list[str]


class FavoriteCreate(BaseModel):
    youtube_video_id: str
    title: str | None = None
    channel_title: str | None = None
    channel_youtube_id: str | None = None
    thumbnail_url: str | None = None
    url: str | None = None
    niche: str | None = None
    source_page: str | None = None


class FavoriteUpdate(BaseModel):
    niche: str | None = None


class FavoriteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    youtube_video_id: str
    title: str | None
    channel_title: str | None
    channel_youtube_id: str | None
    thumbnail_url: str | None
    url: str | None
    niche_id: int | None
    created_at: dt.datetime


class StatusOut(BaseModel):
    tracked_channels: int
    tracked_niches: int
    last_refresh_started_at: dt.datetime | None
    last_refresh_finished_at: dt.datetime | None
    next_refresh_at: dt.datetime | None
    refresh_interval_hours: float
    youtube_api_key_configured: bool
    refresh_in_progress: bool
