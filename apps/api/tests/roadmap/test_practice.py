import copy
import uuid
from types import SimpleNamespace

import pytest
from httpx import ASGITransport, AsyncClient
from main import app
from schemas.curriculum import (
    CurriculumItemData,
    CurriculumRelationData,
    ResourceData,
)
from services.auth_service import create_access_token
from services.roadmap.validation import validate_curriculum
from services.workspace_service import WorkspaceService


@pytest.fixture
async def practice_client(curriculum_workspace, curriculum_session):
    from models.workspace import Workspace
    from sqlalchemy import delete

    await curriculum_session.commit()
    client = AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        cookies={"access_token": create_access_token(curriculum_workspace.owner_id)},
    )
    try:
        yield client, curriculum_workspace
    finally:
        await client.aclose()
        await curriculum_session.rollback()
        await curriculum_session.execute(
            delete(Workspace).where(Workspace.id == curriculum_workspace.view.workspace_id)
        )
        await curriculum_session.commit()


@pytest.fixture
async def choice_practice_client(
    repository, curriculum_session, small_candidate, small_profile, sources
):
    from models.workspace import Workspace
    from schemas.workspace import NodeCreate, WorkspaceCreate
    from sqlalchemy import delete

    cand = copy.deepcopy(small_candidate)
    cand.items.append(
        CurriculumItemData(
            id="py-01",
            kind="topic",
            title="Normalize email",
            brief="Email normalization practice",
            objectives=["Normalize email strings safely"],
            exercise="Normalize email addresses in sample strings.",
            format="practice",
            path="further",
            estimate_minutes=90,
            order=10,
        )
    )
    cand.relations.append(
        CurriculumRelationData(source_id="phase", target_id="py-01", kind="contains")
    )
    cand.resources.append(
        ResourceData(
            topic_id="py-01",
            source_id="s1",
            order=0,
            rationale="Email normalization resource",
            evidence_excerpt=sources[0].evidence,
            objective_index=0,
        )
    )
    owner_id = "usr_default_admin"
    ws = await WorkspaceService.create_workspace(
        curriculum_session, WorkspaceCreate(name="Choice test"), owner_id=owner_id
    )
    anchor = await WorkspaceService.add_node_and_edge(
        curriculum_session,
        ws.id,
        NodeCreate(
            id=f"node_{uuid.uuid4().hex[:12]}", role="user", content="Roadmap canvas anchor"
        ),
    )
    view = await repository.create(
        owner_id,
        ws.id,
        anchor.id,
        small_profile,
        cand,
        sources,
        validate_curriculum(cand, small_profile, sources),
    )
    await curriculum_session.commit()
    client = AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        cookies={"access_token": create_access_token(owner_id)},
    )
    try:
        yield client, SimpleNamespace(view=view, owner_id=owner_id, workspace_id=ws.id)
    finally:
        await client.aclose()
        await curriculum_session.rollback()
        await curriculum_session.execute(delete(Workspace).where(Workspace.id == ws.id))
        await curriculum_session.commit()


def _error_message(res) -> str:
    data = res.json()
    if "detail" in data:
        return str(data["detail"])
    return str(data.get("error", {}).get("message", ""))


async def test_get_practice_state_returns_versioned_activity(practice_client):
    client, ws = practice_client
    workspace_id = ws.view.workspace_id
    response = await client.get(f"/api/v1/workspaces/{workspace_id}/roadmap/topics/t1/checks")
    assert response.status_code == 200
    data = response.json()
    assert data["topicId"] == "t1"
    assert data["attemptsCount"] == 0
    assert data["draft"] is None
    assert data["latestAttempt"] is None
    assert data["checks"] == []

    activity = data["activity"]
    assert activity["id"] == "act_t1_v1"
    assert activity["version"] == "1.0"
    assert activity["kind"] in {"choice", "short_answer", "reflection"}
    assert len(activity["prompt"]) > 5
    assert activity["hint"] is not None
    # Ensure correctChoice is never leaked to client in activity schema
    assert "correctChoice" not in activity
    assert "correct_choice" not in activity


