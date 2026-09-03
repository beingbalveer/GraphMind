import json

import pytest
from httpx import ASGITransport, AsyncClient
from main import app


@pytest.mark.asyncio
async def test_list_available_tools() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/chat/tools")
        assert response.status_code == 200
        tools = response.json()
        assert isinstance(tools, list)
        tool_names = {t["name"] for t in tools}
        assert "calculator" in tool_names
        assert "system_info" in tool_names


@pytest.mark.asyncio
async def test_chat_completions_with_tool_execution() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "prompt": "Calculate 12 * 8",
            "provider": "mock",
            "enabled_tools": ["calculator"],
            "metadata": {
                "simulate_tool_call": {
                    "id": "call_calc_99",
                    "name": "calculator",
                    "arguments": {"expression": "12 * 8"},
                }
            },
        }
        response = await client.post("/api/v1/chat/completions", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "content" in data
        assert "metadata" in data
        assert "toolTrace" in data["metadata"] or "tool_trace" in data["metadata"]
        trace = data["metadata"].get("toolTrace") or data["metadata"].get("tool_trace")
        assert len(trace) == 1
        assert trace[0]["name"] == "calculator"
        assert not trace[0]["is_error"]
        assert "96" in trace[0]["content"]


@pytest.mark.asyncio
async def test_chat_stream_with_tool_lifecycle_events() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "prompt": "What is the system status?",
            "provider": "mock",
            "enabled_tools": ["system_info"],
            "metadata": {
                "simulate_tool_call": {
                    "id": "call_sys_1",
                    "name": "system_info",
                    "arguments": {"include_timestamp": True},
                },
                "stream_delay": 0.001,
            },
        }
        response = await client.post("/api/v1/chat/stream", json=payload)
        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")

        events = response.text.split("\n\n")
        event_types = []
        parsed_payloads = []

        for event in events:
            lines = event.strip().splitlines()
            cur_event_type = None
            cur_data = None
            for line in lines:
                if line.startswith("event: "):
                    cur_event_type = line[7:].strip()
                elif line.startswith("data: "):
                    cur_data = line[6:].strip()
            if cur_event_type:
                event_types.append(cur_event_type)
            if cur_data and cur_data != "[DONE]":
                try:
                    parsed_payloads.append(json.loads(cur_data))
                except Exception:
                    pass

        # Verify tool lifecycle events were streamed in order
        assert "tool_call_start" in event_types
        assert "tool_call_result" in event_types
        assert "token" in event_types
        assert "done" in event_types

        # Verify start payload
        start_events = [p for p in parsed_payloads if p.get("type") == "tool_call_start"]
        assert len(start_events) >= 1
        assert start_events[0]["toolCall"]["name"] == "system_info"

        # Verify result payload
        result_events = [p for p in parsed_payloads if p.get("type") == "tool_call_result"]
        assert len(result_events) >= 1
        assert result_events[0]["toolResult"]["name"] == "system_info"
        assert not result_events[0]["toolResult"]["isError"]


@pytest.mark.asyncio
async def test_tool_not_found_in_registry() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "prompt": "Run nonexistent tool",
            "provider": "mock",
            "metadata": {
                "simulate_tool_call": {
                    "id": "call_unknown",
                    "name": "nonexistent_tool",
                    "arguments": {},
                }
            },
        }
        response = await client.post("/api/v1/chat/completions", json=payload)
        assert response.status_code == 200
        data = response.json()
        trace = data["metadata"].get("toolTrace") or data["metadata"].get("tool_trace")
        assert len(trace) == 1
        assert trace[0]["name"] == "nonexistent_tool"
        assert trace[0]["is_error"]
        assert "not found in registry" in trace[0]["content"]


@pytest.mark.asyncio
async def test_max_tool_iterations_guardrail() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Request with max_tool_iterations = 2
        payload = {
            "prompt": "Calculate",
            "provider": "mock",
            "max_tool_iterations": 2,
            "metadata": {
                "simulate_tool_call": {
                    "id": "loop_call",
                    "name": "system_info",
                    "arguments": {},
                }
            },
        }
        response = await client.post("/api/v1/chat/completions", json=payload)
        assert response.status_code == 200
        data = response.json()
        trace = data["metadata"].get("toolTrace") or data["metadata"].get("tool_trace")
        # Should execute up to 2 iterations and halt cleanly
        assert len(trace) <= 2
