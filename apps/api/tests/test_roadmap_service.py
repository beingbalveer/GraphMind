import pytest
from httpx import ASGITransport, AsyncClient
from main import app
from services.roadmap_service import RoadmapService


def test_roadmap_prompt_and_fallback_generation() -> None:
    # 1. Test prompt generation
    prompt = RoadmapService._build_prompt("Learn Rust", "beginner", "concepts")
    assert "Learn Rust" in prompt
    assert "beginner" in prompt
    assert "concepts" in prompt

    # 2. Test valid JSON parsing
    raw_json = """
    ```json
    {
      "title": "Roadmap: Rust from Scratch",
      "description": "Mastering systems programming with Rust.",
      "topics": [
        {
          "id": "t1",
          "title": "Rust Fundamentals",
          "description": "Syntax and ownership.",
          "depth": 1,
          "prerequisites": [],
          "keyConcepts": ["Cargo", "Borrowing", "Lifetimes"],
          "estimatedHours": 4
        },
        {
          "id": "t2",
          "title": "Async Rust",
          "description": "Tokio runtime.",
          "depth": 2,
          "prerequisites": ["t1"],
          "keyConcepts": ["Futures", "Tasks"],
          "estimatedHours": 5
        }
      ]
    }
    ```
    """
    plan = RoadmapService._parse_plan_json(raw_json)
    assert plan is not None
    assert plan.title == "Roadmap: Rust from Scratch"
    assert len(plan.topics) == 2
    assert plan.topics[0].id == "t1"
    assert plan.topics[1].prerequisites == ["t1"]

    # 3. Test fallback plan generation
    fallback = RoadmapService._generate_fallback_plan("Kubernetes Orchestration", "intermediate", "projects")
    assert "Kubernetes Orchestration" in fallback.title
    assert len(fallback.topics) >= 5
    assert fallback.topics[0].prerequisites == []


@pytest.mark.asyncio
async def test_roadmap_generate_endpoint_and_graph_materialization() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Call generate roadmap endpoint
        resp = await client.post(
            "/api/v1/roadmap/generate",
            json={
                "goal": "FastAPI and Modern Async Python",
                "level": "intermediate",
                "focus": "concepts",
            },
        )
        assert resp.status_code == 201
        data = resp.json()

        assert "workspaceId" in data
        assert "rootNodeId" in data
        assert data["topicCount"] >= 5
        ws_id = data["workspaceId"]
        root_id = data["rootNodeId"]

        # 2. Verify graph snapshot was populated
        graph_resp = await client.get(f"/api/v1/workspaces/{ws_id}/graph")
        assert graph_resp.status_code == 200
        graph_data = graph_resp.json()

        nodes = graph_data["nodes"]
        edges = graph_data["edges"]

        assert len(nodes) >= 6  # root + at least 5 topics
        assert len(edges) >= 5  # edges connecting root/topics

        # Verify root node
        root_node = next((n for n in nodes if n["id"] == root_id), None)
        assert root_node is not None
        assert root_node["metadata"].get("node_type") == "roadmap_root"
        assert root_node["metadata"].get("goal") == "FastAPI and Modern Async Python"

        # Verify topic nodes
        topic_nodes = [n for n in nodes if n["id"] != root_id]
        for t in topic_nodes:
            assert t["metadata"].get("node_type") == "roadmap_topic"
            assert "Key Concepts" in t["content"]

        # 3. Verify knowledge concepts were registered for mastery tracking
        concepts_resp = await client.get(f"/api/v1/workspaces/{ws_id}/concepts")
        assert concepts_resp.status_code == 200
        concepts_data = concepts_resp.json()
        assert len(concepts_data) >= 5