async def test_practice_draft_lifecycle(practice_client):
    client, ws = practice_client
    workspace_id = ws.view.workspace_id

    # 1. Save draft
    put_res = await client.put(
        f"/api/v1/workspaces/{workspace_id}/roadmap/topics/t1/checks/draft",
        json={
            "activityId": "act_t1_v1",
            "activityVersion": "1.0",
            "draft": "My working notes and preliminary assertion.",
            "selectedChoice": None,
        },
    )
    assert put_res.status_code == 200
    draft_data = put_res.json()
    assert draft_data["topicId"] == "t1"
    assert draft_data["draft"] == "My working notes and preliminary assertion."

    # 2. Verify draft is returned in practice state
    get_res = await client.get(f"/api/v1/workspaces/{workspace_id}/roadmap/topics/t1/checks")
    assert get_res.status_code == 200
    assert (
        get_res.json()["draft"]["draft"]
        == "My working notes and preliminary assertion."
    )

    # 3. Update draft
    put_res2 = await client.put(
        f"/api/v1/workspaces/{workspace_id}/roadmap/topics/t1/checks/draft",
        json={
            "activityId": "act_t1_v1",
            "activityVersion": "1.0",
            "draft": "Updated draft with more detail.",
        },
    )
    assert put_res2.status_code == 200
    assert put_res2.json()["draft"] == "Updated draft with more detail."

    # 4. Delete draft
    del_res = await client.delete(
        f"/api/v1/workspaces/{workspace_id}/roadmap/topics/t1/checks/draft"
    )
    assert del_res.status_code == 204

    # 5. Verify draft is gone
    get_res2 = await client.get(f"/api/v1/workspaces/{workspace_id}/roadmap/topics/t1/checks")
    assert get_res2.json()["draft"] is None


async def test_practice_activity_version_validation(practice_client):
    client, ws = practice_client
    workspace_id = ws.view.workspace_id

    # Mismatched version on draft
    res = await client.put(
        f"/api/v1/workspaces/{workspace_id}/roadmap/topics/t1/checks/draft",
        json={
            "activityId": "act_t1_v1",
            "activityVersion": "wrong_version_9.9",
            "draft": "Some draft",
        },
    )
    assert res.status_code == 422
    assert "version mismatch" in _error_message(res).lower()

    # Mismatched activityId on attempt
    res2 = await client.post(
        f"/api/v1/workspaces/{workspace_id}/roadmap/topics/t1/checks",
        json={
            "activityId": "nonexistent_activity",
            "activityVersion": "1.0",
            "answer": "A substantive answer for validation testing.",
        },
    )
    assert res2.status_code == 422
    assert "activity version mismatch" in _error_message(res2).lower()


async def test_practice_invalid_answer_rejection(practice_client):
    client, ws = practice_client
    workspace_id = ws.view.workspace_id

    # Answer too short (< 5 characters)
    res = await client.post(
        f"/api/v1/workspaces/{workspace_id}/roadmap/topics/t1/checks",
        json={
            "activityId": "act_t1_v1",
            "activityVersion": "1.0",
            "answer": "abc",
        },
    )
    assert res.status_code == 422
    assert "substantive" in _error_message(res).lower()

    # Empty answer
    res2 = await client.post(
        f"/api/v1/workspaces/{workspace_id}/roadmap/topics/t1/checks",
        json={
            "activityId": "act_t1_v1",
            "activityVersion": "1.0",
            "answer": "    ",
        },
    )
    assert res2.status_code == 422


