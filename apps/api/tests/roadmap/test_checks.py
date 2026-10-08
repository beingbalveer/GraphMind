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
