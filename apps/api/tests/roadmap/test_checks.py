import json
from unittest.mock import AsyncMock

import pytest
from ai_core import GenerationResult
from errors import RoadmapHTTPError
from schemas.workspace import NodeCreate
from services.roadmap.progress import ProgressService
from services.roadmap.tutor import TutorService
from services.workspace_service import WorkspaceService


async def test_no_answer_cannot_receive_fabricated_check(curriculum_workspace, curriculum_session):
    view = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    lesson = await TutorService(curriculum_session).open_session(
        view.workspace_id, "t1", owner, "open"
    )
    provider = AsyncMock()
    with pytest.raises(RoadmapHTTPError) as error:
        await ProgressService(curriculum_session, provider=provider).record_check(
            view.workspace_id, "t1", owner, lesson.id
        )
    assert error.value.error.code == "CHECK_NOT_READY"
    provider.generate.assert_not_called()


async def test_ai_assessment_does_not_mark_topic_completed(
    curriculum_workspace, curriculum_session
):
    view = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    lesson = await TutorService(curriculum_session).open_session(
        view.workspace_id, "t1", owner, "open"
    )
    question = await WorkspaceService.add_node_and_edge(
        curriculum_session,
        view.workspace_id,
        NodeCreate(
            id="check-question",
            parent_id=lesson.chat_id,
            role="assistant",
            content="Why does observation matter when drawing?",
        ),
    )
    await WorkspaceService.add_node_and_edge(
        curriculum_session,
        view.workspace_id,
        NodeCreate(
            id="check-answer",
            parent_id=question.id,
            role="user",
            content="Observation makes me compare angles and proportions against the real subject instead of my assumptions.",
        ),
    )
    provider = AsyncMock()
    provider.generate.return_value = GenerationResult(
        model_name="scripted",
        content=json.dumps(
            {
                "ready": True,
                "criteria": ["Explains observation", "Applies proportion checking"],
                "rating": "developing",
                "strengths": ["Connects observation to angles"],
                "gaps": ["Practice checking relative proportions"],
                "nextStep": "Compare two shapes from observation",
            }
        ),
    )
    service = ProgressService(curriculum_session, provider=provider)
    before = await service.set_status(view.workspace_id, "t1", owner, "in_progress")
    check = await service.record_check(view.workspace_id, "t1", owner, lesson.id)
    after = (await service.repository(owner).read_brief(view.workspace_id, "t1")).progress
    assert before.status == after.status == "in_progress" and after.completed_at is None
    assert (
        check.result["assessmentType"] == "AI-assessed" and check.revision_id == lesson.revision_id
    )
    assert "Observation makes me" in str(provider.generate.call_args)


@pytest.mark.parametrize("change", ["ownership", "deactivation"])
async def test_assessment_rechecks_changed_authority_after_provider_await(
    curriculum_workspace, curriculum_session, worker_job, change
):
    from database import get_session_factory
    from dependencies import require_workspace_write
    from fastapi import HTTPException
    from models.roadmap import KnowledgeCheck
    from models.user import User, WorkspaceMember
    from models.workspace import Workspace
    from sqlalchemy import delete, func, select, update

    view = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    tutor = TutorService(curriculum_session)
    lesson = await tutor.open_session(view.workspace_id, "t1", owner, "authority-check")
    # Keep the same ORM identities alive as the HTTP dependency does across commit.
    actor = await curriculum_session.get(User, owner)
    access = await require_workspace_write(view.workspace_id, actor, curriculum_session)
    await curriculum_session.commit()
    provider = AsyncMock()

    async def generate(*args, **kwargs):
        async with get_session_factory()() as other:
            if change == "ownership":
                await other.execute(
                    update(Workspace)
                    .where(Workspace.id == view.workspace_id)
                    .values(owner_id=worker_job.owner_id)
                )
                await other.execute(
                    delete(WorkspaceMember).where(
                        WorkspaceMember.workspace_id == view.workspace_id,
                        WorkspaceMember.user_id == owner,
                    )
                )
            else:
                await other.execute(update(User).where(User.id == owner).values(is_active=False))
            await other.commit()
        return GenerationResult(
            model_name="scripted",
            content=json.dumps(
                {
                    "ready": True,
                    "criteria": ["Observation"],
                    "rating": "adequate",
                    "strengths": [],
                    "gaps": [],
                    "nextStep": "Practice",
                }
            ),
        )

    provider.generate.side_effect = generate
    try:
        with pytest.raises(HTTPException) as raised:
            await ProgressService(curriculum_session, provider=provider).record_check(
                view.workspace_id, "t1", owner, lesson.id, prepared=[]
            )
        assert raised.value.status_code in {401, 403, 404}
        assert (
            await curriculum_session.scalar(
                select(func.count())
                .select_from(KnowledgeCheck)
                .where(KnowledgeCheck.session_id == lesson.id)
            )
            == 0
        )
        assert access is not None and actor is not None
    finally:
        await curriculum_session.rollback()
        async with get_session_factory()() as other:
            await other.execute(update(User).where(User.id == owner).values(is_active=True))
            await other.execute(
                update(Workspace).where(Workspace.id == view.workspace_id).values(owner_id=owner)
            )
            await other.commit()
