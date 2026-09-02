from typing import Any, AsyncIterator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from ai_core.base import ChatMessage, ChatRole, GenerationResult, ModelConfig, StreamChunk
from ai_core.providers import get_llm_provider
from ai_core.providers.deepseek import DeepSeekProvider
from ai_core.providers.ollama import OllamaProvider
from ai_core.providers.openai import OpenAIProvider


def test_deepseek_missing_api_key() -> None:
    with patch.dict("os.environ", {}, clear=True):
        with pytest.raises(ValueError, match="DEEPSEEK_API_KEY environment variable is not set"):
            DeepSeekProvider(api_key=None)


def test_deepseek_initialization_defaults() -> None:
    with patch("ai_core.providers.openai.AsyncOpenAI") as mock_openai:
        provider = DeepSeekProvider(api_key="sk-deepseek-test")
        assert provider.default_model == "deepseek-chat"
        assert provider.base_url == "https://api.deepseek.com/v1"
        mock_openai.assert_called_once_with(
            api_key="sk-deepseek-test",
            base_url="https://api.deepseek.com/v1",
        )


def test_ollama_initialization_no_key_required() -> None:
    with patch.dict("os.environ", {}, clear=True):
        with patch("ai_core.providers.openai.AsyncOpenAI") as mock_openai:
            provider = OllamaProvider()
            assert provider.default_model == "llama3.3"
            assert provider.base_url == "http://localhost:11434/v1"
            assert provider.api_key == "ollama"
            mock_openai.assert_called_once_with(
                api_key="ollama",
                base_url="http://localhost:11434/v1",
            )


def test_ollama_custom_base_url() -> None:
    with patch("ai_core.providers.openai.AsyncOpenAI") as mock_openai:
        provider = OllamaProvider(base_url="http://remote-gpu:11434/v1")
        assert provider.base_url == "http://remote-gpu:11434/v1"
        mock_openai.assert_called_once_with(
            api_key="ollama",
            base_url="http://remote-gpu:11434/v1",
        )


@pytest.mark.asyncio
async def test_deepseek_generate_success() -> None:
    mock_client = MagicMock()
    mock_chat = MagicMock()
    mock_completions = MagicMock()

    mock_choice = MagicMock()
    mock_choice.message.content = "DeepSeek R1 reasoning response"
    mock_choice.finish_reason = "stop"

    mock_usage = MagicMock()
    mock_usage.prompt_tokens = 10
    mock_usage.completion_tokens = 50
    mock_usage.total_tokens = 60

    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_response.usage = mock_usage

    mock_completions.create = AsyncMock(return_value=mock_response)
    mock_chat.completions = mock_completions
    mock_client.chat = mock_chat

    with patch("ai_core.providers.openai.AsyncOpenAI", return_value=mock_client):
        provider = DeepSeekProvider(api_key="sk-deepseek-test")
        result = await provider.generate(
            [ChatMessage.user("Solve this math problem")],
            ModelConfig(model_name="deepseek-reasoner"),
        )

        assert isinstance(result, GenerationResult)
        assert result.content == "DeepSeek R1 reasoning response"
        assert result.role == ChatRole.ASSISTANT
        assert result.model_name == "deepseek-reasoner"
        assert result.usage.total_tokens == 60


@pytest.mark.asyncio
async def test_ollama_stream_success() -> None:
    mock_client = MagicMock()
    mock_chat = MagicMock()
    mock_completions = MagicMock()

    async def mock_stream_generator() -> AsyncIterator[Any]:
        chunk1 = MagicMock()
        chunk1.choices = [MagicMock(delta=MagicMock(content="Local "), finish_reason=None)]
        yield chunk1

        chunk2 = MagicMock()
        chunk2.choices = [MagicMock(delta=MagicMock(content="Ollama!"), finish_reason="stop")]
        yield chunk2

    mock_completions.create = AsyncMock(return_value=mock_stream_generator())
    mock_chat.completions = mock_completions
    mock_client.chat = mock_chat

    with patch("ai_core.providers.openai.AsyncOpenAI", return_value=mock_client):
        provider = OllamaProvider()
        chunks = []
        async for chunk in provider.stream("Hello local model"):
            assert isinstance(chunk, StreamChunk)
            chunks.append(chunk.content)

        assert "".join(chunks) == "Local Ollama!"


def test_factory_resolution() -> None:
    with patch("ai_core.providers.openai.AsyncOpenAI"):
        p_deepseek = get_llm_provider("deepseek", api_key="sk-test")
        assert isinstance(p_deepseek, DeepSeekProvider)

        p_ollama = get_llm_provider("ollama")
        assert isinstance(p_ollama, OllamaProvider)

        p_openai_custom = get_llm_provider("openai", api_key="sk-test", base_url="http://custom/v1")
        assert isinstance(p_openai_custom, OpenAIProvider)
        assert p_openai_custom.base_url == "http://custom/v1"