async def test_practice_evaluation_without_demo_keyword_grading(practice_client):
    client, ws = practice_client
    workspace_id = ws.view.workspace_id

    # Submit an answer without any demo keywords (e.g. "assert", "empty")
    res = await client.post(
        f"/api/v1/workspaces/{workspace_id}/roadmap/topics/t1/checks",
        json={
            "activityId": "act_t1_v1",
            "activityVersion": "1.0",
            "answer": "Careful observation allows proportion checks against the subject directly.",
        },
    )
    assert res.status_code == 201
    check = res.json()
    assert check["topicId"] == "t1"
    assert check["result"]["assessmentType"] == "practice-activity"
    assert check["result"]["correct"] is True
    assert "Answer recorded" in check["result"]["feedback"]
    assert check["result"]["canRetry"] is True


async def test_practice_does_not_mutate_topic_progress_or_set_mastery(practice_client):
    client, ws = practice_client
    workspace_id = ws.view.workspace_id

    # Verify initial progress is not_started
    brief_before = await client.get(f"/api/v1/workspaces/{workspace_id}/roadmap/topics/t1")
    assert brief_before.json()["progress"]["status"] == "not_started"

    # Submit valid practice attempt
    post_res = await client.post(
        f"/api/v1/workspaces/{workspace_id}/roadmap/topics/t1/checks",
        json={
            "activityId": "act_t1_v1",
            "activityVersion": "1.0",
            "answer": "A thorough explanation of the topic concept.",
        },
    )
    assert post_res.status_code == 201

    # Verify progress is STILL not_started (completion is decoupled from practice correctness)
    brief_after = await client.get(f"/api/v1/workspaces/{workspace_id}/roadmap/topics/t1")
    assert brief_after.json()["progress"]["status"] == "not_started"
    # Ensure no mastery concept exists
    assert "mastery" not in str(post_res.json()).lower()


async def test_practice_duplicate_attempt_identity_safety(practice_client):
    client, ws = practice_client
    workspace_id = ws.view.workspace_id

    attempt_id = "att_test_dedup_001"

    # 1. First submission with explicit attempt_id
    res1 = await client.post(
        f"/api/v1/workspaces/{workspace_id}/roadmap/topics/t1/checks",
        json={
            "activityId": "act_t1_v1",
            "activityVersion": "1.0",
            "attemptId": attempt_id,
            "answer": "My first attempt answer that is substantive.",
        },
    )
    assert res1.status_code == 201
    check1 = res1.json()
    assert check1["result"]["attemptId"] == attempt_id

    # 2. Duplicate submission with same attempt_id
    res2 = await client.post(
        f"/api/v1/workspaces/{workspace_id}/roadmap/topics/t1/checks",
        json={
            "activityId": "act_t1_v1",
            "activityVersion": "1.0",
            "attemptId": attempt_id,
            "answer": "My first attempt answer that is substantive.",
        },
    )
    assert res2.status_code == 201
    check2 = res2.json()
    # Must return identical check without duplicating
    assert check2["id"] == check1["id"]
    assert check2["result"]["attemptId"] == attempt_id

    # 3. Check attempts count in practice state: should be exactly 1
    state_res = await client.get(f"/api/v1/workspaces/{workspace_id}/roadmap/topics/t1/checks")
    assert state_res.json()["attemptsCount"] == 1


