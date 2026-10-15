"""LSI-040 — General workspaces and management acceptance locks.

These tests exercise the existing workspace contract that general (non-curriculum)
workspaces and the dashboard rely on, and lock the ticket acceptance:

- original workspace IDs stay accessible through create/rename/delete,
- an ordinary workspace keeps working when the curriculum read returns
  ``ROADMAP_NOT_FOUND``,
- the protected roadmap canvas anchor chat cannot be deleted, membership is
  enforced for management writes, and deleting the workspace removes the roadmap.

Backend tests run against an isolated ``*_test`` database (enforced by
``apps/api/tests/conftest.py``); never against live or user data.
"""

import uuid

from httpx import ASGITransport, AsyncClient
from main import app
from services.auth_service import create_access_token


def _client(user_id: str) -> AsyncClient:
    return AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        cookies={"access_token": create_access_token(user_id)},
    )


async def _new_user(session, label: str):
    from models.user import User

    user = User(
        id=f"usr_{uuid.uuid4().hex[:12]}",
        email=f"{uuid.uuid4().hex}@example.com",
        full_name=label,
        provider="local",
    )
    session.add(user)
    await session.flush()
    return user


async def test_ordinary_workspace_management_preserves_identity():
    """Create → select → rename → delete keeps the original workspace ID valid."""
    async with _client("usr_default_admin") as client:
        created = await client.post(
            "/api/v1/workspaces",
            json={"name": "Ordinary notes", "description": "General workspace"},
        )
        assert created.status_code == 201
        ws_id = created.json()["id"]

        # The original id is addressable directly and through the listing.
        fetched = await client.get(f"/api/v1/workspaces/{ws_id}")
        assert fetched.status_code == 200
        assert fetched.json()["id"] == ws_id

        listing = await client.get("/api/v1/workspaces")
        assert any(item["id"] == ws_id for item in listing.json()["workspaces"])

        # Rename mutates metadata; the identity never changes.
        renamed = await client.patch(
            f"/api/v1/workspaces/{ws_id}", json={"name": "Ordinary notes renamed"}
        )
        assert renamed.status_code == 200
        assert renamed.json()["id"] == ws_id
        assert renamed.json()["name"] == "Ordinary notes renamed"

        refreshed = await client.get(f"/api/v1/workspaces/{ws_id}")
        assert refreshed.status_code == 200
        assert refreshed.json()["id"] == ws_id
        assert refreshed.json()["name"] == "Ordinary notes renamed"

        # Delete removes only this workspace.
        deleted = await client.delete(f"/api/v1/workspaces/{ws_id}")
        assert deleted.status_code == 204
        assert (await client.get(f"/api/v1/workspaces/{ws_id}")).status_code == 404


async def test_roadmap_not_found_preserves_ordinary_workspace_behavior():
    """An ordinary workspace keeps its metadata, chats, and graph when the
    curriculum read returns a typed ``ROADMAP_NOT_FOUND``."""
    async with _client("usr_default_admin") as client:
        created = await client.post(
            "/api/v1/workspaces", json={"name": "Ordinary chat workspace"}
        )
        assert created.status_code == 201
        ws_id = created.json()["id"]

        # No published roadmap is a typed absence, not an ordinary failure.
        roadmap = await client.get(f"/api/v1/workspaces/{ws_id}/roadmap")
        assert roadmap.status_code == 404
        assert roadmap.json()["error"]["code"] == "ROADMAP_NOT_FOUND"

        # The ordinary landing, chat list, and graph all keep working.
        assert (await client.get(f"/api/v1/workspaces/{ws_id}")).status_code == 200
        empty_chats = await client.get(f"/api/v1/workspaces/{ws_id}/chats")
        assert empty_chats.status_code == 200
        assert empty_chats.json()["total"] == 0

        root = await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={
                "id": f"node_{uuid.uuid4().hex[:12]}",
                "role": "user",
                "content": "Hello ordinary world",
            },
        )
        assert root.status_code == 201

        chats = await client.get(f"/api/v1/workspaces/{ws_id}/chats")
        assert chats.status_code == 200
        assert chats.json()["total"] == 1

        graph = await client.get(f"/api/v1/workspaces/{ws_id}/graph")
        assert graph.status_code == 200
        assert len(graph.json()["nodes"]) == 1

        assert (await client.delete(f"/api/v1/workspaces/{ws_id}")).status_code == 204


async def test_anchor_membership_and_workspace_cascade(
    curriculum_workspace, curriculum_session
):
    """Anchor deletion is refused, membership gates management writes, and
    deleting the workspace removes the roadmap."""
    from models.user import WorkspaceMember

    view = curriculum_workspace.view
    owner_id = curriculum_workspace.owner_id
    workspace_id = view.workspace_id
    anchor_id = view.canvas_anchor_chat_id

    await curriculum_session.commit()
    try:
        # The protected canvas anchor chat cannot be deleted through the chat route.
        async with _client(owner_id) as client:
            blocked = await client.delete(
                f"/api/v1/workspaces/{workspace_id}/chats/{anchor_id}"
            )
            assert blocked.status_code == 409
            assert blocked.json()["error"]["code"] == "ROADMAP_ANCHOR_PROTECTED"

        intruder = await _new_user(curriculum_session, "Intruder")
        viewer = await _new_user(curriculum_session, "Viewer")
        editor = await _new_user(curriculum_session, "Editor")
        curriculum_session.add_all(
            [
                WorkspaceMember(workspace_id=workspace_id, user_id=viewer.id, role="viewer"),
                WorkspaceMember(workspace_id=workspace_id, user_id=editor.id, role="editor"),
            ]
        )
        await curriculum_session.commit()

        # A non-member cannot rename or delete.
        async with _client(intruder.id) as client:
            assert (
                await client.patch(
                    f"/api/v1/workspaces/{workspace_id}", json={"name": "Hijacked"}
                )
            ).status_code in (403, 404)
            assert (
                await client.delete(f"/api/v1/workspaces/{workspace_id}")
            ).status_code in (403, 404)

        # A viewer is denied management writes.
        async with _client(viewer.id) as client:
            assert (
                await client.patch(
                    f"/api/v1/workspaces/{workspace_id}", json={"name": "Hijacked"}
                )
            ).status_code == 403
            assert (
                await client.delete(f"/api/v1/workspaces/{workspace_id}")
            ).status_code == 403

        # An editor may rename; the identity is unchanged.
        async with _client(editor.id) as client:
            renamed = await client.patch(
                f"/api/v1/workspaces/{workspace_id}", json={"name": "Editor renamed"}
            )
            assert renamed.status_code == 200
            assert renamed.json()["id"] == workspace_id

        # The owner can delete the workspace, which removes the roadmap too.
        async with _client(owner_id) as client:
            assert (
                await client.delete(f"/api/v1/workspaces/{workspace_id}")
            ).status_code == 204
            assert (
                await client.get(f"/api/v1/workspaces/{workspace_id}")
            ).status_code == 404
            gone = await client.get(f"/api/v1/workspaces/{workspace_id}/roadmap")
            assert gone.status_code == 404
    finally:
        from models.workspace import Workspace
        from sqlalchemy import delete

        await curriculum_session.rollback()
        await curriculum_session.execute(
            delete(Workspace).where(Workspace.id == workspace_id)
        )
        await curriculum_session.commit()
