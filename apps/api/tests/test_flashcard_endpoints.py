import uuid
from unittest.mock import AsyncMock, patch

import pytest
from ai_core import ChatRole, GenerationResult
from database import get_session_factory
from httpx import ASGITransport, AsyncClient
from main import app
from models.user import User, WorkspaceMember
from sqlalchemy import select


def unique_email(prefix: str = "fc") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}@example.com"


@pytest.mark.asyncio
async def test_flashcard_endpoint_lifecycle() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Register owner
        owner_email = unique_email("owner")
        await client.post(
            "/api/v1/auth/register",
            json={
                "email": owner_email,
                "password": "Password123456!",
                "fullName": "Owner User",
            },
        )

        # 2. Create workspace
        ws_resp = await client.post(
            "/api/v1/workspaces",
            json={"name": "Flashcard Lifecycle Workspace"},
        )
        assert ws_resp.status_code == 201
        ws_id = ws_resp.json()["id"]

        # 3. Create an assistant node
        node_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={
                "role": "assistant",
                "content": "PostgreSQL uses Write-Ahead Logging (WAL) for durability.",
            },
        )
        assert node_resp.status_code == 201
        node_id = node_resp.json()["id"]

        fake_provider = AsyncMock()
        fake_provider.generate.return_value = GenerationResult(
            content='{"cards":[{"question":"What ensures durability in PostgreSQL?","answer":"Write-Ahead Logging (WAL)."}]}',
            role=ChatRole.ASSISTANT,
            model_name="fake-model",
        )

        # 4. Generate flashcards
        with patch("services.flashcard_service.get_provider", return_value=fake_provider):
            gen_resp = await client.post(
                f"/api/v1/workspaces/{ws_id}/nodes/{node_id}/flashcards/generate",
                json={"count": 5},
            )
            assert gen_resp.status_code == 201
            cards = gen_resp.json()
            assert len(cards) == 1
            card = cards[0]
            assert "workspaceId" in card
            assert "sourceNodeId" in card
            assert card["workspaceId"] == ws_id
            assert card["sourceNodeId"] == node_id
            assert card["question"] == "What ensures durability in PostgreSQL?"
            assert card["answer"] == "Write-Ahead Logging (WAL)."
            assert card["position"] == 0
            card_id = card["id"]

        # 5. List flashcards
        list_resp = await client.get(
            f"/api/v1/workspaces/{ws_id}/nodes/{node_id}/flashcards"
        )
        assert list_resp.status_code == 200
        listed_cards = list_resp.json()
        assert len(listed_cards) == 1
        assert listed_cards[0]["id"] == card_id

        # 6. Update flashcard
        patch_resp = await client.patch(
            f"/api/v1/workspaces/{ws_id}/nodes/{node_id}/flashcards/{card_id}",
            json={"question": "What is WAL in PostgreSQL?"},
        )
        assert patch_resp.status_code == 200
        updated = patch_resp.json()
        assert updated["question"] == "What is WAL in PostgreSQL?"
        assert updated["answer"] == "Write-Ahead Logging (WAL)."

        # 7. Delete flashcard
        del_resp = await client.delete(
            f"/api/v1/workspaces/{ws_id}/nodes/{node_id}/flashcards/{card_id}"
        )
        assert del_resp.status_code == 204

        # 8. List again - must be empty
        list_again = await client.get(
            f"/api/v1/workspaces/{ws_id}/nodes/{node_id}/flashcards"
        )
        assert list_again.status_code == 200
        assert list_again.json() == []


@pytest.mark.asyncio
async def test_flashcard_endpoint_error_contracts() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Register user
        email = unique_email("err_user")
        await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "Password123456!",
            },
        )

        ws_resp = await client.post(
            "/api/v1/workspaces",
            json={"name": "Error Workspace"},
        )
        ws_id = ws_resp.json()["id"]

        # Create user node (role: user)
        u_node_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={"role": "user", "content": "How does Raft work?"},
        )
        u_node_id = u_node_resp.json()["id"]

        # Create assistant node (role: assistant)
        a_node_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={"role": "assistant", "content": "Raft achieves consensus via leader election."},
        )
        a_node_id = a_node_resp.json()["id"]

        # 1. Generating from user node must return 422
        bad_source_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes/{u_node_id}/flashcards/generate",
            json={"count": 5},
        )
        assert bad_source_resp.status_code == 422

        # 2. Generating with invalid count bounds must return 422
        out_of_bounds = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes/{a_node_id}/flashcards/generate",
            json={"count": 0},
        )
        assert out_of_bounds.status_code == 422

        fake_provider = AsyncMock()
        fake_provider.generate.return_value = GenerationResult(
            content='{"cards":[{"question":"What is Raft?","answer":"Consensus algorithm."}]}',
            role=ChatRole.ASSISTANT,
            model_name="fake-model",
        )

        # 3. Successful generation
        with patch("services.flashcard_service.get_provider", return_value=fake_provider):
            ok_gen = await client.post(
                f"/api/v1/workspaces/{ws_id}/nodes/{a_node_id}/flashcards/generate",
                json={"count": 5},
            )
            assert ok_gen.status_code == 201

        # 4. Repeated generation with replaceExisting=False must return 409
        conflict_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes/{a_node_id}/flashcards/generate",
            json={"count": 5, "replaceExisting": False},
        )
        assert conflict_resp.status_code == 409

        # 5. Missing card update/delete must return 404
        missing_patch = await client.patch(
            f"/api/v1/workspaces/{ws_id}/nodes/{a_node_id}/flashcards/card_missing_123",
            json={"question": "Valid question?"},
        )
        assert missing_patch.status_code == 404

        missing_del = await client.delete(
            f"/api/v1/workspaces/{ws_id}/nodes/{a_node_id}/flashcards/card_missing_123"
        )
        assert missing_del.status_code == 404


