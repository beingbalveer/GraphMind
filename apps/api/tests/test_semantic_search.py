import pytest
from httpx import ASGITransport, AsyncClient
from main import app


@pytest.mark.asyncio
async def test_semantic_search_and_discovery_pipeline(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DEFAULT_EMBEDDING_PROVIDER", "mock")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Create Workspace
        create_resp = await client.post(
            "/api/v1/workspaces",
            json={
                "name": "Semantic Knowledge Test",
                "description": "Validating vector embeddings and cross-branch similarity",
            },
        )
        assert create_resp.status_code == 201
        ws_id = create_resp.json()["id"]

        # 2. Add multiple knowledge nodes
        node1_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={
                "id": f"node_raft_{ws_id}",
                "role": "assistant",
                "content": "Raft consensus achieves state machine replication via leader election and log entries.",
                "highlightedContext": "Raft Consensus",
            },
        )
        assert node1_resp.status_code == 201

        node2_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={
                "id": f"node_paxos_{ws_id}",
                "role": "assistant",
                "content": "Paxos is a family of protocols for solving consensus in a network of unreliable processors.",
                "highlightedContext": "Paxos Protocol",
            },
        )
        assert node2_resp.status_code == 201

        node3_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={
                "id": f"node_cooking_{ws_id}",
                "role": "assistant",
                "content": "To bake sourdough bread, ferment flour and water with wild yeast over 24 hours.",
            },
        )
        assert node3_resp.status_code == 201

        # 3. Execute Semantic Search for consensus query
        search_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/search/semantic",
            json={
                "query": "distributed leader election and consensus replication",
                "topK": 5,
                "minSimilarity": 0.0,
            },
        )
        assert search_resp.status_code == 200
        search_data = search_resp.json()
        assert search_data["workspace_id"] == ws_id
        assert len(search_data["results"]) >= 1

        # Check that results are returned with similarity scores
        top_result = search_data["results"][0]
        assert "similarity_score" in top_result
        assert "node_id" in top_result

        # 4. Discover Cross-Branch Links
        links_resp = await client.get(
            f"/api/v1/workspaces/{ws_id}/discover/links",
            params={"min_similarity": 0.0, "limit": 5},
        )
        assert links_resp.status_code == 200
        links_data = links_resp.json()
        assert "links" in links_data

        # 5. Clean up test workspace
        del_resp = await client.delete(f"/api/v1/workspaces/{ws_id}")
        assert del_resp.status_code == 204
