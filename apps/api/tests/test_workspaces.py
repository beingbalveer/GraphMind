import pytest
from httpx import ASGITransport, AsyncClient
from main import app


@pytest.mark.asyncio
async def test_workspace_crud_lifecycle() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Create Workspace
        create_resp = await client.post(
            "/api/v1/workspaces",
            json={
                "name": "Distributed Systems Research",
                "description": "Exploration of consensus and vector clocks",
            },
        )
        assert create_resp.status_code == 201
        ws_data = create_resp.json()
        ws_id = ws_data["id"]
        assert ws_data["name"] == "Distributed Systems Research"
        assert ws_data["nodeCount"] == 0

        # 2. List Workspaces
        list_resp = await client.get("/api/v1/workspaces")
        assert list_resp.status_code == 200
        list_data = list_resp.json()
        assert any(w["id"] == ws_id for w in list_data["workspaces"])

        # 3. Add Root Node
        root_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={
                "id": f"node_root_{ws_id}",
                "role": "user",
                "content": "Explain Raft Consensus Algorithm",
                "positionX": 100.0,
                "positionY": 100.0,
            },
        )
        assert root_resp.status_code == 201
        root_data = root_resp.json()
        assert root_data["id"] == f"node_root_{ws_id}"

        # 4. Add Child Node (spawning edge)
        child_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={
                "id": f"node_child_{ws_id}",
                "parentId": f"node_root_{ws_id}",
                "role": "assistant",
                "content": "Raft is a consensus algorithm designed for understandability.",
                "highlightedContext": "Leader Election",
                "positionX": 100.0,
                "positionY": 300.0,
            },
        )
        assert child_resp.status_code == 201

        # 5. Fetch Full Graph Snapshot
        graph_resp = await client.get(f"/api/v1/workspaces/{ws_id}/graph")
        assert graph_resp.status_code == 200
        graph_data = graph_resp.json()
        assert len(graph_data["nodes"]) == 2
        assert len(graph_data["edges"]) == 1
        assert graph_data["edges"][0]["sourceId"] == f"node_root_{ws_id}"
        assert graph_data["edges"][0]["targetId"] == f"node_child_{ws_id}"

        # 6. Apply Delta Updates (auto-save moved nodes and viewport)
        delta_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/delta",
            json={
                "workspaceUpdate": {"viewportX": 250.0, "viewportY": 150.0, "zoom": 1.1},
                "movedNodes": [
                    {"id": f"node_child_{ws_id}", "positionX": 120.0, "positionY": 340.0}
                ],
            },
        )
        assert delta_resp.status_code == 200

        # 7. Delete Workspace
        del_resp = await client.delete(f"/api/v1/workspaces/{ws_id}")
        assert del_resp.status_code == 204

        # 8. Verify 404 after deletion
        get_404 = await client.get(f"/api/v1/workspaces/{ws_id}")
        assert get_404.status_code == 404
