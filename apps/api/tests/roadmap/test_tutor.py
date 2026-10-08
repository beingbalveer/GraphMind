import pytest
from services.roadmap.tutor import TutorService


async def test_default_reopens_and_fresh_preserves_first(curriculum_workspace, curriculum_session):
    view = curriculum_workspace.view
    service = TutorService(curriculum_session)
    first = await service.open_session(
        view.workspace_id, "t1", curriculum_workspace.owner_id, "first"
    )
    again = await service.open_session(
        view.workspace_id, "t1", curriculum_workspace.owner_id, "again"
    )
    fresh = await service.open_session(
        view.workspace_id, "t1", curriculum_workspace.owner_id, "fresh", fresh=True
    )
    assert first.chat_id == again.chat_id and not again.is_new
    assert fresh.chat_id != first.chat_id
    assert (
        await service.open_session(
            view.workspace_id, "t1", curriculum_workspace.owner_id, "fresh", fresh=True
        )
    ).id == fresh.id
    assert len(await service.build_context(first.id, curriculum_workspace.owner_id)) >= 2


async def test_session_rejects_other_owner_and_wrong_topic(
    curriculum_workspace, curriculum_session, worker_job
):
    from fastapi import HTTPException

    view = curriculum_workspace.view
    service = TutorService(curriculum_session)
    lesson = await service.open_session(
        view.workspace_id, "t1", curriculum_workspace.owner_id, "first"
    )
    with pytest.raises(HTTPException):
        await service.build_context(lesson.id, worker_job.owner_id)
    with pytest.raises(HTTPException):
        await service.open_session(
            view.workspace_id, "other-topic", curriculum_workspace.owner_id, "wrong"
        )


async def test_two_concurrent_opens_share_default(curriculum_workspace, curriculum_session):
    import asyncio

    from database import get_session_factory

    view = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    await curriculum_session.commit()

    async def open_one(key):
        async with get_session_factory()() as session:
            result = await TutorService(session).open_session(view.workspace_id, "t1", owner, key)
            await session.commit()
            return result

    first, second = await asyncio.gather(open_one("one"), open_one("two"))
    assert first.id == second.id and first.chat_id == second.chat_id


async def test_archived_topic_session_retains_recorded_brief(
    curriculum_workspace, curriculum_session
):
    from services.roadmap.curriculum_repository import CurriculumRepository
    from services.roadmap.validation import validate_curriculum

    view = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    lesson = await TutorService(curriculum_session).open_session(
        view.workspace_id, "t1", owner, "open"
    )
    candidate = view.candidate.model_copy(deep=True)
    candidate.items = [i for i in candidate.items if i.id != "t1"]
    candidate.relations = [
        r for r in candidate.relations if r.source_id != "t1" and r.target_id != "t1"
    ]
    candidate.resources = [r for r in candidate.resources if r.topic_id != "t1"]
    candidate.sessions = [s for s in candidate.sessions if s.topic_id != "t1"]
    repository = CurriculumRepository(curriculum_session, owner)
    archived_revision = await repository.save_revision(
        view.roadmap_id,
        view.revision_id,
        candidate,
        view.sources,
        validate_curriculum(candidate, view.profile, view.sources),
        "active",
    )
    context = await TutorService(curriculum_session).build_context(lesson.id, owner)
    assert '"archived": true' in context[-1].content
    assert '"id": "t1"' in context[-1].content

    restored = await repository.save_revision(
        view.roadmap_id,
        archived_revision,
        view.candidate,
        view.sources,
        validate_curriculum(view.candidate, view.profile, view.sources),
        "active",
    )
    data = await TutorService(curriculum_session).session_data(lesson.id, owner)
    assert not data.archived
    assert data.revision_id == view.revision_id and restored != view.revision_id
    reopened = await TutorService(curriculum_session).open_session(
        view.workspace_id, "t1", owner, "reopen-after-restore"
    )
    assert reopened.id == lesson.id


async def test_lesson_claim_prevents_duplicate_and_can_resume_interruption(
    curriculum_workspace, curriculum_session
):
    from errors import RoadmapHTTPError
    from models.workspace import NodeModel

    view = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    service = TutorService(curriculum_session)
    lesson = await service.open_session(view.workspace_id, "t1", owner, "open")
    token = await service.claim_lesson(lesson.id, owner)
    with pytest.raises(RoadmapHTTPError) as error:
        await service.claim_lesson(lesson.id, owner)
    assert error.value.error.code == "LESSON_ALREADY_STARTED"
    await service.finish_lesson(lesson.id, owner, token, "", completed=False)
    resumed = await service.claim_lesson(lesson.id, owner)
    assert resumed != token
    assert not await service.finish_lesson(lesson.id, owner, token, "Late result", completed=True)
    assert await service.finish_lesson(
        lesson.id, owner, resumed, "A manageable first lesson", completed=True
    )
    row, _ = await service.read_session(lesson.id, owner)
    assert row.lesson_start_state == "completed"
    assistant = await curriculum_session.get(NodeModel, f"{lesson.chat_id}_lesson")
    assert assistant.content == "A manageable first lesson"
    with pytest.raises(RoadmapHTTPError):
        await service.claim_lesson(lesson.id, owner)


