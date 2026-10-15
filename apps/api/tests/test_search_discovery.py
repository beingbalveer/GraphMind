"""LSI-041 — Search and semantic discovery acceptance locks.

These tests exercise the inventory-backed workspace search that reuses the
already-exposed graph (pgvector node) and hybrid (RAG file chunk) retrieval
services, and lock the ticket acceptance:

- results are permission-scoped to a single authorized workspace,
- node hits resolve to their canonical conversation root (``chat_id``) and file
  hits carry the file identity needed to open the library context,
- empty queries and unknown workspaces produce honest states.

Backend tests run against an isolated ``*_test`` database (enforced by
``apps/api/tests/conftest.py``); never against live or user data.
"""

import uuid

import pytest
from database import get_session_factory
from httpx import ASGITransport, AsyncClient
from main import app
from models.workspace import WorkspaceFile, WorkspaceFileChunk
from services.auth_service import create_access_token


def _client(user_id: str) -> AsyncClient:
    return AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        cookies={"access_token": create_access_token(user_id)},
    )


@pytest.mark.asyncio
async def test_search_returns_scoped_node_and_file_results(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A search returns graph node hits and hybrid file hits for the workspace.

    The exact-match node ranks first, its ``chatId`` resolves to the conversation
    root, and the file hit exposes the chunk needed to open the library context.
    """
    monkeypatch.setenv("DEFAULT_EMBEDDING_PROVIDER", "mock")

    async with _client("usr_default_admin") as client:
        created = await client.post(
            "/api/v1/workspaces",
            json={"name": "Search discovery fixture", "description": "LSI-041"},
        )
        assert created.status_code == 201
        ws_id = created.json()["id"]

        node_content = "Raft consensus achieves replication via leader election and log entries."
        root_id = f"node_{uuid.uuid4().hex[:12]}"
        root = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={"id": root_id, "role": "user", "content": node_content},
        )
        assert root.status_code == 201

        # A second, unrelated node must not outrank the exact match.
        await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={
                "id": f"node_{uuid.uuid4().hex[:12]}",
                "parent_id": root_id,
                "role": "assistant",
                "content": "Sourdough needs a long, slow fermentation.",
            },
        )

        # Seed an embedded file chunk reusing the existing hybrid retrieval tables.
        session_factory = get_session_factory()
        async with session_factory() as session:
            file_rec = WorkspaceFile(
                workspace_id=ws_id,
                name="distributed_systems.md",
                mime_type="text/markdown",
                file_category="document",
                storage_path="/tmp/distributed_systems.md",
                size_bytes=2048,
            )
            session.add(file_rec)
            await session.flush()
            session.add(
                WorkspaceFileChunk(
                    workspace_id=ws_id,
                    file_id=file_rec.id,
                    chunk_index=0,
                    content="Leader election uses randomized heartbeat timers before committing log entries.",
                    enriched_content=(
                        "[Document: distributed_systems.md | Section: Election]\n\n"
                        "Leader election uses randomized heartbeat timers before committing log entries."
                    ),
                    page_number=3,
                    section_header="Election",
                    token_count=12,
                    embedding=[0.05] * 768,
                )
            )
            await session.commit()

        search = await client.post(
            f"/api/v1/workspaces/{ws_id}/search",
            json={"query": node_content, "topK": 5, "minSimilarity": 0.0},
        )
        assert search.status_code == 200
        payload = search.json()
        assert payload["workspaceId"] == ws_id
        assert payload["query"] == node_content

        # Node leg: exact match ranks first and resolves to the conversation root.
        assert payload["totalNodes"] >= 1
        top_node = payload["nodes"][0]
        assert top_node["nodeId"] == root_id
        assert top_node["chatId"] == root_id
        assert top_node["similarityScore"] >= 0.9
        assert all(hit["chatId"] == root_id for hit in payload["nodes"])

        # File leg: hybrid retrieval surfaces the seeded chunk with provenance.
        assert payload["totalFiles"] >= 1
        top_file = payload["files"][0]
        assert top_file["fileId"]
        assert top_file["filename"] == "distributed_systems.md"
        assert "heartbeat" in top_file["snippet"]
        assert top_file["score"] >= 0.0

        assert (await client.delete(f"/api/v1/workspaces/{ws_id}")).status_code == 204


@pytest.mark.asyncio
async def test_search_is_permission_scoped(monkeypatch: pytest.MonkeyPatch) -> None:
    """A non-member cannot search a workspace they do not belong to."""
    monkeypatch.setenv("DEFAULT_EMBEDDING_PROVIDER", "mock")

    async with _client("usr_default_admin") as client:
        created = await client.post(
            "/api/v1/workspaces", json={"name": "Private search workspace"}
        )
        assert created.status_code == 201
        ws_id = created.json()["id"]
        await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={
                "id": f"node_{uuid.uuid4().hex[:12]}",
                "role": "user",
                "content": "Secret planning notes.",
            },
        )

        # The owner can search.
        owner_search = await client.post(
            f"/api/v1/workspaces/{ws_id}/search",
            json={"query": "Secret planning notes.", "topK": 5, "minSimilarity": 0.0},
        )
        assert owner_search.status_code == 200

    session_factory = get_session_factory()
    async with session_factory() as session:
        from models.user import User

        intruder = User(
            id=f"usr_{uuid.uuid4().hex[:12]}",
            email=f"{uuid.uuid4().hex}@example.com",
            full_name="Intruder",
            provider="local",
        )
        session.add(intruder)
        await session.commit()
        intruder_id = intruder.id

    async with _client(intruder_id) as client:
        denied = await client.post(
            f"/api/v1/workspaces/{ws_id}/search",
            json={"query": "Secret planning notes.", "topK": 5, "minSimilarity": 0.0},
        )
        assert denied.status_code == 404

    async with _client("usr_default_admin") as client:
        assert (await client.delete(f"/api/v1/workspaces/{ws_id}")).status_code == 204


@pytest.mark.asyncio
async def test_search_empty_and_unknown_states(monkeypatch: pytest.MonkeyPatch) -> None:
    """Empty queries return an honest empty result; unknown workspaces 404."""
    monkeypatch.setenv("DEFAULT_EMBEDDING_PROVIDER", "mock")

    async with _client("usr_default_admin") as client:
        created = await client.post(
            "/api/v1/workspaces", json={"name": "Empty search workspace"}
        )
        assert created.status_code == 201
        ws_id = created.json()["id"]

        empty = await client.post(
            f"/api/v1/workspaces/{ws_id}/search",
            json={"query": "   ", "topK": 5, "minSimilarity": 0.0},
        )
        assert empty.status_code == 200
        empty_payload = empty.json()
        assert empty_payload["nodes"] == []
        assert empty_payload["files"] == []
        assert empty_payload["totalNodes"] == 0
        assert empty_payload["totalFiles"] == 0

        unknown = await client.post(
            "/api/v1/workspaces/ws_does_not_exist/search",
            json={"query": "anything", "topK": 5, "minSimilarity": 0.0},
        )
        assert unknown.status_code == 404

        assert (await client.delete(f"/api/v1/workspaces/{ws_id}")).status_code == 204
