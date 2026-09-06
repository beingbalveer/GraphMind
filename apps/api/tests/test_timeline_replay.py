import pytest
from httpx import ASGITransport, AsyncClient
from main import app


@pytest.mark.asyncio
async def test_workspace_timeline_empty() -> None:
    """
    Verify timeline output for a fresh workspace with no nodes or concepts.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        ws_resp = await client.post(
            "/api/v1/workspaces",
            json={"name": "Empty Timeline Workspace"},
        )
        assert ws_resp.status_code == 201
        ws_id = ws_resp.json()["id"]

        resp = await client.get(f"/api/v1/workspaces/{ws_id}/curator/timeline")
        assert resp.status_code == 200
        data = resp.json()

        assert data["workspaceId"] == ws_id
        assert data["totalEvents"] == 0
        assert data["events"] == []
        assert data["milestones"] == []
        assert data["startTime"] is None
        assert data["endTime"] is None


@pytest.mark.asyncio
async def test_workspace_timeline_evolution_and_milestones() -> None:
    """
    Verify chronological event generation and milestone detection across nodes, branches, and concepts.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        ws_resp = await client.post(
            "/api/v1/workspaces",
            json={"name": "Knowledge Evolution Journey"},
        )
        assert ws_resp.status_code == 201
        ws_id = ws_resp.json()["id"]

        # 1. Add Root Node
        n1_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={"role": "user", "content": "How does python concurrency work?"},
        )
        assert n1_resp.status_code == 201
        n1_id = n1_resp.json()["id"]

        # 2. Add Assistant Reply
        n2_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={
                "parentId": n1_id,
                "role": "assistant",
                "content": "Python concurrency utilizes asyncio event loops and threads.",
            },
        )
        assert n2_resp.status_code == 201

        # 3. Add Second Child to Root -> Creates a Branch Split!
        n3_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={
                "parentId": n1_id,
                "role": "user",
                "content": "Let's explore multiprocessing instead of asyncio.",
            },
        )
        assert n3_resp.status_code == 201

        # 4. Add Concept and Master it
        c_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/concepts",
            json={
                "name": "Event Loops & Task Schedulers",
                "masteryLevel": "mastered",
                "confidenceScore": 0.92,
            },
        )
        assert c_resp.status_code == 201

        # 5. Fetch Timeline
        timeline_resp = await client.get(f"/api/v1/workspaces/{ws_id}/curator/timeline")
        assert timeline_resp.status_code == 200
        data = timeline_resp.json()

        assert data["workspaceId"] == ws_id
        assert data["totalEvents"] >= 4
        assert data["startTime"] is not None
        assert data["endTime"] is not None

        # Verify chronological ordering
        events = data["events"]
        for i in range(len(events) - 1):
            assert events[i]["timestamp"] <= events[i + 1]["timestamp"]

        # Verify Root Node milestone
        root_event = next(e for e in events if e["entityId"] == n1_id)
        assert root_event["isMilestone"] is True
        assert "Workspace Initialized" in root_event["title"]

        # Verify Branch Split milestone
        branch_event = next(e for e in events if e["entityId"] == n3_resp.json()["id"])
        assert branch_event["isMilestone"] is True
        assert branch_event["eventType"] == "branch_created"

        # Verify Concept Mastered milestone
        concept_id = c_resp.json()["id"]
        mastery_event = next((e for e in events if e["entityId"] == concept_id and e["eventType"] == "concept_mastered"), None)
        assert mastery_event is not None
        assert mastery_event["isMilestone"] is True
        assert "Mastery Achieved" in mastery_event["title"]

        # Check milestones array contains these
        assert len(data["milestones"]) >= 3


@pytest.mark.asyncio
async def test_workspace_timeline_404() -> None:
    """
    Verify 404 for unknown workspace.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/v1/workspaces/ws_nonexistent_0000/curator/timeline")
        assert resp.status_code == 404