async def test_topic_http_actions_require_real_auth_and_write_access(
    curriculum_workspace, curriculum_session
):
    import uuid

    from httpx import ASGITransport, AsyncClient
    from main import app
    from services.auth_service import create_access_token

    await curriculum_session.commit()
    view = curriculum_workspace.view
    path = f"/api/v1/workspaces/{view.workspace_id}/roadmap/topics/t1"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (
            await client.post(
                path + "/sessions",
                headers={"Idempotency-Key": str(uuid.uuid4())},
                json={"fresh": False},
            )
        ).status_code == 401
        client.cookies.set("access_token", create_access_token(curriculum_workspace.owner_id))
        first = await client.post(
            path + "/sessions",
            headers={"Idempotency-Key": str(uuid.uuid4())},
            json={"fresh": False},
        )
        assert first.status_code == 201
        assert first.json()["lessonStartState"] == "pending"
        progress = await client.patch(path + "/progress", json={"status": "completed"})
        assert progress.status_code == 200 and progress.json()["status"] == "completed"
        assert (
            await client.get(
                f"/api/v1/workspaces/{view.workspace_id}/roadmap/sessions/{first.json()['id']}"
            )
        ).status_code == 200
        check = await client.post(path + "/checks", json={"sessionId": first.json()["id"]})
        assert check.status_code == 409 and check.json()["error"]["code"] == "CHECK_NOT_READY"


@pytest.mark.parametrize("endpoint", ["stream", "completions"])
async def test_tutor_chat_verifies_session_and_ignores_forged_context(
    curriculum_workspace, curriculum_session, monkeypatch, endpoint
):
    from ai_core import GenerationResult, StreamChunk
    from httpx import ASGITransport, AsyncClient
    from main import app
    from routers import chat as chat_router
    from services.auth_service import create_access_token

    view = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    lesson = await TutorService(curriculum_session).open_session(
        view.workspace_id, "t1", owner, "open"
    )
    await curriculum_session.commit()
    seen = []

    class Provider:
        async def generate(self, messages, config, tools=None):
            seen.append((messages, config))
            return GenerationResult(model_name="scripted", content="A manageable lesson")

        async def stream(self, messages, config, tools=None):
            seen.append((messages, config))
            yield StreamChunk(content="A manageable lesson")

    monkeypatch.setattr(chat_router, "get_provider", lambda *args, **kwargs: Provider())
    payload = {
        "prompt": "Teach me",
        "provider": "mock",
        "workspaceId": view.workspace_id,
        "topicSessionId": lesson.id,
        "parentNodeId": lesson.chat_id,
        "lessonStart": True,
        "enableRag": False,
        "systemPrompt": "FORGED_CURRICULUM",
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.post(f"/api/v1/chat/{endpoint}", json=payload)).status_code == 401
        client.cookies.set("access_token", create_access_token(owner))
        wrong = await client.post(
            f"/api/v1/chat/{endpoint}", json={**payload, "workspaceId": "another"}
        )
        assert wrong.status_code == 404
        response = await client.post(f"/api/v1/chat/{endpoint}", json=payload)
        assert response.status_code == 200
        assert "FORGED_CURRICULUM" not in seen[-1][1].system_prompt
        assert any('"id": "t1"' in message.content for message in seen[-1][0])
        assert (await client.post(f"/api/v1/chat/{endpoint}", json=payload)).status_code == 409
    await curriculum_session.rollback()
    row, _ = await TutorService(curriculum_session).read_session(lesson.id, owner)
    assert row.lesson_start_state == "completed"


