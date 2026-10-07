import pytest
from httpx import ASGITransport, AsyncClient
from main import app
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
            delete(Workspace).where(Workspace.id == curriculum_workspace.view.workspace_id)
        )
        await curriculum_session.commit()


async def test_viewer_reads_curriculum_and_brief_without_write_permission(
    published_curriculum, worker_job, curriculum_session
):
    from dependencies import require_roadmap_write
    from fastapi import HTTPException
    from models.user import User, WorkspaceMember

    view = published_curriculum.view
    curriculum_session.add(
        WorkspaceMember(workspace_id=view.workspace_id, user_id=worker_job.owner_id, role="viewer")
    )
    await curriculum_session.commit()
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        cookies={"access_token": create_access_token(worker_job.owner_id)},
    ) as client:
        response = await client.get(f"/api/v1/workspaces/{view.workspace_id}/roadmap")
        assert response.status_code == 200 and response.json()["revisionId"] == view.revision_id
        brief = await client.get(f"/api/v1/workspaces/{view.workspace_id}/roadmap/topics/t1")
        assert brief.status_code == 200 and brief.json()["item"]["id"] == "t1"
    actor = await curriculum_session.get(User, worker_job.owner_id)
    with pytest.raises(HTTPException) as error:
        await require_roadmap_write(view.workspace_id, actor, curriculum_session)
    assert error.value.status_code == 403


async def test_ordinary_workspace_has_typed_absent_roadmap(
    auth_client, worker_job, curriculum_session
):
    from schemas.workspace import WorkspaceCreate
    from services.workspace_service import WorkspaceService

    workspace = await WorkspaceService.create_workspace(
        curriculum_session, WorkspaceCreate(name="Ordinary workspace"), owner_id=worker_job.owner_id
    )
    await curriculum_session.commit()
    response = await auth_client.get(f"/api/v1/workspaces/{workspace.id}/roadmap")
    assert response.status_code == 404 and response.json()["error"]["code"] == "ROADMAP_NOT_FOUND"


async def test_nonmember_and_anonymous_cannot_read_curriculum(
    published_curriculum, auth_client, curriculum_session
):
    await curriculum_session.commit()
    path = f"/api/v1/workspaces/{published_curriculum.view.workspace_id}/roadmap"
    assert (await auth_client.get(path)).status_code == 404
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.get(path)).status_code == 401


@pytest.mark.parametrize("action", ["chats", "nodes"])
async def test_direct_anchor_deletion_is_protected(
    published_curriculum, curriculum_session, action
):
    view = published_curriculum.view
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        cookies={"access_token": create_access_token("usr_default_admin")},
    ) as client:
        response = await client.delete(
            f"/api/v1/workspaces/{view.workspace_id}/{action}/{view.canvas_anchor_chat_id}"
        )
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "ROADMAP_ANCHOR_PROTECTED"
        assert (
            await client.get(f"/api/v1/workspaces/{view.workspace_id}/roadmap")
        ).status_code == 200


async def test_anchor_is_not_an_ordinary_chat(published_curriculum, curriculum_session):
    from services.workspace_service import WorkspaceService

    view = published_curriculum.view
    chats = await WorkspaceService.list_workspace_chats(curriculum_session, view.workspace_id)
    assert view.canvas_anchor_chat_id not in [chat.id for chat in chats]


async def test_workspace_delete_still_cascades_roadmap(published_curriculum, curriculum_session):
    from models.roadmap import Roadmap

    view = published_curriculum.view
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        cookies={"access_token": create_access_token("usr_default_admin")},
    ) as client:
        assert (await client.delete(f"/api/v1/workspaces/{view.workspace_id}")).status_code == 204
    await curriculum_session.rollback()
    assert await curriculum_session.get(Roadmap, view.roadmap_id) is None
