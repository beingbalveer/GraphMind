import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from main import app


@pytest.fixture(autouse=True)
def setup_mock_embeddings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DEFAULT_EMBEDDING_PROVIDER", "mock")


def unique_email(prefix: str = "branch") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}@example.com"


def get_error_message(resp) -> str:
    body = resp.json()
    if isinstance(body, dict):
        if "error" in body and isinstance(body["error"], dict) and "message" in body["error"]:
            return str(body["error"]["message"])
        if "detail" in body:
            return str(body["detail"])
    return str(body)


@pytest.mark.asyncio
async def test_create_node_cross_workspace_parent_rejected() -> None:
    """Verifies that creating a node with a parent from a foreign workspace returns 404."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Create Workspace A and root node
        ws_a_resp = await client.post("/api/v1/workspaces", json={"name": "Workspace A"})
        assert ws_a_resp.status_code == 201
        ws_a_id = ws_a_resp.json()["id"]

        node_a_resp = await client.post(
            f"/api/v1/workspaces/{ws_a_id}/nodes",
            json={"role": "user", "content": "Root topic in workspace A"},
        )
        assert node_a_resp.status_code == 201
        node_a_id = node_a_resp.json()["id"]

        # Create Workspace B
        ws_b_resp = await client.post("/api/v1/workspaces", json={"name": "Workspace B"})
        assert ws_b_resp.status_code == 201
        ws_b_id = ws_b_resp.json()["id"]

        # Attempt to create node in Workspace B with parent from Workspace A
        cross_resp = await client.post(
            f"/api/v1/workspaces/{ws_b_id}/nodes",
            json={
                "role": "assistant",
                "content": "Cross-workspace branch attempt",
                "parentId": node_a_id,
            },
        )
        assert cross_resp.status_code == 404
        assert "not found" in get_error_message(cross_resp).lower()


@pytest.mark.asyncio
async def test_create_node_stale_or_nonexistent_parent_rejected() -> None:
    """Verifies that creating a node with nonexistent parent returns 404 instead of fallback to root."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        ws_resp = await client.post("/api/v1/workspaces", json={"name": "Stale Parent Test"})
        assert ws_resp.status_code == 201
        ws_id = ws_resp.json()["id"]

        resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={
                "role": "user",
                "content": "Orphan branch attempt",
                "parentId": "node_that_never_existed_9999",
            },
        )
        assert resp.status_code == 404
        assert "not found" in get_error_message(resp).lower()


@pytest.mark.asyncio
async def test_create_node_deleted_origin_rejected() -> None:
    """Verifies that branching from a deleted parent node returns 404."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        ws_resp = await client.post("/api/v1/workspaces", json={"name": "Deleted Origin Test"})
        assert ws_resp.status_code == 201
        ws_id = ws_resp.json()["id"]

        # Create root
        root_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={"role": "user", "content": "Root Question"},
        )
        assert root_resp.status_code == 201
        root_id = root_resp.json()["id"]

        # Create child
        child_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={"role": "assistant", "content": "Temporary child", "parentId": root_id},
        )
        assert child_resp.status_code == 201
        child_id = child_resp.json()["id"]

        # Delete child
        del_resp = await client.delete(f"/api/v1/workspaces/{ws_id}/nodes/{child_id}")
        assert del_resp.status_code == 204

        # Attempt to branch from deleted child
        stale_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={"role": "user", "content": "Branching from deleted", "parentId": child_id},
        )
        assert stale_resp.status_code == 404
        assert "not found" in get_error_message(stale_resp).lower()


@pytest.mark.asyncio
async def test_create_node_direct_cycle_rejected() -> None:
    """Verifies that setting a node's parent to itself is rejected with 422."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        ws_resp = await client.post("/api/v1/workspaces", json={"name": "Self Cycle Test"})
        assert ws_resp.status_code == 201
        ws_id = ws_resp.json()["id"]

        cycle_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={
                "id": "node_self_cycle",
                "role": "user",
                "content": "Self looping node",
                "parentId": "node_self_cycle",
            },
        )
        assert cycle_resp.status_code == 422
        assert "cannot be the node itself" in get_error_message(cycle_resp).lower()