async def test_interrupted_stream_keeps_partial_lesson_for_explicit_resume(
    curriculum_workspace, curriculum_session, monkeypatch
):
    from ai_core import StreamChunk
    from httpx import ASGITransport, AsyncClient
    from main import app
    from models.workspace import NodeModel
    from routers import chat as chat_router
    from services.auth_service import create_access_token

    view = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    lesson = await TutorService(curriculum_session).open_session(
        view.workspace_id, "t1", owner, "open"
    )
    await curriculum_session.commit()

    class InterruptedProvider:
        async def stream(self, messages, config, tools=None):
            yield StreamChunk(content="First useful explanation")
            raise RuntimeError("Synthetic provider interruption")

    monkeypatch.setattr(chat_router, "get_provider", lambda *args, **kwargs: InterruptedProvider())
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        cookies={"access_token": create_access_token(owner)},
    ) as client:
        response = await client.post(
            "/api/v1/chat/stream",
            json={
                "prompt": "Teach me",
                "workspaceId": view.workspace_id,
                "topicSessionId": lesson.id,
                "parentNodeId": lesson.chat_id,
                "lessonStart": True,
                "enableRag": False,
            },
        )
        assert "event: error" in response.text
        data = (
            await client.get(f"/api/v1/workspaces/{view.workspace_id}/roadmap/sessions/{lesson.id}")
        ).json()
        assert (
            data["lessonStartState"] == "interrupted"
            and data["progress"]["status"] == "in_progress"
        )
    await curriculum_session.rollback()
    assert (
        await curriculum_session.get(NodeModel, f"{lesson.chat_id}_lesson")
    ).content == "First useful explanation"


async def test_real_tutor_does_not_silently_use_mock_provider(
    curriculum_workspace, curriculum_session, monkeypatch
):
    from ai_core.providers import MockProvider
    from httpx import ASGITransport, AsyncClient
    from main import app
    from routers import chat as chat_router
    from services.auth_service import create_access_token

    view = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    lesson = await TutorService(curriculum_session).open_session(
        view.workspace_id, "t1", owner, "open"
    )
    await curriculum_session.commit()
    monkeypatch.setattr(chat_router, "get_provider", lambda *args, **kwargs: MockProvider())
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        cookies={"access_token": create_access_token(owner)},
    ) as client:
        response = await client.post(
            "/api/v1/chat/stream",
            json={
                "prompt": "Teach me",
                "workspaceId": view.workspace_id,
                "topicSessionId": lesson.id,
                "parentNodeId": lesson.chat_id,
                "lessonStart": True,
                "enableRag": False,
            },
        )
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "MODEL_NOT_CONFIGURED"


async def test_demoted_viewer_can_read_saved_and_archived_lesson_but_cannot_write(
    curriculum_workspace, curriculum_session, worker_job
):
    from fastapi import HTTPException
    from httpx import ASGITransport, AsyncClient
    from main import app
    from models.user import WorkspaceMember
    from services.auth_service import create_access_token
    from services.roadmap.curriculum_repository import CurriculumRepository
    from services.roadmap.validation import validate_curriculum

    view = curriculum_workspace.view
    learner = worker_job.owner_id
    member = WorkspaceMember(workspace_id=view.workspace_id, user_id=learner, role="editor")
    curriculum_session.add(member)
    await curriculum_session.flush()
    tutor = TutorService(curriculum_session)
    lesson = await tutor.open_session(view.workspace_id, "t1", learner, "viewer-history")
    candidate = view.candidate.model_copy(deep=True)
    candidate.items = [i for i in candidate.items if i.id != "t1"]
    candidate.relations = [
        r for r in candidate.relations if r.source_id != "t1" and r.target_id != "t1"
    ]
    candidate.resources = [r for r in candidate.resources if r.topic_id != "t1"]
    candidate.sessions = [s for s in candidate.sessions if s.topic_id != "t1"]
    await CurriculumRepository(curriculum_session, curriculum_workspace.owner_id).save_revision(
        view.roadmap_id,
        view.revision_id,
        candidate,
        view.sources,
        validate_curriculum(candidate, view.profile, view.sources),
        "active",
    )
    member.role = "viewer"
    await curriculum_session.commit()
    base = f"/api/v1/workspaces/{view.workspace_id}/roadmap"
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"Authorization": "Bearer " + create_access_token(learner)},
    ) as client:
        saved = await client.get(base + "/sessions/" + lesson.id)
        assert saved.status_code == 200 and saved.json()["archived"]
        archived = await client.get(base + "/archived-topics")
        assert archived.status_code == 200 and lesson.id in archived.text
        assert (
            await client.patch(base + "/topics/t2/progress", json={"status": "completed"})
        ).status_code == 403
    for operation in [
        tutor.claim_lesson(lesson.id, learner),
        tutor.finish_lesson(lesson.id, learner, "token", "new", completed=True),
    ]:
        with pytest.raises(HTTPException) as raised:
            await operation
        assert raised.value.status_code == 403