@pytest.mark.asyncio
async def test_flashcard_cross_tenant_and_viewer_rbac() -> None:
    transport = ASGITransport(app=app)
    # User A (Owner)
    async with AsyncClient(transport=transport, base_url="http://test") as client_a:
        email_a = unique_email("owner_a")
        await client_a.post(
            "/api/v1/auth/register",
            json={"email": email_a, "password": "Password123456!"},
        )

        ws_resp = await client_a.post(
            "/api/v1/workspaces",
            json={"name": "Owner A Workspace"},
        )
        ws_id = ws_resp.json()["id"]

        node_resp = await client_a.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={"role": "assistant", "content": "Paxos is a consensus protocol."},
        )
        node_id = node_resp.json()["id"]

        fake_provider = AsyncMock()
        fake_provider.generate.return_value = GenerationResult(
            content='{"cards":[{"question":"What is Paxos?","answer":"A consensus protocol."}]}',
            role=ChatRole.ASSISTANT,
            model_name="fake-model",
        )

        with patch("services.flashcard_service.get_provider", return_value=fake_provider):
            gen = await client_a.post(
                f"/api/v1/workspaces/{ws_id}/nodes/{node_id}/flashcards/generate",
                json={"count": 5},
            )
            assert gen.status_code == 201
            card_id = gen.json()[0]["id"]

    # User B (Member with role: "viewer")
    async with AsyncClient(transport=transport, base_url="http://test") as client_b:
        email_b = unique_email("viewer_b")
        await client_b.post(
            "/api/v1/auth/register",
            json={"email": email_b, "password": "Password123456!"},
        )

        session_factory = get_session_factory()
        async with session_factory() as session:
            user_b_stmt = select(User).where(User.email == email_b)
            user_b = (await session.execute(user_b_stmt)).scalar_one()
            member = WorkspaceMember(workspace_id=ws_id, user_id=user_b.id, role="viewer")
            session.add(member)
            await session.commit()

        # Viewer can read flashcards (200 OK)
        r_get = await client_b.get(f"/api/v1/workspaces/{ws_id}/nodes/{node_id}/flashcards")
        assert r_get.status_code == 200
        assert len(r_get.json()) == 1

        # Viewer receives 403 Forbidden for generate, update, and delete
        r_gen = await client_b.post(
            f"/api/v1/workspaces/{ws_id}/nodes/{node_id}/flashcards/generate",
            json={"count": 5},
        )
        assert r_gen.status_code == 403

        r_patch = await client_b.patch(
            f"/api/v1/workspaces/{ws_id}/nodes/{node_id}/flashcards/{card_id}",
            json={"question": "Viewer edit?"},
        )
        assert r_patch.status_code == 403

        r_del = await client_b.delete(
            f"/api/v1/workspaces/{ws_id}/nodes/{node_id}/flashcards/{card_id}"
        )
        assert r_del.status_code == 403

    # User C (Unrelated intruder)
    async with AsyncClient(transport=transport, base_url="http://test") as client_c:
        email_c = unique_email("intruder_c")
        await client_c.post(
            "/api/v1/auth/register",
            json={"email": email_c, "password": "Password123456!"},
        )

        # Unrelated user must receive 404 on all endpoints
        r1 = await client_c.get(f"/api/v1/workspaces/{ws_id}/nodes/{node_id}/flashcards")
        assert r1.status_code == 404

        r2 = await client_c.post(
            f"/api/v1/workspaces/{ws_id}/nodes/{node_id}/flashcards/generate",
            json={"count": 5},
        )
        assert r2.status_code == 404

        r3 = await client_c.patch(
            f"/api/v1/workspaces/{ws_id}/nodes/{node_id}/flashcards/{card_id}",
            json={"question": "Hacked?"},
        )
        assert r3.status_code == 404

        r4 = await client_c.delete(
            f"/api/v1/workspaces/{ws_id}/nodes/{node_id}/flashcards/{card_id}"
        )
        assert r4.status_code == 404


@pytest.mark.asyncio
async def test_flashcard_endpoint_custom_base_url_in_generate_request() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        email = unique_email("ollama_owner")
        await client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "Password123456!"},
        )

        ws_resp = await client.post(
            "/api/v1/workspaces",
            json={"name": "Ollama Workspace"},
        )
        ws_id = ws_resp.json()["id"]

        node_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={"role": "assistant", "content": "Local models run offline with Ollama."},
        )
        node_id = node_resp.json()["id"]

        fake_provider = AsyncMock()
        fake_provider.generate.return_value = GenerationResult(
            content='{"cards":[{"question":"What is Ollama?","answer":"Local LLM runtime."}]}',
            role=ChatRole.ASSISTANT,
            model_name="llama3",
        )

        with patch("services.flashcard_service.get_provider", return_value=fake_provider) as mock_get_provider:
            resp = await client.post(
                f"/api/v1/workspaces/{ws_id}/nodes/{node_id}/flashcards/generate",
                json={
                    "count": 5,
                    "provider": "ollama",
                    "model": "llama3",
                    "baseUrl": "http://localhost:11434/v1",
                },
            )
            assert resp.status_code == 201
            # Verify the custom base URL was properly forwarded to get_provider
            mock_get_provider.assert_called_once_with(
                "ollama",
                api_key=None,
                base_url="http://localhost:11434/v1",
            )