@pytest.mark.asyncio
async def test_reparent_node_descendant_cycle_rejected() -> None:
    """Verifies that re-parenting a node to one of its descendants is rejected with 422."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        ws_resp = await client.post("/api/v1/workspaces", json={"name": "Descendant Cycle Test"})
        assert ws_resp.status_code == 201
        ws_id = ws_resp.json()["id"]

        # Create A (root) -> B -> C
        node_a = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={"id": "node_a", "role": "user", "content": "Node A"},
        )
        assert node_a.status_code == 201

        node_b = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={"id": "node_b", "parentId": "node_a", "role": "assistant", "content": "Node B"},
        )
        assert node_b.status_code == 201

        node_c = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={"id": "node_c", "parentId": "node_b", "role": "user", "content": "Node C"},
        )
        assert node_c.status_code == 201

        # Attempt to make Node B a child of Node C (creating cycle B -> C -> B)
        cycle_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={"id": "node_b", "parentId": "node_c", "role": "assistant", "content": "Node B"},
        )
        assert cycle_resp.status_code == 422
        assert "cycle detected" in get_error_message(cycle_resp).lower()


@pytest.mark.asyncio
async def test_reparent_root_node_to_parent_rejected() -> None:
    """Verifies that an existing root conversation node cannot be demoted to a child branch."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        ws_resp = await client.post("/api/v1/workspaces", json={"name": "Root Reparent Test"})
        assert ws_resp.status_code == 201
        ws_id = ws_resp.json()["id"]

        root1 = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={"id": "root_1", "role": "user", "content": "Chat 1 Root"},
        )
        assert root1.status_code == 201

        root2 = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={"id": "root_2", "role": "user", "content": "Chat 2 Root"},
        )
        assert root2.status_code == 201

        # Attempt to attach root_1 to root_2
        demote_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={"id": "root_1", "parentId": "root_2", "role": "user", "content": "Chat 1 Root"},
        )
        assert demote_resp.status_code == 422
        assert "cannot attach an existing root" in get_error_message(demote_resp).lower()


@pytest.mark.asyncio
async def test_reparent_branch_to_different_root_rejected() -> None:
    """Verifies that a branch cannot be migrated across different conversation roots."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        ws_resp = await client.post("/api/v1/workspaces", json={"name": "Cross Root Reparent Test"})
        assert ws_resp.status_code == 201
        ws_id = ws_resp.json()["id"]

        root1 = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={"id": "r1", "role": "user", "content": "Root 1"},
        )
        child1 = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={"id": "c1", "parentId": "r1", "role": "assistant", "content": "Child 1"},
        )
        assert root1.status_code == 201
        assert child1.status_code == 201

        root2 = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={"id": "r2", "role": "user", "content": "Root 2"},
        )
        child2 = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={"id": "c2", "parentId": "r2", "role": "assistant", "content": "Child 2"},
        )
        assert root2.status_code == 201
        assert child2.status_code == 201

        # Attempt to move c1 from root 1's tree to root 2's tree under c2
        move_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={"id": "c1", "parentId": "c2", "role": "assistant", "content": "Child 1 moved"},
        )
        assert move_resp.status_code == 422
        assert "different conversation roots" in get_error_message(move_resp).lower()


@pytest.mark.asyncio
async def test_create_node_invalid_role_rejected() -> None:
    """Verifies that invalid roles are rejected with 422."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        ws_resp = await client.post("/api/v1/workspaces", json={"name": "Role Test"})
        assert ws_resp.status_code == 201
        ws_id = ws_resp.json()["id"]

        resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={"role": "superadmin_hacker", "content": "Malicious payload"},
        )
        assert resp.status_code == 422
        assert "invalid node role" in get_error_message(resp).lower()


@pytest.mark.asyncio
async def test_create_node_invalid_quote_empty_or_whitespace() -> None:
    """Verifies that empty or whitespace-only quotes are rejected with 422."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        ws_resp = await client.post("/api/v1/workspaces", json={"name": "Empty Quote Test"})
        assert ws_resp.status_code == 201
        ws_id = ws_resp.json()["id"]

        resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={
                "role": "user",
                "content": "Question",
                "highlightedContext": "   ",
            },
        )
        assert resp.status_code == 422
        assert "cannot be empty" in get_error_message(resp).lower()


@pytest.mark.asyncio
async def test_create_node_invalid_quote_oversized() -> None:
    """Verifies that oversized quotes (> 2000 chars) are rejected with 422."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        ws_resp = await client.post("/api/v1/workspaces", json={"name": "Oversized Quote Test"})
        assert ws_resp.status_code == 201
        ws_id = ws_resp.json()["id"]

        oversized_quote = "A" * 2001
        resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={
                "role": "user",
                "content": "Question with huge quote",
                "highlightedContext": oversized_quote,
            },
        )
        assert resp.status_code == 422
        assert "exceeds maximum length" in get_error_message(resp).lower()


@pytest.mark.asyncio
async def test_chat_stream_cross_workspace_parent_rejected() -> None:
    """Verifies that streaming with parent_node_id from another workspace is rejected with 404."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        ws_a = await client.post("/api/v1/workspaces", json={"name": "Stream WS A"})
        ws_b = await client.post("/api/v1/workspaces", json={"name": "Stream WS B"})
        ws_a_id = ws_a.json()["id"]
        ws_b_id = ws_b.json()["id"]

        root_a = await client.post(
            f"/api/v1/workspaces/{ws_a_id}/nodes",
            json={"role": "user", "content": "Root A"},
        )
        root_a_id = root_a.json()["id"]

        stream_resp = await client.post(
            "/api/v1/chat/stream",
            json={
                "workspace_id": ws_b_id,
                "parent_node_id": root_a_id,
                "prompt": "Streaming to WS B with parent from WS A",
                "provider": "mock",
            },
        )
        assert stream_resp.status_code == 404
        assert "parent node not found" in get_error_message(stream_resp).lower()


@pytest.mark.asyncio
async def test_chat_stream_stale_parent_rejected() -> None:
    """Verifies that streaming with a non-existent parent_node_id is rejected with 404."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        ws = await client.post("/api/v1/workspaces", json={"name": "Stale Stream WS"})
        ws_id = ws.json()["id"]

        stream_resp = await client.post(
            "/api/v1/chat/stream",
            json={
                "workspace_id": ws_id,
                "parent_node_id": "stale_node_does_not_exist",
                "prompt": "Branching from nothing",
                "provider": "mock",
            },
        )
        assert stream_resp.status_code == 404
        assert "parent node not found" in get_error_message(stream_resp).lower()


