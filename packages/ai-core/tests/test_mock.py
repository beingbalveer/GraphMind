import pytest
from ai_core.base import ChatMessage, ChatRole, GenerationResult, ModelConfig, StreamChunk
from ai_core.providers.mock import MockProvider


@pytest.mark.asyncio
async def test_mock_provider_rich_generation() -> None:
    provider = MockProvider()
    messages = [
        ChatMessage.system("Act as senior AI architect"),
        ChatMessage.user("Show me a code snippet"),
    ]
    result = await provider.generate(messages)

    assert isinstance(result, GenerationResult)
    assert "Show me a code snippet" in result.content
    assert "```python" in result.content
    assert result.role == ChatRole.ASSISTANT
    assert result.usage.total_tokens > 0


@pytest.mark.asyncio
async def test_mock_provider_simulate_generation_error() -> None:
    provider = MockProvider()
    config = ModelConfig(metadata={"simulate_error": True})

    with pytest.raises(RuntimeError, match="Simulated MockProvider generation error"):
        await provider.generate("Test prompt", config=config)


@pytest.mark.asyncio
async def test_mock_provider_simulate_stream_error() -> None:
    provider = MockProvider()
    config = ModelConfig(metadata={"simulate_error": True})

    with pytest.raises(RuntimeError, match="Simulated MockProvider stream error"):
        async for _ in provider.stream("Test prompt", config=config):
            pass


@pytest.mark.asyncio
async def test_mock_provider_configurable_delay() -> None:
    provider = MockProvider()
    config = ModelConfig(metadata={"stream_delay": 0.001})

    chunks = []
    async for chunk in provider.stream("Latency check", config=config):
        assert isinstance(chunk, StreamChunk)
        chunks.append(chunk.content)

    assert len(chunks) > 5
    assert "Latency check" in "".join(chunks)
