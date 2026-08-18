from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from ai_core.base import ChatMessage, ChatRole, GenerationResult, ModelConfig, StreamChunk
from ai_core.providers.openai import OpenAIProvider


def test_openai_missing_api_key() -> None:
    with patch.dict("os.environ", {}, clear=True):
        with pytest.raises(ValueError, match="OPENAI_API_KEY environment variable is not set"):
            OpenAIProvider(api_key=None)


@pytest.mark.asyncio
async def test_openai_generate_success() -> None:
    mock_client = MagicMock()
    mock_chat = MagicMock()
    mock_completions = MagicMock()

    # Mock response
    mock_choice = MagicMock()
    mock_choice.message.content = "OpenAI answer"
    mock_choice.finish_reason = "stop"

    mock_usage = MagicMock()
    mock_usage.prompt_tokens = 15
    mock_usage.completion_tokens = 25
    mock_usage.total_tokens = 40

    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_response.usage = mock_usage

    mock_completions.create = AsyncMock(return_value=mock_response)
    mock_chat.completions = mock_completions
    mock_client.chat = mock_chat

    with patch("ai_core.providers.openai.AsyncOpenAI", return_value=mock_client):
        provider = OpenAIProvider(api_key="sk-test-key")
        result = await provider.generate(
            [ChatMessage.user("Hello")],
            ModelConfig(model_name="gpt-4o-mini", temperature=0.3),
        )

        assert isinstance(result, GenerationResult)
        assert result.content == "OpenAI answer"
        assert result.role == ChatRole.ASSISTANT
        assert result.model_name == "gpt-4o-mini"
        assert result.usage.prompt_tokens == 15
        assert result.usage.completion_tokens == 25
        assert result.usage.total_tokens == 40


@pytest.mark.asyncio
async def test_openai_stream_success() -> None:
    mock_client = MagicMock()
    mock_chat = MagicMock()
    mock_completions = MagicMock()

    # Simulate chunks
    async def mock_stream_generator(*args: object, **kwargs: object):
        chunk1 = MagicMock()
        chunk1.choices = [MagicMock(delta=MagicMock(content="Hello "), finish_reason=None)]
        yield chunk1

        chunk2 = MagicMock()
        chunk2.choices = [MagicMock(delta=MagicMock(content="world!"), finish_reason="stop")]
        yield chunk2

    mock_completions.create = AsyncMock(return_value=mock_stream_generator())
    mock_chat.completions = mock_completions
    mock_client.chat = mock_chat

    with patch("ai_core.providers.openai.AsyncOpenAI", return_value=mock_client):
        provider = OpenAIProvider(api_key="sk-test-key")
        chunks = []
        async for chunk in provider.stream("Stream prompt"):
            assert isinstance(chunk, StreamChunk)
            chunks.append(chunk.content)

        assert "".join(chunks) == "Hello world!"
