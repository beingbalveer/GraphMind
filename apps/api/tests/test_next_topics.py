import pytest
from httpx import ASGITransport, AsyncClient
from main import app


@pytest.mark.asyncio
async def test_next_topics_empty_workspace() -> None:
    """
    Test that an empty workspace recommends foundational gateway topics.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        ws_resp = await client.post(
            "/api/v1/workspaces",
            json={"name": "Empty Fresh Workspace"},
        )
        assert ws_resp.status_code == 201
        ws_id = ws_resp.json()["id"]

        resp = await client.get(f"/api/v1/workspaces/{ws_id}/curator/next-topics?limit=3")
        assert resp.status_code == 200
        data = resp.json()

        assert data["workspaceId"] == ws_id
        assert len(data["recommendations"]) == 3
        # Should include foundational topics
        for rec in data["recommendations"]:
            assert rec["importance"] == "foundational"
            assert len(rec["suggestedPrompt"]) > 10
            assert rec["readiness"] in ("ready_to_unlock", "exploratory")


@pytest.mark.asyncio
async def test_next_topics_satisfied_prerequisites() -> None:
    """
    Test that mastering prerequisites unlocks downstream topics with ready_to_unlock status.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        ws_resp = await client.post(
            "/api/v1/workspaces",
            json={"name": "Async Concurrency Journey"},
        )
        assert ws_resp.status_code == 201
        ws_id = ws_resp.json()["id"]

        # Master prerequisite: Coroutines & Tasks
        await client.post(
            f"/api/v1/workspaces/{ws_id}/concepts",
            json={
                "name": "Coroutines & Tasks",
                "masteryLevel": "mastered",
                "confidenceScore": 0.9,
            },
        )

        # Master prerequisite: Event Loops & Task Schedulers
        await client.post(
            f"/api/v1/workspaces/{ws_id}/concepts",
            json={
                "name": "Event Loops & Task Schedulers",
                "masteryLevel": "mastered",
                "confidenceScore": 0.95,
            },
        )

        # Request Next Topics
        resp = await client.get(f"/api/v1/workspaces/{ws_id}/curator/next-topics?limit=3")
        assert resp.status_code == 200
        data = resp.json()

        assert "Python Concurrency" in data["activeFrontierDomains"]

        # The top recommendation should be "Asyncio High-Level APIs"
        top = data["recommendations"][0]
        assert top["id"] == "python:asyncio"
        assert top["topicName"] == "Asyncio High-Level APIs"
        assert top["readiness"] == "ready_to_unlock"
        assert "Event Loops & Task Schedulers" in top["unlockedBy"]
        assert len(top["futureUnlocks"]) > 0
        assert "Natural progression" in top["rationale"]


@pytest.mark.asyncio
async def test_next_topics_cross_domain_synergy() -> None:
    """
    Test that bridging concepts receive synergy bonuses when both domains are active.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        ws_resp = await client.post(
            "/api/v1/workspaces",
            json={"name": "Fullstack Async DB"},
        )
        assert ws_resp.status_code == 201
        ws_id = ws_resp.json()["id"]

        # Master concepts in two domains:
        # 1. Database: ACID Transactions & Connection Pooling
        await client.post(
            f"/api/v1/workspaces/{ws_id}/concepts",
            json={
                "name": "ACID Transactions & Isolation Levels",
                "masteryLevel": "mastered",
                "confidenceScore": 0.9,
            },
        )
        await client.post(
            f"/api/v1/workspaces/{ws_id}/concepts",
            json={
                "name": "Connection Pooling & Pool Sizing",
                "masteryLevel": "mastered",
                "confidenceScore": 0.9,
            },
        )

        # 2. Python: Asyncio High-Level APIs
        await client.post(
            f"/api/v1/workspaces/{ws_id}/concepts",
            json={
                "name": "Asyncio High-Level APIs",
                "masteryLevel": "mastered",
                "confidenceScore": 0.9,
            },
        )

        # Request recommendations
        resp = await client.get(f"/api/v1/workspaces/{ws_id}/curator/next-topics?limit=5")
        assert resp.status_code == 200
        data = resp.json()

        # SQLAlchemy Async Engine & Sessions bridges both domains and should be recommended as ready_to_unlock
        rec_ids = [r["id"] for r in data["recommendations"]]
        assert "db:sqlalchemy_async" in rec_ids
        sa_rec = next(r for r in data["recommendations"] if r["id"] == "db:sqlalchemy_async")
        assert sa_rec["readiness"] == "ready_to_unlock"
        assert "Connection Pooling & Pool Sizing" in sa_rec["unlockedBy"]


@pytest.mark.asyncio
async def test_next_topics_404_workspace() -> None:
    """
    Verify 404 returned for unknown workspace.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/v1/workspaces/ws_invalid_xyz/curator/next-topics")
        assert resp.status_code == 404
