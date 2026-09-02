from typing import Any, AsyncIterator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from ai_core.base import ChatMessage, ChatRole, GenerationResult, ModelConfig, StreamChunk
from ai_core.providers import get_llm_provider
from ai_core.providers.anthropic import AnthropicProvider


def test_anthropic_missing_api_key() -> None:
    with patch.dict("os.environ", {}, clear=True):
        with pytest.raises(ValueError, match="ANTHROPIC_API_KEY environment variable is not set"):
            AnthropicProvider(api_key=None)


def test_anthropic_message_normalization() -> None:
    with patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key"}):
        provider = AnthropicProvider()

        # Messages with system prompt and consecutive user turns
        messages = [
            ChatMessage.system("You are a helpful assistant."),
            ChatMessage.user("Hello 1"),
            ChatMessage.user("Hello 2"),
            ChatMessage.assistant("Hi there"),
        ]

        system, anthropic_messages = provider._to_anthropic_messages(
            messages, system_prompt="Additional system instructions."
        )

        assert system == "Additional system instructions.\n\nYou are a helpful assistant."
        assert len(anthropic_messages) == 2
        assert anthropic_messages[0] == {"role": "user", "content": "Hello 1\n\nHello 2"}
        assert anthropic_messages[1] == {"role": "assistant", "content": "Hi there"}


@pytest.mark.asyncio
async def test_anthropic_generate_success() -> None:
    mock_client = MagicMock()
    mock_messages = MagicMock()

    mock_block = MagicMock()
    mock_block.type = "text"
    mock_block.text = "Claude response"

    mock_usage = MagicMock()
    mock_usage.input_tokens = 20
    mock_usage.output_tokens = 30

    mock_response = MagicMock()
    mock_response.content = [mock_block]
    mock_response.usage = mock_usage
    mock_response.stop_reason = "end_turn"

    mock_messages.create = AsyncMock(return_value=mock_response)
    mock_client.messages = mock_messages

    with patch("ai_core.providers.anthropic.AsyncAnthropic", return_value=mock_client):
        provider = AnthropicProvider(api_key="test-key")
        result = await provider.generate(
            [ChatMessage.user("Explain quantum computing")],
            ModelConfig(model_name="claude-3-7-sonnet", temperature=0.5),
        )

        assert isinstance(result, GenerationResult)
        assert result.content == "Claude response"
        assert result.role == ChatRole.ASSISTANT
        assert result.model_name == "claude-3-7-sonnet-20250219"
        assert result.usage.prompt_tokens == 20
        assert result.usage.completion_tokens == 30
        assert result.usage.total_tokens == 50
        assert result.finish_reason == "end_turn"


@pytest.mark.asyncio
async def test_anthropic_stream_success() -> None:
    mock_client = MagicMock()
    mock_messages = MagicMock()

    # Create mock stream manager supporting `async with stream as stream:`
    mock_stream = MagicMock()

    async def mock_text_stream() -> AsyncIterator[str]:
        yield "Streaming "
        yield "from "
        yield "Claude!"

    mock_stream.text_stream = mock_text_stream()

    final_msg = MagicMock()
    final_msg.stop_reason = "end_turn"
    final_msg.usage = MagicMock(input_tokens=15, output_tokens=25)
    mock_stream.get_final_message = AsyncMock(return_value=final_msg)

    class MockStreamContext:
        async def __aenter__(self) -> Any:
            return mock_stream

        async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
            pass

    mock_messages.stream = MagicMock(return_value=MockStreamContext())
    mock_client.messages = mock_messages

    with patch("ai_core.providers.anthropic.AsyncAnthropic", return_value=mock_client):
        provider = AnthropicProvider(api_key="test-key")
        chunks = []
        async for chunk in provider.stream(
            "Test stream", ModelConfig(model_name="claude-3-5-sonnet")
        ):
            assert isinstance(chunk, StreamChunk)
            if chunk.content:
                chunks.append(chunk.content)
            else:
                assert chunk.finish_reason == "end_turn"
                assert chunk.usage is not None
                assert chunk.usage.total_tokens == 40

        assert "".join(chunks) == "Streaming from Claude!"


def test_anthropic_provider_factory_resolution() -> None:
    provider = get_llm_provider("anthropic", api_key="test-key")
    assert isinstance(provider, AnthropicProvider)

    provider_claude = get_llm_provider("claude", api_key="test-key")
    assert isinstance(provider_claude, AnthropicProvider)
