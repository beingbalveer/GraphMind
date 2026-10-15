"""LSI-018 — Course directory and historical chats acceptance locks.

These tests exercise the existing chat list / rename / pin contract that the
Learning Studio course directory reuses, and lock the ticket acceptance:

- no cross-workspace rows and no protected anchor row are returned,
- titles and pinned/recent ordering persist across refreshes,
- history is projected, never copied (renames mutate the same row),
- the directory is authorized at the workspace boundary.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient
from main import app
from schemas.workspace import NodeCreate, WorkspaceCreate
from services.auth_service import create_access_token


@pytest.fixture
async def published_curriculum(curriculum_workspace, curriculum_session):
    from models.workspace import Workspace
    from sqlalchemy import delete

    await curriculum_session.commit()
    try:
        yield curriculum_workspace
    finally:
        await curriculum_session.rollback()
        await curriculum_session.execute(
            delete(Workspace).where(
                Workspace.id == curriculum_workspace.view.workspace_id
            )
        )
        await curriculum_session.commit()


def _owner_client(owner_id: str) -> AsyncClient:
    return AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        cookies={"access_token": create_access_token(owner_id)},
    )


async def _add_root(session, workspace_id: str, content: str) -> str:
    from services.workspace_service import WorkspaceService

    node = await WorkspaceService.add_node_and_edge(
        session,
        workspace_id,
        NodeCreate(id=f"node_{uuid.uuid4().hex[:12]}", role="user", content=content),
    )
    return node.id


async def test_course_directory_is_workspace_scoped_and_omits_anchor(
    published_curriculum, curriculum_session
):
    view = published_curriculum.view
    owner_id = published_curriculum.owner_id

    course_chat_a = await _add_root(
        curriculum_session, view.workspace_id, "Ordinary course chat A"
    )
    course_chat_b = await _add_root(
        curriculum_session, view.workspace_id, "Ordinary course chat B"
    )

    from services.workspace_service import WorkspaceService

    other = await WorkspaceService.create_workspace(
        curriculum_session,
        WorkspaceCreate(name="Unrelated workspace"),
        owner_id=owner_id,
    )
    other_chat = await _add_root(curriculum_session, other.id, "Private other workspace chat")
    await curriculum_session.commit()

    async with _owner_client(owner_id) as client:
        course_resp = await client.get(f"/api/v1/workspaces/{view.workspace_id}/chats")
        assert course_resp.status_code == 200
        course_ids = [chat["id"] for chat in course_resp.json()["chats"]]

        # No protected anchor row, and no cross-workspace rows leak in.
        assert view.canvas_anchor_chat_id not in course_ids
        assert set(course_ids) == {course_chat_a, course_chat_b}
        assert other_chat not in course_ids

        other_resp = await client.get(f"/api/v1/workspaces/{other.id}/chats")
        assert other_resp.status_code == 200
        other_ids = [chat["id"] for chat in other_resp.json()["chats"]]
        assert other_ids == [other_chat]
        assert course_chat_a not in other_ids

    from models.workspace import Workspace
    from sqlalchemy import delete

    await curriculum_session.rollback()
    await curriculum_session.execute(delete(Workspace).where(Workspace.id == other.id))
    await curriculum_session.commit()


async def test_course_directory_rename_and_pin_persist_across_refresh(
    published_curriculum, curriculum_session
):
    from models.workspace import NodeModel

    view = published_curriculum.view
    owner_id = published_curriculum.owner_id

    older = await _add_root(curriculum_session, view.workspace_id, "Older conversation")
    newer = await _add_root(curriculum_session, view.workspace_id, "Newer conversation")

    # Deterministic recency: the first chat is explicitly older.
    older_node = await curriculum_session.get(NodeModel, older)
    older_node.updated_at = datetime.now(timezone.utc) - timedelta(days=2)
    await curriculum_session.commit()

    async with _owner_client(owner_id) as client:
        initial = await client.get(f"/api/v1/workspaces/{view.workspace_id}/chats")
        ids = [chat["id"] for chat in initial.json()["chats"]]
        assert ids[0] == newer

        # Rename + pin the older conversation.
        patch = await client.patch(
            f"/api/v1/workspaces/{view.workspace_id}/chats/{older}",
            json={"title": "Foundations", "pinned": True},
        )
        assert patch.status_code == 200

        # Refreshing twice keeps the title and pinned-first ordering.
        for _ in range(2):
            listing = await client.get(f"/api/v1/workspaces/{view.workspace_id}/chats")
            chats = listing.json()["chats"]
            assert chats[0]["id"] == older
            assert chats[0]["title"] == "Foundations"
            assert chats[0]["pinned"] is True
            assert chats[1]["id"] == newer


async def test_course_directory_denies_unauthorized_read_and_write(
    published_curriculum, curriculum_session
):
    from models.user import User

    view = published_curriculum.view
    chat_id = await _add_root(curriculum_session, view.workspace_id, "Owner only chat")

    intruder = User(
        id=f"usr_{uuid.uuid4().hex[:12]}",
        email=f"{uuid.uuid4().hex}@example.com",
        full_name="Intruder",
        provider="local",
    )
    curriculum_session.add(intruder)
    await curriculum_session.commit()

    async with _owner_client(intruder.id) as client:
        read = await client.get(f"/api/v1/workspaces/{view.workspace_id}/chats")
        assert read.status_code in (403, 404)

        rename = await client.patch(
            f"/api/v1/workspaces/{view.workspace_id}/chats/{chat_id}",
            json={"title": "Hijacked"},
        )
        assert rename.status_code in (403, 404)

        pin = await client.patch(
            f"/api/v1/workspaces/{view.workspace_id}/chats/{chat_id}",
            json={"pinned": True},
        )
        assert pin.status_code in (403, 404)

    # The owner still sees the untouched chat.
    async with _owner_client(published_curriculum.owner_id) as client:
        listing = await client.get(f"/api/v1/workspaces/{view.workspace_id}/chats")
        titles = [chat["title"] for chat in listing.json()["chats"]]
        assert "Hijacked" not in titles
        assert any(chat["id"] == chat_id and chat["pinned"] is False
                   for chat in listing.json()["chats"])


async def test_course_directory_projects_rows_without_copying_history(
    published_curriculum, curriculum_session
):
    view = published_curriculum.view
    chat_id = await _add_root(curriculum_session, view.workspace_id, "Projected conversation")
    await curriculum_session.commit()

    async with _owner_client(published_curriculum.owner_id) as client:
        first = await client.get(f"/api/v1/workspaces/{view.workspace_id}/chats")
        first_ids = sorted(chat["id"] for chat in first.json()["chats"])

        # Refreshing never duplicates the projected rows.
        second = await client.get(f"/api/v1/workspaces/{view.workspace_id}/chats")
        second_ids = sorted(chat["id"] for chat in second.json()["chats"])
        assert first_ids == second_ids
        assert chat_id in first_ids

        # A rename mutates the same row; it does not copy or add a row.
        await client.patch(
            f"/api/v1/workspaces/{view.workspace_id}/chats/{chat_id}",
            json={"title": "Projected conversation renamed"},
        )
        third = await client.get(f"/api/v1/workspaces/{view.workspace_id}/chats")
        third_chats = third.json()["chats"]
        assert sorted(chat["id"] for chat in third_chats) == first_ids
        renamed = next(chat for chat in third_chats if chat["id"] == chat_id)
        assert renamed["title"] == "Projected conversation renamed"
