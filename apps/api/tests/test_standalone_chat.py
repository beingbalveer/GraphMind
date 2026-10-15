import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from main import app


@pytest.fixture(autouse=True)
def setup_mock_embeddings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DEFAULT_EMBEDDING_PROVIDER", "mock")


def get_error_message(resp) -> str:
    body = resp.json()
    if isinstance(body, dict):
        if "error" in body and isinstance(body["error"], dict) and "message" in body["error"]:
            return str(body["error"]["message"])
        if "detail" in body:
            return str(body["detail"])
    return str(body)


@pytest.mark.asyncio
async def test_create_standalone_root_node_contract() -> None:
    """Verifies that creating a parentless user node persists cleanly in PostgreSQL and appears in chats."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Create workspace
        ws_resp = await client.post("/api/v1/workspaces", json={"name": "Standalone Workspace"})
        assert ws_resp.status_code == 201
        ws_id = ws_resp.json()["id"]

        # Create parentless user root node
        node_id = f"node_root_{uuid.uuid4().hex[:8]}"
        prompt_text = "What is the event loop in async programming?"
        node_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={
                "id": node_id,
                "parentId": None,
                "role": "user",
                "content": prompt_text,
                "provider": "gemini",
                "model": "gemini-2.5-flash",
                "metadata": {},
            },
        )
        assert node_resp.status_code == 201
        node_data = node_resp.json()
        assert node_data["id"] == node_id
        assert node_data["parentId"] is None
        assert node_data["role"] == "user"
        assert node_data["content"] == prompt_text

        # Verify chat appears in workspace chats list as standalone (topicChat is None)
        chats_resp = await client.get(f"/api/v1/workspaces/{ws_id}/chats")
        assert chats_resp.status_code == 200
        chats_data = chats_resp.json()
        assert chats_data["total"] >= 1
        chat_item = next((c for c in chats_data["chats"] if c["id"] == node_id), None)
        assert chat_item is not None
        assert chat_item["nodeCount"] == 1
        assert chat_item.get("topicChat") is None

        # Verify graph snapshot for this chat returns exactly 1 node and 0 edges
        graph_resp = await client.get(
            f"/api/v1/workspaces/{ws_id}/graph", params={"chat_id": node_id}
        )
        assert graph_resp.status_code == 200
        graph_data = graph_resp.json()
        assert graph_data["rootNodeId"] == node_id
        assert graph_data["activeNodeId"] == node_id
        assert len(graph_data["nodes"]) == 1
        assert graph_data["nodes"][0]["id"] == node_id
        assert len(graph_data["edges"]) == 0


@pytest.mark.asyncio
async def test_standalone_chat_stream_and_continuation_lifecycle(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Verifies that standalone workspace chats stream responses and support continuations without topic context."""
    from ai_core import GenerationResult, StreamChunk
    from routers import chat as chat_router

    captured_requests = []

    class MockTestProvider:
        async def generate(self, messages, config, tools=None):
            captured_requests.append((messages, config))
            return GenerationResult(model_name="mock-model", content="Async programming allows non-blocking execution.")

        async def stream(self, messages, config, tools=None):
            captured_requests.append((messages, config))
            yield StreamChunk(content="Async programming allows non-blocking execution.")

    monkeypatch.setattr(chat_router, "get_provider", lambda *args, **kwargs: MockTestProvider())

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        ws_resp = await client.post("/api/v1/workspaces", json={"name": "Lifecycle Workspace"})
        assert ws_resp.status_code == 201
        ws_id = ws_resp.json()["id"]

        # 1. Create parentless user root
        root_id = f"node_root_{uuid.uuid4().hex[:8]}"
        initial_prompt = "Explain asyncio tasks and coroutines."
        await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={
                "id": root_id,
                "parentId": None,
                "role": "user",
                "content": initial_prompt,
            },
        )

        # 2. Stream initial response for standalone chat
        stream_resp = await client.post(
            "/api/v1/chat/stream",
            json={
                "workspaceId": ws_id,
                "parentNodeId": root_id,
                "prompt": initial_prompt,
                "provider": "mock",
            },
        )
        assert stream_resp.status_code == 200
        # Check that captured provider messages DO NOT contain any SERVER-VERIFIED LEARNING CONTEXT
        assert len(captured_requests) >= 1
        messages, config = captured_requests[-1]
        for msg in messages:
            assert "SERVER-VERIFIED LEARNING CONTEXT" not in msg.content
        assert any(msg.role.value == "user" and initial_prompt in msg.content for msg in messages)

        # 3. Persist assistant response node
        asst_id = f"{root_id}_response"
        asst_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={
                "id": asst_id,
                "parentId": root_id,
                "role": "assistant",
                "content": "Async programming allows non-blocking execution.",
            },
        )
        assert asst_resp.status_code == 201

        # 4. Continuation turn: follow-up user message
        followup_user_id = f"node_user2_{uuid.uuid4().hex[:8]}"
        followup_prompt = "How does task cancellation work?"
        followup_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={
                "id": followup_user_id,
                "parentId": asst_id,
                "role": "user",
                "content": followup_prompt,
            },
        )
        assert followup_resp.status_code == 201

        # 5. Stream follow-up response
        stream_followup = await client.post(
            "/api/v1/chat/stream",
            json={
                "workspaceId": ws_id,
                "parentNodeId": followup_user_id,
                "prompt": followup_prompt,
                "provider": "mock",
            },
        )
        assert stream_followup.status_code == 200
        messages2, _ = captured_requests[-1]
        # Lineage has both turns
        assert any(initial_prompt in m.content for m in messages2)
        assert any("Async programming allows" in m.content for m in messages2)
        assert any(followup_prompt in m.content for m in messages2)
        # Still strictly independent of topic context
        for msg in messages2:
            assert "SERVER-VERIFIED LEARNING CONTEXT" not in msg.content


