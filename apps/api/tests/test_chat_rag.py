import io
import json
import pytest
from httpx import ASGITransport, AsyncClient
from main import app
from services.tool_service import get_tool_registry


@pytest.mark.asyncio
async def test_search_knowledge_base_tool_in_registry() -> None:
    registry = get_tool_registry()
    tool = registry.get("search_knowledge_base")
    assert tool is not None
    assert "hybrid" in tool.description.lower()
    schema = tool.to_json_schema()
    assert "query" in schema["properties"]
    assert "workspace_id" in schema["properties"]


@pytest.mark.asyncio
async def test_chat_rag_grounding_stream_and_completions() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Create a workspace
        ws_resp = await client.post(
            "/api/v1/workspaces",
            json={"name": "End-to-End RAG Workspace"},
        )
        assert ws_resp.status_code == 201
        ws_id = ws_resp.json()["id"]

        try:
            # 2. Upload a technical document
            doc_content = (
                "# Token Bucket Algorithm\n\n"
                "The token bucket algorithm maintains a bucket of capacity B that accumulates tokens at rate R.\n"
                "When a request arrives, it consumes T tokens. If fewer than T tokens are available, the request is rejected.\n"
            ).encode("utf-8")

            files = {
                "file": ("rate_limiter.md", io.BytesIO(doc_content), "text/markdown"),
            }
            upload_resp = await client.post(
                f"/api/v1/workspaces/{ws_id}/files/upload",
                files=files,
            )
            assert upload_resp.status_code == 201
            file_meta = upload_resp.json()
            assert file_meta["metadata"].get("is_indexed") is True

            # 3. Test autonomous tool execution via search_knowledge_base
            registry = get_tool_registry()
            kb_tool = registry.get("search_knowledge_base")
            tool_output = await kb_tool.execute(
                query="bucket of capacity B",
                workspace_id=ws_id,
                top_k=3,
            )
            assert tool_output["total_chunks_found"] >= 1
            assert any("rate_limiter.md" in c["filename"] for c in tool_output["citations"])

            # 4. Test non-streaming completions with RAG grounding
            comp_resp = await client.post(
                "/api/v1/chat/completions",
                json={
                    "prompt": "What happens when fewer than T tokens are available in rate_limiter.md?",
                    "workspace_id": ws_id,
                    "provider": "mock",
                    "model": "mock-model",
                    "enable_rag": True,
                },
            )
            assert comp_resp.status_code == 200
            comp_data = comp_resp.json()
            assert "content" in comp_data
            # Assert RAG citations are attached in metadata
            citations = comp_data.get("metadata", {}).get("rag_citations", [])
            assert len(citations) >= 1
            assert citations[0]["filename"] == "rate_limiter.md"

            # 5. Test SSE streaming with event: rag_sources
            events: list[str] = []
            async with client.stream(
                "POST",
                "/api/v1/chat/stream",
                json={
                    "prompt": "Explain token bucket capacity B",
                    "workspace_id": ws_id,
                    "provider": "mock",
                    "model": "mock-model",
                    "enable_rag": True,
                },
            ) as response:
                assert response.status_code == 200
                async for line in response.aiter_lines():
                    if line.strip():
                        events.append(line.strip())

            # Verify that event: rag_sources was emitted
            assert any("event: rag_sources" in e for e in events)
            # Find data line following rag_sources
            for idx, e in enumerate(events):
                if e == "event: rag_sources" and idx + 1 < len(events):
                    data_str = events[idx + 1].replace("data: ", "")
                    rag_data = json.loads(data_str)
                    assert rag_data["type"] == "rag_sources"
                    assert len(rag_data["sources"]) >= 1
                    assert rag_data["sources"][0]["filename"] == "rate_limiter.md"
                    break
        finally:
            await client.delete(f"/api/v1/workspaces/{ws_id}")
