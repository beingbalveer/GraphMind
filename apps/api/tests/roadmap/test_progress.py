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
