import pytest
from httpx import ASGITransport, AsyncClient
from main import app
from services.skill_service import get_skill_registry


@pytest.fixture(autouse=True)
def setup_mock_embeddings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DEFAULT_EMBEDDING_PROVIDER", "mock")


def test_builtin_skills_discovery() -> None:
    registry = get_skill_registry()
    skill_names = {s["name"] for s in registry.list_skills()}
    assert "deep_research" in skill_names
    assert "code_architect" in skill_names
    assert "quiz_master" in skill_names

    deep_research = registry.get("deep_research")
    assert deep_research is not None
    assert "search_graph" in deep_research.required_tools
    assert "fetch_url" in deep_research.required_tools
    assert "create_subnode" in deep_research.required_tools


@pytest.mark.asyncio
async def test_get_skills_api_endpoint() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/chat/skills")
        assert response.status_code == 200
        skills = response.json()
        assert isinstance(skills, list)
        names = [s["name"] for s in skills]
        assert "deep_research" in names
        assert "code_architect" in names
        assert "quiz_master" in names


@pytest.mark.asyncio
async def test_chat_completions_with_enabled_skill() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "prompt": "Evaluate monolith vs microservices architecture",
            "provider": "mock",
            "enabled_skills": ["code_architect"],
        }
        response = await client.post("/api/v1/chat/completions", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "content" in data
        assert data["role"] == "assistant"


@pytest.mark.asyncio
async def test_chat_stream_with_enabled_skill() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "prompt": "Generate a learning check on raft consensus",
            "provider": "mock",
            "enabled_skills": ["quiz_master"],
            "metadata": {"stream_delay": 0.001},
        }
        response = await client.post("/api/v1/chat/stream", json=payload)
        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")
        assert "event: token" in response.text
        assert "event: done" in response.text
