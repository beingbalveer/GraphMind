import pytest
from httpx import ASGITransport, AsyncClient
from main import app
from services.graph_tools import (
    CreateSubnodeTool,
    FetchUrlTool,
    SearchGraphTool,
    TraverseLineageTool,
)


@pytest.fixture(autouse=True)
def setup_mock_embeddings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DEFAULT_EMBEDDING_PROVIDER", "mock")


@pytest.mark.asyncio
async def test_search_graph_tool() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create workspace
        ws_resp = await client.post(
            "/api/v1/workspaces",
            json={"name": "Graph Search Test", "description": "Testing SearchGraphTool"},
        )
        assert ws_resp.status_code == 201
        ws_id = ws_resp.json()["id"]

        try:
            # Create a node
            node_resp = await client.post(
                f"/api/v1/workspaces/{ws_id}/nodes",
                json={
                    "role": "assistant",
                    "content": "PostgreSQL provides pgvector for high performance cosine similarity search.",
                    "highlightedContext": "pgvector search",
                },
            )
            assert node_resp.status_code == 201

            # Run tool
            tool = SearchGraphTool()
            res = await tool.run(
                {"query": "vector similarity", "workspace_id": ws_id},
                tool_call_id="call_search_1",
            )
            assert not res.is_error
            assert "pgvector" in res.content
        finally:
            await client.delete(f"/api/v1/workspaces/{ws_id}")


@pytest.mark.asyncio
async def test_traverse_lineage_tool() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        ws_resp = await client.post(
            "/api/v1/workspaces",
            json={"name": "Lineage Traversal Test"},
        )
        ws_id = ws_resp.json()["id"]

        try:
            # Create Root
            r_resp = await client.post(
                f"/api/v1/workspaces/{ws_id}/nodes",
                json={"role": "user", "content": "Root concept: Distributed Systems"},
            )
            root_id = r_resp.json()["id"]

            # Create Child
            c_resp = await client.post(
                f"/api/v1/workspaces/{ws_id}/nodes",
                json={
                    "parent_id": root_id,
                    "role": "assistant",
                    "content": "Sub-concept: Consensus Algorithms",
                },
            )
            child_id = c_resp.json()["id"]

            # Create Grandchild
            gc_resp = await client.post(
                f"/api/v1/workspaces/{ws_id}/nodes",
                json={
                    "parent_id": child_id,
                    "role": "assistant",
                    "content": "Leaf: Raft vs Paxos Trade-offs",
                },
            )
            gc_id = gc_resp.json()["id"]

            tool = TraverseLineageTool()

            # Test ancestor direction
            res_ancestors = await tool.run(
                {"node_id": gc_id, "direction": "ancestors", "workspace_id": ws_id},
                tool_call_id="call_lin_1",
            )
            assert not res_ancestors.is_error
            assert "Distributed Systems" in res_ancestors.content
            assert "Consensus Algorithms" in res_ancestors.content
            assert "Raft vs Paxos" in res_ancestors.content

            # Test children direction from root
            res_children = await tool.run(
                {"node_id": root_id, "direction": "children", "workspace_id": ws_id},
                tool_call_id="call_lin_2",
            )
            assert not res_children.is_error
            assert "Consensus Algorithms" in res_children.content
        finally:
            await client.delete(f"/api/v1/workspaces/{ws_id}")


@pytest.mark.asyncio
async def test_create_subnode_tool() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        ws_resp = await client.post(
            "/api/v1/workspaces",
            json={"name": "Subnode Creation Test"},
        )
        ws_id = ws_resp.json()["id"]

        try:
            # Create Parent
            r_resp = await client.post(
                f"/api/v1/workspaces/{ws_id}/nodes",
                json={"role": "user", "content": "What are microservices?"},
            )
            parent_id = r_resp.json()["id"]

            tool = CreateSubnodeTool()
            res = await tool.run(
                {
                    "parent_id": parent_id,
                    "content": "Research Finding: Independent deployability with bounded contexts.",
                    "highlighted_context": "Bounded Contexts",
                    "branch_type": "research",
                    "workspace_id": ws_id,
                },
                tool_call_id="call_create_1",
            )
            assert not res.is_error
            assert "node_id" in res.content

            # Verify the node actually exists in the workspace
            snap_resp = await client.get(f"/api/v1/workspaces/{ws_id}/graph")
            assert snap_resp.status_code == 200
            snapshot = snap_resp.json()
            node_contents = [n["content"] for n in snapshot["nodes"]]
            assert any("Independent deployability" in c for c in node_contents)
        finally:
            await client.delete(f"/api/v1/workspaces/{ws_id}")


@pytest.mark.asyncio
async def test_fetch_url_tool() -> None:
    tool = FetchUrlTool()
    # Test with invalid url or local unreachable domain to verify error handling
    res_err = await tool.run({"url": "http://invalid-non-existent-domain-12345.xyz"})
    assert res_err.is_error
    assert "Failed to fetch content" in res_err.content


@pytest.mark.asyncio
async def test_chat_completions_with_graph_tool_auto_workspace() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        ws_resp = await client.post(
            "/api/v1/workspaces",
            json={"name": "End to End Tool Auto WS Test"},
        )
        ws_id = ws_resp.json()["id"]

        try:
            # Create a node
            await client.post(
                f"/api/v1/workspaces/{ws_id}/nodes",
                json={
                    "role": "assistant",
                    "content": "Special Graph Knowledge: Quantum Key Distribution",
                },
            )

            # Invoke chat completion passing workspace_id at root request level,
            # with tool call arguments omitting workspace_id (testing auto-injection)
            payload = {
                "prompt": "Find info on Quantum Key Distribution",
                "provider": "mock",
                "workspace_id": ws_id,
                "enabled_tools": ["search_graph"],
                "metadata": {
                    "simulate_tool_call": {
                        "id": "call_auto_ws_1",
                        "name": "search_graph",
                        "arguments": {"query": "Quantum Key"},
                    }
                },
            }
            resp = await client.post("/api/v1/chat/completions", json=payload)
            assert resp.status_code == 200
            data = resp.json()
            trace = data["metadata"].get("toolTrace") or data["metadata"].get("tool_trace")
            assert len(trace) == 1
            assert trace[0]["name"] == "search_graph"
            assert not trace[0]["is_error"]
            assert "Quantum Key Distribution" in trace[0]["content"]
        finally:
            await client.delete(f"/api/v1/workspaces/{ws_id}")
