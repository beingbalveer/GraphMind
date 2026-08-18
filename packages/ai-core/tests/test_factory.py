from typing import AsyncIterator, Optional
from unittest.mock import patch

from ai_core.base import BaseLLMProvider, GenerationResult, MessageInput, ModelConfig, StreamChunk
from ai_core.providers import (
    MockProvider,
    OpenAIProvider,
    get_llm_provider,
    get_provider,
    register_provider,
)


def test_get_provider_mock_explicit() -> None:
    provider = get_llm_provider("mock")
    assert isinstance(provider, MockProvider)


def test_get_provider_case_insensitive() -> None:
    provider = get_llm_provider("  MOCK  ")
    assert isinstance(provider, MockProvider)


def test_get_provider_alias() -> None:
    provider = get_provider("mock")
    assert isinstance(provider, MockProvider)


def test_get_provider_with_openai_key() -> None:
    with patch.dict("os.environ", {"OPENAI_API_KEY": "sk-fake-key"}, clear=True):
        provider = get_llm_provider("openai")
        assert isinstance(provider, OpenAIProvider)
        assert provider.api_key == "sk-fake-key"


def test_get_provider_fallback_to_mock_when_no_keys() -> None:
    with patch.dict("os.environ", {}, clear=True):
        provider = get_llm_provider("openai")  # Requested openai without key -> fallback to Mock
        assert isinstance(provider, MockProvider)


def test_register_custom_provider() -> None:
    class CustomProvider(BaseLLMProvider):
        async def generate(
            self, messages: MessageInput, config: Optional[ModelConfig] = None
        ) -> GenerationResult:
            return GenerationResult(content="custom", model_name="custom")

        async def stream(
            self, messages: MessageInput, config: Optional[ModelConfig] = None
        ) -> AsyncIterator[StreamChunk]:
            yield StreamChunk(content="custom ")

    register_provider("custom-test", CustomProvider)
    provider = get_llm_provider("custom-test")
    assert isinstance(provider, CustomProvider)
