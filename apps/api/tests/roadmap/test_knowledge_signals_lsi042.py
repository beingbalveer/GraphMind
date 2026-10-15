"""LSI-042 — Knowledge signals and curator parity acceptance locks.

These tests pin the ticket acceptance against the *existing* mastery/curator
services (no new endpoints, no inferred mastery):

- explicit learning signals (concept mastery + quiz feedback) stay distinct from
  topic completion (``not_started`` / ``in_progress`` / ``completed``),
- knowledge-signal state persists across requests (create → quiz → adopt),
- the exposed actions are authorized (read vs. write membership) and remain
  observable through the mastery/concepts/curator APIs.

Backend tests run against an isolated ``*_test`` database enforced by
``apps/api/tests/conftest.py``; never against live or user data.
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


async def test_explicit_mastery_signal_is_distinct_from_topic_completion(
    curriculum_workspace, curriculum_session
):
    """Completing a topic is progress; mastery is an explicit, separate signal."""
    view = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    workspace_id = view.workspace_id
    await curriculum_session.commit()

    async with _client(owner) as client:
        # 1. Completing a topic records progress — and nothing else.
        completed = await client.patch(
            f"/api/v1/workspaces/{workspace_id}/roadmap/topics/t1/progress",
            json={"status": "completed"},
        )
        assert completed.status_code == 200
        assert completed.json()["status"] == "completed"

        # 2. Completion never fabricates a mastery signal.
        mastery = await client.get(f"/api/v1/workspaces/{workspace_id}/mastery")
        assert mastery.status_code == 200
        body = mastery.json()
        assert body["totalConcepts"] == 0
        assert body["distribution"]["mastered"] == 0

        # 3. The completion vocabulary is distinct: "mastered" is not a status.
        rejected = await client.patch(
            f"/api/v1/workspaces/{workspace_id}/roadmap/topics/t1/progress",
            json={"status": "mastered"},
        )
        assert rejected.status_code == 422

        # 4. An explicit mastery signal is recorded on the concept, quiz-style.
        concept = await client.post(
            f"/api/v1/workspaces/{workspace_id}/concepts",
            json={
                "name": "Contour Line Drawing",
                "masteryLevel": "mastered",
                "confidenceScore": 0.9,
            },
        )
        assert concept.status_code == 201
        assert concept.json()["masteryLevel"] == "mastered"

        # 5. Mastery does not retroactively complete or alter topic progress.
        other_topic = await client.get(
            f"/api/v1/workspaces/{workspace_id}/roadmap/topics/t2"
        )
        assert other_topic.status_code == 200
        assert other_topic.json()["progress"]["status"] == "not_started"

        # The completed topic stays completed; the concept is the mastery record.
        assert (
            await client.get(f"/api/v1/workspaces/{workspace_id}/mastery")
        ).json()["distribution"]["mastered"] == 1


async def test_knowledge_signal_actions_persist(curriculum_workspace, curriculum_session):
    """Concept, gap, adopt, and recommendation state survive across requests."""
    view = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    workspace_id = view.workspace_id
    await curriculum_session.commit()

    async with _client(owner) as client:
        # Create a downstream concept with a missing prerequisite.
        created = await client.post(
            f"/api/v1/workspaces/{workspace_id}/concepts",
            json={
                "name": "Asyncio High-Level APIs",
                "masteryLevel": "explored",
                "confidenceScore": 0.75,
            },
        )
        assert created.status_code == 201

        mastery = await client.get(f"/api/v1/workspaces/{workspace_id}/mastery")
        assert mastery.status_code == 200
        assert mastery.json()["totalConcepts"] == 1
        assert mastery.json()["distribution"]["explored"] == 1

        # The curator detects the missing prerequisite.
        gaps = await client.get(f"/api/v1/workspaces/{workspace_id}/curator/gaps")
        assert gaps.status_code == 200
        gap = next(
            (g for g in gaps.json()["gaps"] if g["id"] == "python:event_loop"), None
        )
        assert gap is not None
        assert gap["status"] == "missing" and gap["severity"] == "high"

        # Adopt the gap through the exposed action.
        adopted = await client.post(
            f"/api/v1/workspaces/{workspace_id}/curator/gaps/python:event_loop/adopt",
            json={"initialMasteryLevel": "unexplored"},
        )
        assert adopted.status_code == 201
        adopted_body = adopted.json()
        assert adopted_body["metadata"]["source"] == "knowledge_curator"
        assert adopted_body["masteryLevel"] == "unexplored"

        # State persists: the adopted concept is listed and the gap status moves.
        listed = await client.get(f"/api/v1/workspaces/{workspace_id}/concepts")
        assert listed.status_code == 200
        assert {c["name"] for c in listed.json()} >= {
            "Asyncio High-Level APIs",
            "Event Loops & Task Schedulers",
        }

        re_gaps = await client.get(f"/api/v1/workspaces/{workspace_id}/curator/gaps")
        re_gap = next(
            (g for g in re_gaps.json()["gaps"] if g["id"] == "python:event_loop"), None
        )
        assert re_gap is not None and re_gap["status"] == "unexplored"

        # Explicit quiz feedback persists on the concept (and only there).
        quiz = await client.patch(
            f"/api/v1/workspaces/{workspace_id}/concepts/{adopted_body['id']}",
            json={"quizResult": True},
        )
        assert quiz.status_code == 200
        assert quiz.json()["timesQuizzed"] == 1
        assert quiz.json()["confidenceScore"] == 1.0
        assert quiz.json()["masteryLevel"] == "quizzed"

        # Recommendations remain an observable, persisted projection.
        recommendations = await client.get(
            f"/api/v1/workspaces/{workspace_id}/curator/next-topics?limit=3"
        )
        assert recommendations.status_code == 200
        assert recommendations.json()["workspaceId"] == workspace_id
        assert isinstance(recommendations.json()["recommendations"], list)


async def test_knowledge_signal_actions_are_authorized(
    curriculum_workspace, curriculum_session
):
    """Reads are member-scoped; writes require owner/editor; outsiders get 404."""
    from models.user import WorkspaceMember

    view = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    workspace_id = view.workspace_id
    await curriculum_session.commit()

    # Seed one concept as the owner so the viewer has something to (illegally) edit.
    async with _client(owner) as client:
        seeded = await client.post(
            f"/api/v1/workspaces/{workspace_id}/concepts",
            json={"name": "Asyncio High-Level APIs", "masteryLevel": "explored"},
        )
        assert seeded.status_code == 201
        concept_id = seeded.json()["id"]

    viewer = await _new_user(curriculum_session, "Signals Viewer")
    outsider = await _new_user(curriculum_session, "Signals Outsider")
    curriculum_session.add(
        WorkspaceMember(workspace_id=workspace_id, user_id=viewer.id, role="viewer")
    )
    await curriculum_session.commit()

    read_paths = [
        f"/api/v1/workspaces/{workspace_id}/mastery",
        f"/api/v1/workspaces/{workspace_id}/concepts",
        f"/api/v1/workspaces/{workspace_id}/curator/gaps",
        f"/api/v1/workspaces/{workspace_id}/curator/next-topics",
    ]
    write_paths = [
        (
            "post",
            f"/api/v1/workspaces/{workspace_id}/concepts",
            {"name": "Intruder concept"},
        ),
        (
            "patch",
            f"/api/v1/workspaces/{workspace_id}/concepts/{concept_id}",
            {"masteryLevel": "mastered"},
        ),
        (
            "post",
            f"/api/v1/workspaces/{workspace_id}/curator/gaps/python:event_loop/adopt",
            {"initialMasteryLevel": "unexplored"},
        ),
    ]

    # A viewer may read every signal but may not mutate any of them.
    async with _client(viewer.id) as viewer_client:
        for path in read_paths:
            assert (await viewer_client.get(path)).status_code == 200, path
        for method, path, payload in write_paths:
            denied = await getattr(viewer_client, method)(path, json=payload)
            assert denied.status_code == 403, path

    # A non-member sees nothing at all: reads and writes are indistinguishable 404s.
    async with _client(outsider.id) as outsider_client:
        for path in read_paths:
            assert (await outsider_client.get(path)).status_code == 404, path
        for method, path, payload in write_paths:
            denied = await getattr(outsider_client, method)(path, json=payload)
            assert denied.status_code == 404, path

    # The owner's writes still succeed and persist.
    async with _client(owner) as client:
        assert (
            await client.post(
                f"/api/v1/workspaces/{workspace_id}/curator/gaps/python:event_loop/adopt",
                json={"initialMasteryLevel": "unexplored"},
            )
        ).status_code == 201
