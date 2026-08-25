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
async def test_chat_stream_with_tree_lineage() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        tree_payload = {
            "id": "tree_123",
            "root_node_id": "node_1",
            "active_node_id": "node_2",
            "nodes": {
                "node_1": {
                    "id": "node_1",
                    "parent_id": None,
                    "children_ids": ["node_2"],
                    "role": "user",
                    "content": "Explain React state.",
                    "created_at": "2026-08-21T12:00:00Z",
                },
                "node_2": {
                    "id": "node_2",
                    "parent_id": "node_1",
                    "children_ids": [],
                    "role": "assistant",
                    "content": "React state manages component data.",
                    "created_at": "2026-08-21T12:00:01Z",
                },
            },
            "created_at": "2026-08-21T12:00:00Z",
            "updated_at": "2026-08-21T12:00:01Z",
        }

        payload = {
            "prompt": "How does useState work under the hood?",
            "parent_node_id": "node_2",
            "highlighted_context": "component data",
            "tree": tree_payload,
            "provider": "mock",
            "metadata": {"stream_delay": 0.001},
        }

        response = await client.post("/api/v1/chat/stream", json=payload)
        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")


@pytest.mark.asyncio
async def test_chat_stream_with_camel_case_tree_payload() -> None:
    """Verify that frontend camelCase JSON payload from Next.js is accepted without 422 errors."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        camel_tree_payload = {
            "id": "tree_ts_1",
            "rootNodeId": "node_1",
            "activeNodeId": "node_2",
            "nodes": {
                "node_1": {
                    "id": "node_1",
                    "parentId": None,
                    "childrenIds": ["node_2"],
                    "role": "user",
                    "content": "Explain Python data structures.",
                    "createdAt": "2026-08-21T12:00:00Z",
                },
                "node_2": {
                    "id": "node_2",
                    "parentId": "node_1",
                    "childrenIds": [],
                    "role": "assistant",
                    "content": "Python provides lists, dictionaries, tuples.",
                    "createdAt": "2026-08-21T12:00:01Z",
                },
            },
            "createdAt": "2026-08-21T12:00:00Z",
            "updatedAt": "2026-08-21T12:00:01Z",
        }

        payload = {
            "prompt": "How do hash tables work?",
            "parentNodeId": "node_2",
            "highlightedContext": "dictionaries",
            "tree": camel_tree_payload,
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


@pytest.mark.asyncio
async def test_chat_stream_with_byok_and_generation_params() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "prompt": "Test BYOK parameters",
            "provider": "mock",
            "model": "gemini-2.5-flash",
            "apiKey": "custom-byok-test-key-12345",
            "temperature": 0.3,
            "maxTokens": 1024,
            "systemPrompt": "You are a custom tuned assistant",
            "metadata": {"stream_delay": 0.001},
        }
        response = await client.post("/api/v1/chat/stream", json=payload)
        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")
        assert "data: " in response.text

