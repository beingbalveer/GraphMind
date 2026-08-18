import os
from typing import Dict, Optional, Type

from ai_core.base import BaseLLMProvider
from ai_core.providers.gemini import GeminiProvider
from ai_core.providers.mock import MockProvider
from ai_core.providers.openai import OpenAIProvider

# Internal registry mapping provider identifier to its concrete class
_PROVIDER_REGISTRY: Dict[str, Type[BaseLLMProvider]] = {
    "gemini": GeminiProvider,
    "google": GeminiProvider,
    "openai": OpenAIProvider,
    "mock": MockProvider,
}


def register_provider(name: str, provider_cls: Type[BaseLLMProvider]) -> None:
    """
    Register a new AI model provider in the factory registry.
    """
    _PROVIDER_REGISTRY[name.lower().strip()] = provider_cls


def get_llm_provider(
    provider_name: Optional[str] = None,
    api_key: Optional[str] = None,
) -> BaseLLMProvider:
    """
    Provider factory resolving requested provider name or defaulting to available API key.
    """
    default_name = os.getenv("DEFAULT_PROVIDER") or "gemini"
    name = (provider_name or default_name).lower().strip()

    # Direct registry lookup
    if name in _PROVIDER_REGISTRY:
        provider_cls = _PROVIDER_REGISTRY[name]
        try:
            return provider_cls(api_key=api_key) if api_key else provider_cls()
        except ValueError:
            # If explicit provider initialization failed (e.g. Missing key), fallback gracefully
            pass

    # Graceful fallback to whatever API key exists in environment
    if os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"):
        return GeminiProvider(api_key=api_key)
    if os.getenv("OPENAI_API_KEY"):
        return OpenAIProvider(api_key=api_key)

    # Default to MockProvider for zero-cost offline operations
    return MockProvider()


# Backward compatibility alias
get_provider = get_llm_provider

__all__ = [
    "GeminiProvider",
    "OpenAIProvider",
    "MockProvider",
    "get_llm_provider",
    "get_provider",
    "register_provider",
]
