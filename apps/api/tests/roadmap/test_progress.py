from services.roadmap.progress import ProgressService
from services.roadmap.tutor import TutorService


async def test_completion_needs_no_quiz_and_reopen_does_not_reset(
    curriculum_workspace, curriculum_session
):
    view = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    progress = ProgressService(curriculum_session)
    completed = await progress.set_status(view.workspace_id, "t1", owner, "completed")
    assert completed.status == "completed" and completed.completed_at
    await TutorService(curriculum_session).open_session(view.workspace_id, "t1", owner, "first")
    brief = await progress.repository(owner).read_brief(view.workspace_id, "t1")
    assert (
        brief.progress.status == "completed"
        and brief.progress.completed_at == completed.completed_at
    )
    incomplete = await progress.set_status(view.workspace_id, "t1", owner, "in_progress")
    assert incomplete.completed_at is None


async def test_start_changes_only_not_started(curriculum_workspace, curriculum_session):
    view = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    await TutorService(curriculum_session).open_session(view.workspace_id, "t1", owner, "first")
    brief = (
        await ProgressService(curriculum_session)
        .repository(owner)
        .read_brief(view.workspace_id, "t1")
    )
    assert brief.progress.status == "in_progress" and brief.progress.completed_at is None


async def test_progress_api_ownership_and_validation(curriculum_workspace, curriculum_session):
    from httpx import ASGITransport, AsyncClient
    from main import app
    from services.auth_service import create_access_token

    await curriculum_session.commit()
    view = curriculum_workspace.view
    owner = curriculum_workspace.owner_id

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        cookies={"access_token": create_access_token(owner)},
    ) as client:
        # 1. Success: mark completed
        resp = await client.patch(
            f"/api/v1/workspaces/{view.workspace_id}/roadmap/topics/t1/progress",
            json={"status": "completed"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "completed"
        assert data["completedAt"] is not None

        # 2. Revert: mark in_progress
        resp2 = await client.patch(
            f"/api/v1/workspaces/{view.workspace_id}/roadmap/topics/t1/progress",
            json={"status": "in_progress"},
        )
        assert resp2.status_code == 200
        data2 = resp2.json()
        assert data2["status"] == "in_progress"
        assert data2["completedAt"] is None

        # 3. Validation: "mastered" is rejected - completion is never called mastery
        invalid_resp = await client.patch(
            f"/api/v1/workspaces/{view.workspace_id}/roadmap/topics/t1/progress",
            json={"status": "mastered"},
        )
        assert invalid_resp.status_code == 422

    # 4. Outsider is rejected
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        cookies={"access_token": create_access_token("usr_outsider")},
    ) as outsider_client:
        denied_resp = await outsider_client.patch(
            f"/api/v1/workspaces/{view.workspace_id}/roadmap/topics/t1/progress",
            json={"status": "completed"},
        )
        assert denied_resp.status_code in (401, 403, 404)