async def test_choice_activity_evaluation_and_retry(choice_practice_client):
    client, ws = choice_practice_client
    workspace_id = ws.workspace_id

    # 1. Inspect practice state for py-01
    state_res = await client.get(
        f"/api/v1/workspaces/{workspace_id}/roadmap/topics/py-01/checks"
    )
    assert state_res.status_code == 200
    activity = state_res.json()["activity"]
    assert activity["id"] == "act_py-01_v1"
    assert activity["kind"] == "choice"
    assert "ada@example.com" in activity["choices"]
    assert "correctChoice" not in activity

    # 2. Invalid choice selection (not in choices list)
    bad_res = await client.post(
        f"/api/v1/workspaces/{workspace_id}/roadmap/topics/py-01/checks",
        json={
            "activityId": "act_py-01_v1",
            "activityVersion": "1.0",
            "selectedChoice": "invalid_choice_option_xyz",
        },
    )
    assert bad_res.status_code == 422
    assert "invalid answer choice" in _error_message(bad_res).lower()

    # 3. Missing choice selection
    missing_res = await client.post(
        f"/api/v1/workspaces/{workspace_id}/roadmap/topics/py-01/checks",
        json={
            "activityId": "act_py-01_v1",
            "activityVersion": "1.0",
            "selectedChoice": None,
        },
    )
    assert missing_res.status_code == 422
    assert "choice must be selected" in _error_message(missing_res).lower()

    # 4. Incorrect choice submission
    wrong_res = await client.post(
        f"/api/v1/workspaces/{workspace_id}/roadmap/topics/py-01/checks",
        json={
            "activityId": "act_py-01_v1",
            "activityVersion": "1.0",
            "selectedChoice": "Ada@Example.com",
        },
    )
    assert wrong_res.status_code == 201
    wrong_check = wrong_res.json()
    assert wrong_check["result"]["correct"] is False
    assert wrong_check["result"]["canRetry"] is True
    assert wrong_check["result"]["nextAction"] == "retry"
    assert "not correct" in wrong_check["result"]["feedback"]

    # 5. Correct choice retry
    correct_res = await client.post(
        f"/api/v1/workspaces/{workspace_id}/roadmap/topics/py-01/checks",
        json={
            "activityId": "act_py-01_v1",
            "activityVersion": "1.0",
            "selectedChoice": "ada@example.com",
        },
    )
    assert correct_res.status_code == 201
    correct_check = correct_res.json()
    assert correct_check["result"]["correct"] is True
    assert correct_check["result"]["canRetry"] is True
    assert correct_check["result"]["nextAction"] == "continue"
    assert "matches this check" in correct_check["result"]["feedback"]

    # 6. Verify total attempts in practice state
    final_state = await client.get(
        f"/api/v1/workspaces/{workspace_id}/roadmap/topics/py-01/checks"
    )
    assert final_state.status_code == 200
    assert final_state.json()["attemptsCount"] == 2
    assert final_state.json()["latestAttempt"]["correct"] is True


async def test_practice_authorization_isolation(practice_client, worker_job, curriculum_session):
    from models.user import WorkspaceMember

    client, ws = practice_client
    workspace_id = ws.view.workspace_id

    # 1. Unauthenticated request rejected
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as anon_client:
        res = await anon_client.get(
            f"/api/v1/workspaces/{workspace_id}/roadmap/topics/t1/checks"
        )
        assert res.status_code == 401

    # 2. Viewer user can read checks but cannot save draft or post attempt
    curriculum_session.add(
        WorkspaceMember(workspace_id=workspace_id, user_id=worker_job.owner_id, role="viewer")
    )
    await curriculum_session.commit()

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        cookies={"access_token": create_access_token(worker_job.owner_id)},
    ) as viewer_client:
        # Viewer can read checks
        get_res = await viewer_client.get(
            f"/api/v1/workspaces/{workspace_id}/roadmap/topics/t1/checks"
        )
        assert get_res.status_code == 200

        # Viewer cannot write draft
        put_res = await viewer_client.put(
            f"/api/v1/workspaces/{workspace_id}/roadmap/topics/t1/checks/draft",
            json={"activityId": "act_t1_v1", "activityVersion": "1.0", "draft": "Draft"},
        )
        assert put_res.status_code == 403

        # Viewer cannot post attempt
        post_res = await viewer_client.post(
            f"/api/v1/workspaces/{workspace_id}/roadmap/topics/t1/checks",
            json={
                "activityId": "act_t1_v1",
                "activityVersion": "1.0",
                "answer": "Substantive answer here.",
            },
        )
        assert post_res.status_code == 403
