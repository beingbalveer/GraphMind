import pytest
from httpx import ASGITransport, AsyncClient
from main import app


@pytest.mark.asyncio
async def test_chat_completions_mock_single_prompt() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "prompt": "Explain database indexes",
            "provider": "mock",
        }
        response = await client.post("/api/v1/chat/completions", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "content" in data
        assert "Explain database indexes" in data["content"]
        assert data["role"] == "assistant"
        assert "usage" in data
        assert data["usage"]["total_tokens"] > 0
        assert "x-request-id" in response.headers


@pytest.mark.asyncio
async def test_chat_completions_mock_multi_turn() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "messages": [
                {"role": "user", "content": "What is Python?"},
                {"role": "assistant", "content": "Python is a language."},
                {"role": "user", "content": "Tell me about data classes."},
            ],
            "provider": "mock",
        }
        response = await client.post("/api/v1/chat/completions", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "Tell me about data classes" in data["content"]
        assert data["role"] == "assistant"


@pytest.mark.asyncio
async def test_chat_completions_error_handling() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "prompt": "Test error",
            "provider": "mock",
            "metadata": {"simulate_error": True},
        }
        response = await client.post("/api/v1/chat/completions", json=payload)
        assert response.status_code == 500
        data = response.json()
        assert "error" in data
        assert data["error"]["code"] == "HTTP_500"
