import os
from functools import lru_cache
from pathlib import Path
from typing import List, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve root repository directory (/Users/balveerd/Documents/AI/GraphMind)
ROOT_DIR = Path(__file__).resolve().parents[2]
ROOT_ENV = ROOT_DIR / ".env"


class Settings(BaseSettings):
    """
    Application-wide type-safe settings loaded from environment variables and root .env file.
    """

    model_config = SettingsConfigDict(
        env_file=(str(ROOT_ENV), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Server configuration
    ENVIRONMENT: str = Field(default="development", description="Application runtime environment")
    LOG_LEVEL: str = Field(default="info", description="Logging verbosity level")
    HOST: str = Field(default="0.0.0.0", description="API bind host")
    PORT: int = Field(default=8300, description="API bind port")
    FRONTEND_URL: str = Field(default="http://localhost:3300", description="Next.js frontend URL")
    CORS_ORIGINS: List[str] = Field(
        default_factory=lambda: [
            "http://localhost:3300",
            "http://127.0.0.1:3300",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ],
        description="Allowed CORS origins (strictly restricted when credentials enabled)",
    )

    # Authentication & Security configuration
    JWT_SECRET_KEY: str = Field(
        default="dev-secret-change-in-production-min-32-chars-long",
        description="Secret key for signing access & refresh JWT tokens",
    )
    JWT_ALGORITHM: str = Field(default="HS256", description="JWT signing algorithm")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=60, description="Access token expiration time in minutes"
    )
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(
        default=30, description="Refresh token expiration time in days"
    )
    GOOGLE_CLIENT_ID: Optional[str] = Field(
        default=None, description="Google OAuth 2.0 Web Client ID"
    )

    # AI Provider configuration
    DEFAULT_PROVIDER: str = Field(default="gemini", description="Default AI provider")
    DEFAULT_MODEL: str = Field(default="gemini-2.5-flash", description="Default foundation model")
    GEMINI_API_KEY: Optional[str] = Field(default=None, description="Google Gemini API Key")
    GOOGLE_API_KEY: Optional[str] = Field(default=None, description="Google Cloud API Key alias")
    OPENAI_API_KEY: Optional[str] = Field(default=None, description="OpenAI API Key")
    ANTHROPIC_API_KEY: Optional[str] = Field(default=None, description="Anthropic API Key")
    DEEPSEEK_API_KEY: Optional[str] = Field(default=None, description="DeepSeek API Key")
    OLLAMA_BASE_URL: str = Field(
        default="http://localhost:11434/v1", description="Ollama API Base URL"
    )

    # Database configuration
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://balveerd:1234@localhost:5432/graphmind",
        description="PostgreSQL connection string",
    )
    REDIS_URL: Optional[str] = Field(default=None, description="Redis connection string")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Cached settings instance provider.
    """
    settings = Settings()
    # Propagate to os.environ if present so SDKs can discover keys
    if settings.GEMINI_API_KEY and not os.getenv("GEMINI_API_KEY"):
        os.environ["GEMINI_API_KEY"] = settings.GEMINI_API_KEY
    if settings.GOOGLE_API_KEY and not os.getenv("GOOGLE_API_KEY"):
        os.environ["GOOGLE_API_KEY"] = settings.GOOGLE_API_KEY
    if settings.OPENAI_API_KEY and not os.getenv("OPENAI_API_KEY"):
        os.environ["OPENAI_API_KEY"] = settings.OPENAI_API_KEY
    return settings
