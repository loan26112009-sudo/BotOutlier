import datetime as dt

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship

from .db import Base


class Niche(Base):
    __tablename__ = "niches"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    channels = relationship("Channel", back_populates="niche", cascade="all, delete-orphan")


class Channel(Base):
    __tablename__ = "channels"

    id = Column(Integer, primary_key=True)
    youtube_channel_id = Column(String, unique=True, nullable=False, index=True)
    title = Column(String, nullable=True)
    handle = Column(String, nullable=True)
    uploads_playlist_id = Column(String, nullable=True)
    thumbnail_url = Column(String, nullable=True)
    subscriber_count = Column(Integer, nullable=True)
    niche_id = Column(Integer, ForeignKey("niches.id"), nullable=False)
    added_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow)
    last_refreshed_at = Column(DateTime, nullable=True)
    last_error = Column(String, nullable=True)

    niche = relationship("Niche", back_populates="channels")
    videos = relationship("Video", back_populates="channel", cascade="all, delete-orphan")


class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True)
    youtube_video_id = Column(String, unique=True, nullable=False, index=True)
    channel_id = Column(Integer, ForeignKey("channels.id"), nullable=False)
    title = Column(String, nullable=True)
    thumbnail_url = Column(String, nullable=True)
    published_at = Column(DateTime, nullable=True)

    view_count = Column(Integer, default=0)
    like_count = Column(Integer, default=0)
    comment_count = Column(Integer, default=0)

    baseline_views = Column(Float, nullable=True)
    outlier_score = Column(Float, nullable=True)
    is_outlier = Column(Boolean, default=False)
    first_detected_outlier_at = Column(DateTime, nullable=True)
    last_checked_at = Column(DateTime, nullable=True)

    channel = relationship("Channel", back_populates="videos")


class VideoSnapshot(Base):
    """Historique des compteurs de vues, utile pour tracer la croissance d'un outlier."""

    __tablename__ = "video_snapshots"

    id = Column(Integer, primary_key=True)
    youtube_video_id = Column(String, index=True, nullable=False)
    view_count = Column(Integer)
    captured_at = Column(DateTime, default=dt.datetime.utcnow)


class FavoritePick(Base):
    """Vidéo mise en favori manuellement (clic sur le cœur) depuis YouTube."""

    __tablename__ = "favorite_picks"

    id = Column(Integer, primary_key=True)
    youtube_video_id = Column(String, unique=True, nullable=False, index=True)
    title = Column(String, nullable=True)
    channel_title = Column(String, nullable=True)
    channel_youtube_id = Column(String, nullable=True)
    thumbnail_url = Column(String, nullable=True)
    url = Column(String, nullable=True)
    niche_id = Column(Integer, ForeignKey("niches.id"), nullable=True)
    source_page = Column(String, nullable=True)  # "watch" ou "grid"
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    niche = relationship("Niche")
