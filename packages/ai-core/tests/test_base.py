import pytest
from ai_core.base import (
    ChatMessage,
    ChatRole,
    GenerationResult,
    ModelConfig,
    StreamChunk,
    TokenUsage,
)
from ai_core.providers.mock import MockProvider


def test_chat_message_helpers() -> None:
    user_msg = ChatMessage.user("Hello")
    assert user_msg.role == ChatRole.USER
    assert user_msg.content == "Hello"

    assistant_msg = ChatMessage.assistant("Hi there!")
    assert assistant_msg.role == ChatRole.ASSISTANT
    assert assistant_msg.content == "Hi there!"

    system_msg = ChatMessage.system("Be helpful.")
    assert system_msg.role == ChatRole.SYSTEM
    assert system_msg.content == "Be helpful."


def test_token_usage_model() -> None:
    usage = TokenUsage(prompt_tokens=10, completion_tokens=20, total_tokens=30)
    assert usage.prompt_tokens == 10
    assert usage.completion_tokens == 20
    assert usage.total_tokens == 30


def test_model_config_validation() -> None:
    config = ModelConfig(model_name="gpt-4o", temperature=0.5, max_tokens=1000)
    assert config.model_name == "gpt-4o"
    assert config.temperature == 0.5
    assert config.max_tokens == 1000


@pytest.mark.asyncio
async def test_mock_provider_generate_with_string() -> None:
    provider = MockProvider()
    result = await provider.generate("Test prompt")
    assert isinstance(result, GenerationResult)
    assert "Test prompt" in result.content
    assert result.role == ChatRole.ASSISTANT
    assert result.usage.total_tokens > 0


@pytest.mark.asyncio
async def test_mock_provider_generate_with_messages() -> None:
    provider = MockProvider()
    messages = [
        ChatMessage.system("Context"),
        ChatMessage.user("Explain FastAPI"),
    ]
    result = await provider.generate(messages)
    assert isinstance(result, GenerationResult)
    assert "Explain FastAPI" in result.content


@pytest.mark.asyncio
async def test_mock_provider_stream() -> None:
    provider = MockProvider()
    chunks = []
    async for chunk in provider.stream("Stream test"):
        assert isinstance(chunk, StreamChunk)
        chunks.append(chunk.content)

    full_text = "".join(chunks)
    assert "Stream test" in full_text
    assert len(chunks) > 1
