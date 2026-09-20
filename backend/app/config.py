from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    youtube_api_key: str = ""
    database_url: str = "sqlite:///./outliers.db"
    refresh_interval_hours: float = 2.0
    outlier_multiplier: float = 3.0
    min_views_floor: int = 3000
    min_history_videos: int = 5
    max_videos_per_channel: int = 30
    cors_origins: str = "*"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