@pytest.mark.asyncio
async def test_standalone_chat_context_independence_and_forged_lesson_rejection() -> None:
    """Verifies that standalone chats reject forged topic session IDs and unauthenticated lesson start."""
    from services.auth_service import create_access_token

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        ws_resp = await client.post("/api/v1/workspaces", json={"name": "Independence Workspace"})
        assert ws_resp.status_code == 201
        ws_id = ws_resp.json()["id"]

        root_id = f"node_root_{uuid.uuid4().hex[:8]}"
        await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={
                "id": root_id,
                "parentId": None,
                "role": "user",
                "content": "A general question about databases.",
            },
        )

        # 1. Unauthenticated request with topicSessionId or lessonStart must require auth (401)
        unauth_resp = await client.post(
            "/api/v1/chat/stream",
            json={
                "workspaceId": ws_id,
                "parentNodeId": root_id,
                "prompt": "A general question about databases.",
                "topicSessionId": "forged_session_123",
                "provider": "mock",
            },
        )
        assert unauth_resp.status_code == 401

        # 2. Authenticate client
        client.cookies.set("access_token", create_access_token("usr_default_admin"))

        # Passing an invalid or foreign topicSessionId to a standalone chat must return 404
        bad_topic_resp = await client.post(
            "/api/v1/chat/stream",
            json={
                "workspaceId": ws_id,
                "parentNodeId": root_id,
                "prompt": "A general question about databases.",
                "topicSessionId": "forged_session_123",
                "provider": "mock",
            },
        )
        assert bad_topic_resp.status_code == 404
        assert "not belong to this conversation" in get_error_message(bad_topic_resp).lower() or "not found" in get_error_message(bad_topic_resp).lower()

        # Passing lessonStart=True without a valid topic session must return 422
        bad_lesson_resp = await client.post(
            "/api/v1/chat/stream",
            json={
                "workspaceId": ws_id,
                "parentNodeId": root_id,
                "prompt": "A general question about databases.",
                "lessonStart": True,
                "provider": "mock",
            },
        )
        assert bad_lesson_resp.status_code == 422
        assert "topic session is required" in get_error_message(bad_lesson_resp).lower()


@pytest.mark.asyncio
async def test_standalone_root_survives_snapshot_and_resume_recovery() -> None:
    """Verifies that a newly created root survives refresh and can be resumed even before any assistant response is persisted."""
    from ai_core import GenerationResult, StreamChunk
    from routers import chat as chat_router

    stream_called = False

    class MockResumeProvider:
        async def stream(self, messages, config, tools=None):
            nonlocal stream_called
            stream_called = True
            yield StreamChunk(content="Resumed answer.")

    chat_router.get_provider = lambda *args, **kwargs: MockResumeProvider()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        ws_resp = await client.post("/api/v1/workspaces", json={"name": "Recovery Workspace"})
        assert ws_resp.status_code == 201
        ws_id = ws_resp.json()["id"]

        root_id = f"node_root_{uuid.uuid4().hex[:8]}"
        prompt_text = "Survive refresh before assistant finishes."
        await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={
                "id": root_id,
                "parentId": None,
                "role": "user",
                "content": prompt_text,
            },
        )

        # Simulate user refreshing immediately: fetch graph snapshot
        graph_resp = await client.get(
            f"/api/v1/workspaces/{ws_id}/graph", params={"chat_id": root_id}
        )
        assert graph_resp.status_code == 200
        snap = graph_resp.json()
        assert snap["rootNodeId"] == root_id
        assert len(snap["nodes"]) == 1
        assert snap["nodes"][0]["content"] == prompt_text

        # Simulate clicking 'Resume response': stream with parentNodeId=root_id
        resume_resp = await client.post(
            "/api/v1/chat/stream",
            json={
                "workspaceId": ws_id,
                "parentNodeId": root_id,
                "prompt": prompt_text,
                "provider": "mock",
            },
        )
        assert resume_resp.status_code == 200
        assert stream_called is True
