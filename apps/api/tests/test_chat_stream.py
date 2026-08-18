import json

import pytest
from httpx import ASGITransport, AsyncClient
from main import app


@pytest.mark.asyncio
async def test_chat_stream_mock_success() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "prompt": "Hello GraphMind",
            "provider": "mock",
            "metadata": {"stream_delay": 0.001},
        }
        response = await client.post("/api/v1/chat/stream", json=payload)
        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")

        events = response.text.split("\n\n")
        tokens = []
        for event in events:
            for line in event.splitlines():
                if line.startswith("data: "):
                    data_str = line[6:].strip()
                    if data_str == "[DONE]":
                        continue
                    try:
                        parsed = json.loads(data_str)
                        if "content" in parsed:
                            tokens.append(parsed["content"])
                    except Exception:
                        pass

        full_output = "".join(tokens)
        assert len(tokens) > 0
        assert "Hello GraphMind" in full_output


@pytest.mark.asyncio
async def test_chat_stream_with_messages_history() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "messages": [
                {"role": "system", "content": "You are an assistant"},
                {"role": "user", "content": "Explain architecture"},
            ],
            "provider": "mock",
            "metadata": {"stream_delay": 0.001},
        }
        response = await client.post("/api/v1/chat/stream", json=payload)
        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")


@pytest.mark.asyncio
async def test_chat_stream_error_simulation() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "prompt": "Trigger simulated failure",
            "provider": "mock",
            "metadata": {"simulate_error": True},
        }
        response = await client.post("/api/v1/chat/stream", json=payload)
        assert response.status_code == 200

        # Should contain error event in SSE payload
        assert (
            "event: error" in response.text
            or "Simulated MockProvider stream error" in response.text
        )
