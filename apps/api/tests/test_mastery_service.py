
import pytest
from httpx import ASGITransport, AsyncClient
from main import app


@pytest.mark.asyncio
async def test_concept_mastery_lifecycle_and_api() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Create a Workspace
        ws_resp = await client.post(
            "/api/v1/workspaces",
            json={
                "name": "Machine Learning Foundations",
                "description": "Deep learning and vector embeddings mastery",
            },
        )
        assert ws_resp.status_code == 201
        ws_id = ws_resp.json()["id"]

        # 2. Add two Nodes to the Workspace
        n1_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={
                "role": "user",
                "content": "What is Cosine Similarity in Vector Spaces?",
            },
        )
        assert n1_resp.status_code == 201
        n1_id = n1_resp.json()["id"]

        n2_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={
                "parentId": n1_id,
                "role": "assistant",
                "content": "Cosine similarity computes the normalized dot product of two vectors.",
            },
        )
        assert n2_resp.status_code == 201
        n2_id = n2_resp.json()["id"]

        # 3. Check Initial Empty Mastery Summary
        summary_resp = await client.get(f"/api/v1/workspaces/{ws_id}/mastery")
        assert summary_resp.status_code == 200
        summary = summary_resp.json()
        assert summary["totalConcepts"] == 0
        assert summary["overallScore"] == 0.0
        assert summary["distribution"]["unexplored"] == 0

        # 4. Create Concept #1 with initial node linking
        c1_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/concepts",
            json={
                "name": "Cosine Similarity",
                "description": "Metric measuring cosine angle between inner-product vectors",
                "masteryLevel": "explored",
                "confidenceScore": 0.4,
                "nodeIds": [n1_id, n2_id],
                "metadata": {"category": "linear-algebra"},
            },
        )
        assert c1_resp.status_code == 201
        c1 = c1_resp.json()
        assert c1["name"] == "Cosine Similarity"
        assert c1["masteryLevel"] == "explored"
        assert c1["confidenceScore"] == 0.4
        assert set(c1["nodeIds"]) == {n1_id, n2_id}
        c1_id = c1["id"]

        # 5. Create Concept #2 (unexplored prerequisite)
        c2_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/concepts",
            json={
                "name": "Dot Product",
                "description": "Algebraic operation taking two equal-length sequences of numbers",
                "masteryLevel": "unexplored",
                "confidenceScore": 0.0,
            },
        )
        assert c2_resp.status_code == 201
        c2_id = c2_resp.json()["id"]

        # 6. Verify Deduplication when posting same concept name
        c1_dup_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/concepts",
            json={
                "name": "cosine similarity",  # case insensitive
                "masteryLevel": "mastered",
            },
        )
        assert c1_dup_resp.status_code == 201
        assert c1_dup_resp.json()["id"] == c1_id

        # 7. Update Concept #1 via Quiz Feedback (Simulate correct quiz answer)
        quiz_resp1 = await client.patch(
            f"/api/v1/workspaces/{ws_id}/concepts/{c1_id}",
            json={"quizResult": True},
        )
        assert quiz_resp1.status_code == 200
        c1_quiz1 = quiz_resp1.json()
        assert c1_quiz1["timesQuizzed"] == 1
        assert c1_quiz1["timesCorrect"] == 1
        assert c1_quiz1["confidenceScore"] == 1.0
        # Needs 2 quizzes to achieve "mastered"
        assert c1_quiz1["masteryLevel"] == "quizzed"

        # Simulate 2nd correct quiz answer -> reaches "mastered"
        quiz_resp2 = await client.patch(
            f"/api/v1/workspaces/{ws_id}/concepts/{c1_id}",
            json={"quizResult": True},
        )
        assert quiz_resp2.status_code == 200
        c1_quiz2 = quiz_resp2.json()
        assert c1_quiz2["timesQuizzed"] == 2
        assert c1_quiz2["timesCorrect"] == 2
        assert c1_quiz2["confidenceScore"] == 1.0
        assert c1_quiz2["masteryLevel"] == "mastered"

        # 8. Link Concept #2 to Node #1
        link_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes/{n1_id}/concepts",
            json={"conceptIds": [c2_id]},
        )
        assert link_resp.status_code == 200
        linked_concepts = link_resp.json()
        assert any(c["id"] == c2_id for c in linked_concepts)

        # 9. Verify Node Concept Retrieval
        node_concepts_resp = await client.get(
            f"/api/v1/workspaces/{ws_id}/nodes/{n1_id}/concepts"
        )
        assert node_concepts_resp.status_code == 200
        n1_concepts = node_concepts_resp.json()
        assert len(n1_concepts) == 2
        n1_concept_names = {c["name"] for c in n1_concepts}
        assert "Cosine Similarity" in n1_concept_names
        assert "Dot Product" in n1_concept_names

        # 10. Verify Workspace Mastery Summary
        final_summary_resp = await client.get(f"/api/v1/workspaces/{ws_id}/mastery")
        assert final_summary_resp.status_code == 200
        final_summary = final_summary_resp.json()
        assert final_summary["totalConcepts"] == 2
        assert final_summary["overallScore"] == 0.5  # (1.0 + 0.0) / 2
        assert final_summary["distribution"]["mastered"] == 1
        assert final_summary["distribution"]["unexplored"] == 1
        assert len(final_summary["topMastered"]) == 1
        assert final_summary["topMastered"][0]["name"] == "Cosine Similarity"
        assert len(final_summary["needingReview"]) == 0  # unexplored is not needingReview

        # 11. Delete a Concept
        del_resp = await client.delete(f"/api/v1/workspaces/{ws_id}/concepts/{c2_id}")
        assert del_resp.status_code == 200
        assert del_resp.json()["deleted"] is True

        # Verify concept is deleted
        get_deleted = await client.get(f"/api/v1/workspaces/{ws_id}/concepts/{c2_id}")
        assert get_deleted.status_code == 404