@pytest.mark.asyncio
async def test_chat_stream_ephemeral_cycle_rejected() -> None:
    """Verifies that an ephemeral tree with a cycle is rejected with 422."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        tree = {
            "id": "cycle_tree",
            "root_node_id": "n1",
            "active_node_id": "n2",
            "nodes": {
                "n1": {
                    "id": "n1",
                    "parentId": "n2",  # Cycle: n1 -> n2 -> n1
                    "role": "user",
                    "content": "First",
                    "childrenIds": ["n2"],
                    "createdAt": "2026-08-21T12:00:00Z",
                },
                "n2": {
                    "id": "n2",
                    "parentId": "n1",
                    "role": "assistant",
                    "content": "Second",
                    "childrenIds": ["n1"],
                    "createdAt": "2026-08-21T12:00:01Z",
                },
            },
            "createdAt": "2026-08-21T12:00:00Z",
            "updatedAt": "2026-08-21T12:00:01Z",
        }

        resp = await client.post(
            "/api/v1/chat/stream",
            json={
                "prompt": "Prompt on cyclical tree",
                "parent_node_id": "n2",
                "tree": tree,
                "provider": "mock",
            },
        )
        assert resp.status_code == 422
        assert "cycle detected" in get_error_message(resp).lower()


@pytest.mark.asyncio
async def test_chat_stream_ephemeral_stale_parent_rejected() -> None:
    """Verifies that specifying a parent_node_id missing from the tree returns 404."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        tree = {
            "id": "valid_tree",
            "root_node_id": "n1",
            "active_node_id": "n1",
            "nodes": {
                "n1": {
                    "id": "n1",
                    "parentId": None,
                    "role": "user",
                    "content": "Root",
                    "childrenIds": [],
                    "createdAt": "2026-08-21T12:00:00Z",
                },
            },
            "createdAt": "2026-08-21T12:00:00Z",
            "updatedAt": "2026-08-21T12:00:01Z",
        }

        resp = await client.post(
            "/api/v1/chat/stream",
            json={
                "prompt": "Prompt targeting missing parent",
                "parent_node_id": "missing_node_999",
                "tree": tree,
                "provider": "mock",
            },
        )
        assert resp.status_code == 404
        assert "not found" in get_error_message(resp).lower()


@pytest.mark.asyncio
async def test_chat_stream_quote_without_parent_rejected() -> None:
    """Verifies that providing a quote without parent or conversation history returns 422."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/chat/stream",
            json={
                "prompt": "Quote with no parent",
                "highlighted_context": "floating quote excerpt",
                "provider": "mock",
            },
        )
        assert resp.status_code == 422
        assert "requires a parent node" in get_error_message(resp).lower()


@pytest.mark.asyncio
async def test_continuation_from_user_and_assistant_nodes() -> None:
    """Verifies that branches can cleanly continue from either user or assistant nodes with proper lineage."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        ws_resp = await client.post("/api/v1/workspaces", json={"name": "Continuation Test"})
        assert ws_resp.status_code == 201
        ws_id = ws_resp.json()["id"]

        # 1. User Root Node
        root_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={"role": "user", "content": "How do database indexes work?"},
        )
        assert root_resp.status_code == 201
        root_id = root_resp.json()["id"]

        # 2. Assistant Response Node
        asst_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={
                "role": "assistant",
                "content": "B-trees and LSM-trees are common index structures.",
                "parentId": root_id,
            },
        )
        assert asst_resp.status_code == 201
        asst_id = asst_resp.json()["id"]

        # 3. Branch continuing from ASSISTANT node
        branch_asst_stream = await client.post(
            "/api/v1/chat/stream",
            json={
                "workspace_id": ws_id,
                "parent_node_id": asst_id,
                "prompt": "Deep dive into LSM trees",
                "highlighted_context": "LSM-trees",
                "provider": "mock",
            },
        )
        assert branch_asst_stream.status_code == 200
        assert "text/event-stream" in branch_asst_stream.headers.get("content-type", "")

        # 4. Alternative branch continuing from USER root node
        branch_user_stream = await client.post(
            "/api/v1/chat/stream",
            json={
                "workspace_id": ws_id,
                "parent_node_id": root_id,
                "prompt": "Actually, explain hash indexes instead",
                "provider": "mock",
            },
        )
        assert branch_user_stream.status_code == 200
        assert "text/event-stream" in branch_user_stream.headers.get("content-type", "")
