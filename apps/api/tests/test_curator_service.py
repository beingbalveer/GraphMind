import pytest
from httpx import ASGITransport, AsyncClient
from main import app
from services.curator_service import CuratorService


@pytest.mark.asyncio
async def test_domain_concept_matching() -> None:
    """
    Test domain ontology graph catalog and fuzzy/alias matching.
    """
    graph = CuratorService.get_domain_graph()
    assert len(graph) >= 15
    assert "python:event_loop" in graph
    assert "db:acid_transactions" in graph
    assert "ai:ann_indexing_hnsw" in graph

    # Test exact name match
    m1 = CuratorService.find_matching_domain_concept("Event Loops & Task Schedulers")
    assert m1 is not None
    assert m1.id == "python:event_loop"

    # Test alias match
    m2 = CuratorService.find_matching_domain_concept("asyncio")
    assert m2 is not None
    assert m2.id == "python:asyncio"

    # Test substring/variant alias match
    m3 = CuratorService.find_matching_domain_concept("FastAPI WebSocket streaming")
    assert m3 is not None
    assert m3.id == "python:fastapi_concurrency"

    # Test AI vector matching
    m4 = CuratorService.find_matching_domain_concept("pgvector hnsw indexing")
    assert m4 is not None
    assert m4.id == "ai:ann_indexing_hnsw"


@pytest.mark.asyncio
async def test_gap_analysis_missing_prerequisite_flow() -> None:
    """
    Test detection of missing prerequisites when downstream concepts are explored.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Create a Workspace
        ws_resp = await client.post(
            "/api/v1/workspaces",
            json={
                "name": "Python Async Systems Workspace",
                "description": "Concurrency and async architecture study",
            },
        )
        assert ws_resp.status_code == 201
        ws_id = ws_resp.json()["id"]

        # 2. Add an advanced concept: "Asyncio Tasks" (mastery: explored)
        # Prerequisite "Event Loops & Task Schedulers" is completely missing!
        c1_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/concepts",
            json={
                "name": "Asyncio High-Level APIs",
                "masteryLevel": "explored",
                "confidenceScore": 0.75,
            },
        )
        assert c1_resp.status_code == 201

        # 3. Request Knowledge Gap Analysis
        gaps_resp = await client.get(f"/api/v1/workspaces/{ws_id}/curator/gaps")
        assert gaps_resp.status_code == 200
        data = gaps_resp.json()

        assert data["workspaceId"] == ws_id
        assert data["totalGaps"] >= 1
        assert data["highSeverityCount"] >= 1
        assert "Python Concurrency" in data["exploredDomains"]

        # Find the event loop gap
        event_loop_gap = next((g for g in data["gaps"] if g["id"] == "python:event_loop"), None)
        assert event_loop_gap is not None
        assert event_loop_gap["conceptName"] == "Event Loops & Task Schedulers"
        assert event_loop_gap["severity"] == "high"
        assert event_loop_gap["status"] == "missing"
        assert "Asyncio High-Level APIs" in event_loop_gap["dependentConcepts"]
        assert "Event Loop is essential" in event_loop_gap["rationale"]

        # 4. Adopt the gap directly into the workspace
        adopt_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/curator/gaps/python:event_loop/adopt",
            json={"initialMasteryLevel": "unexplored"},
        )
        assert adopt_resp.status_code == 201
        adopted_concept = adopt_resp.json()
        assert adopted_concept["name"] == "Event Loops & Task Schedulers"
        assert adopted_concept["masteryLevel"] == "unexplored"
        assert adopted_concept["metadata"]["source"] == "knowledge_curator"

        # 5. Re-run Gap Analysis: Status changes from "missing" to "unexplored"
        re_gaps_resp = await client.get(f"/api/v1/workspaces/{ws_id}/curator/gaps")
        assert re_gaps_resp.status_code == 200
        re_data = re_gaps_resp.json()
        re_event_loop_gap = next((g for g in re_data["gaps"] if g["id"] == "python:event_loop"), None)
        assert re_event_loop_gap is not None
        assert re_event_loop_gap["status"] == "unexplored"

        # 6. Now simulate mastering the Event Loop
        patch_resp = await client.patch(
            f"/api/v1/workspaces/{ws_id}/concepts/{adopted_concept['id']}",
            json={"masteryLevel": "mastered", "confidenceScore": 0.95},
        )
        assert patch_resp.status_code == 200

        # Check gap analysis again: Event Loop is now resolved!
        final_gaps_resp = await client.get(f"/api/v1/workspaces/{ws_id}/curator/gaps")
        assert final_gaps_resp.status_code == 200
        final_data = final_gaps_resp.json()
        event_loop_in_gaps = any(g["id"] == "python:event_loop" for g in final_data["gaps"])
        assert not event_loop_in_gaps


@pytest.mark.asyncio
async def test_gap_analysis_weak_retention() -> None:
    """
    Test that low-confidence prerequisites are flagged as weak_retention gaps.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        ws_resp = await client.post(
            "/api/v1/workspaces",
            json={"name": "Database Engineering Workspace"},
        )
        assert ws_resp.status_code == 201
        ws_id = ws_resp.json()["id"]

        # Prerequisite: ACID Transactions, but user has low confidence (0.2)
        await client.post(
            f"/api/v1/workspaces/{ws_id}/concepts",
            json={
                "name": "ACID Transactions & Isolation Levels",
                "masteryLevel": "explored",
                "confidenceScore": 0.2,
            },
        )

        # Downstream: Connection Pooling (mastery: explored)
        await client.post(
            f"/api/v1/workspaces/{ws_id}/concepts",
            json={
                "name": "Connection Pooling & Pool Sizing",
                "masteryLevel": "explored",
                "confidenceScore": 0.85,
            },
        )

        # Gap analysis should flag ACID as weak_retention
        gaps_resp = await client.get(f"/api/v1/workspaces/{ws_id}/curator/gaps")
        assert gaps_resp.status_code == 200
        data = gaps_resp.json()

        acid_gap = next((g for g in data["gaps"] if g["id"] == "db:acid_transactions"), None)
        assert acid_gap is not None
        assert acid_gap["status"] == "weak_retention"
        assert acid_gap["severity"] == "medium"
        assert "Connection Pooling & Pool Sizing" in acid_gap["dependentConcepts"]


@pytest.mark.asyncio
async def test_curator_workspace_not_found() -> None:
    """
    Verify 404 is returned for non-existent workspace IDs.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/v1/workspaces/ws_nonexistent_9999/curator/gaps")
        assert resp.status_code == 404
