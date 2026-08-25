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

        # 6. List Chats in Workspace
        chats_resp = await client.get(f"/api/v1/workspaces/{ws_id}/chats")
        assert chats_resp.status_code == 200
        chats_data = chats_resp.json()
        assert chats_data["total"] == 1
        assert chats_data["chats"][0]["id"] == f"node_root_{ws_id}"
        assert chats_data["chats"][0]["nodeCount"] == 2
        assert chats_data["chats"][0]["pinned"] is False

        # 6a. Rename & Pin Chat
        patch_resp = await client.patch(
            f"/api/v1/workspaces/{ws_id}/chats/{f'node_root_{ws_id}'}",
            json={"title": "Raft Deep Dive", "pinned": True},
        )
        assert patch_resp.status_code == 200

        # Verify updated chat list reflects new title and pinned state
        chats_updated_resp = await client.get(f"/api/v1/workspaces/{ws_id}/chats")
        assert chats_updated_resp.status_code == 200
        updated_chat = chats_updated_resp.json()["chats"][0]
        assert updated_chat["title"] == "Raft Deep Dive"
        assert updated_chat["pinned"] is True

        # 6b. Update Node Metadata (Branch tab rename & pin)
        node_patch_resp = await client.patch(
            f"/api/v1/workspaces/{ws_id}/nodes/{f'node_child_{ws_id}'}",
            json={"metadata": {"title": "Leader Election Tab", "pinned": True}},
        )
        assert node_patch_resp.status_code == 200
        node_patch_data = node_patch_resp.json()
        assert node_patch_data["metadata"]["title"] == "Leader Election Tab"
        assert node_patch_data["metadata"]["pinned"] is True

        # 7. Apply Delta Updates (auto-save moved nodes and viewport)

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

        # 8. Delete Single Chat Tree
        del_chat_resp = await client.delete(
            f"/api/v1/workspaces/{ws_id}/chats/{f'node_root_{ws_id}'}"
        )

        assert del_chat_resp.status_code == 204

        # Verify chat tree nodes are removed
        chats_after = await client.get(f"/api/v1/workspaces/{ws_id}/chats")
        assert chats_after.json()["total"] == 0

        # 9. Delete Workspace
        del_resp = await client.delete(f"/api/v1/workspaces/{ws_id}")
        assert del_resp.status_code == 204

        # 10. Verify 404 after deletion
        get_404 = await client.get(f"/api/v1/workspaces/{ws_id}")
        assert get_404.status_code == 404
