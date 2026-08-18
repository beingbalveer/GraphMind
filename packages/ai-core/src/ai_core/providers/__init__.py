import os
from typing import Optional

from ai_core.base import BaseProvider
from ai_core.providers.gemini import GeminiProvider
from ai_core.providers.mock import MockProvider
from ai_core.providers.openai import OpenAIProvider


def get_provider(provider_name: Optional[str] = None) -> BaseProvider:
    """
    Provider factory resolving requested provider name or defaulting to available API key.
    """
    default_name = os.getenv("DEFAULT_PROVIDER") or "gemini"
    name = (provider_name or default_name).lower()

    if name == "gemini":
        try:
            return GeminiProvider()
        except ValueError:
            pass

    if name == "openai":
        try:
            return OpenAIProvider()
        except ValueError:
            pass

    # Try fallback to whatever API key exists
    if os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"):
        return GeminiProvider()
    if os.getenv("OPENAI_API_KEY"):
        return OpenAIProvider()

    # Default to MockProvider if no keys present
    return MockProvider()


__all__ = [
    "GeminiProvider",
    "OpenAIProvider",
    "MockProvider",
    "get_provider",
]
