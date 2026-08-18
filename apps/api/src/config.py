from functools import lru_cache
from typing import List, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application-wide type-safe settings loaded from environment variables and .env file.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Server configuration
    ENVIRONMENT: str = Field(default="development", description="Application runtime environment")
    LOG_LEVEL: str = Field(default="info", description="Logging verbosity level")
    HOST: str = Field(default="0.0.0.0", description="API bind host")
    PORT: int = Field(default=8008, description="API bind port")
    FRONTEND_URL: str = Field(default="http://localhost:3000", description="Next.js frontend URL")
    CORS_ORIGINS: List[str] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000", "*"],
        description="Allowed CORS origins",
    )

    # AI Provider configuration
    DEFAULT_PROVIDER: str = Field(default="gemini", description="Default AI provider")
    DEFAULT_MODEL: str = Field(default="gemini-2.5-flash", description="Default foundation model")
    GEMINI_API_KEY: Optional[str] = Field(default=None, description="Google Gemini API Key")
    GOOGLE_API_KEY: Optional[str] = Field(default=None, description="Google Cloud API Key alias")
    OPENAI_API_KEY: Optional[str] = Field(default=None, description="OpenAI API Key")

    # Database configuration (for future persistence phases)
    DATABASE_URL: Optional[str] = Field(default=None, description="PostgreSQL connection string")
    REDIS_URL: Optional[str] = Field(default=None, description="Redis connection string")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Cached settings instance provider.
    """
    return Settings()
