import pytest
from ai_core.base import EmbeddingResult
from ai_core.providers import (
    MockEmbeddingProvider,
    get_embedding_provider,
)


@pytest.mark.asyncio
async def test_mock_embedding_provider_shape_and_dimension() -> None:
    provider = MockEmbeddingProvider(dimension=768)
    texts = ["Distributed Systems Overview", "Consensus Algorithms", "Paxos and Raft"]

    res: EmbeddingResult = await provider.embed(texts)

    assert len(res.embeddings) == 3
    assert res.dimension == 768
    assert len(res.embeddings[0]) == 768
    assert len(res.embeddings[1]) == 768
    assert len(res.embeddings[2]) == 768
    assert res.usage is not None
    assert res.usage.total_tokens > 0


@pytest.mark.asyncio
async def test_mock_embedding_deterministic_output() -> None:
    provider = MockEmbeddingProvider(dimension=768)
    text = "Deterministic vector generation"

    res1 = await provider.embed([text])
    res2 = await provider.embed([text])

    assert res1.embeddings[0] == res2.embeddings[0]


@pytest.mark.asyncio
async def test_mock_embedding_query_convenience() -> None:
    provider = MockEmbeddingProvider(dimension=768)
    query = "Find consensus algorithms"

    vec = await provider.embed_query(query)

    assert isinstance(vec, list)
    assert len(vec) == 768
    assert all(isinstance(x, float) for x in vec)


@pytest.mark.asyncio
async def test_embedding_factory_fallback_to_mock() -> None:
    provider = get_embedding_provider("mock")
    assert isinstance(provider, MockEmbeddingProvider)

    res = await provider.embed(["test fallback"])
    assert len(res.embeddings) == 1
