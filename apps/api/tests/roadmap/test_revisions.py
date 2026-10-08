import pytest
from schemas.roadmap_edit import EditRequest
from services.roadmap.progress import ProgressService
from services.roadmap.revision_service import (
    HistoryRemovalRequiredError,
    RevisionConflictError,
    RevisionService,
    RevisionValidationError,
)
from services.roadmap.tutor import TutorService


@pytest.fixture
async def revision_service(curriculum_session):
    return RevisionService(curriculum_session)


async def test_rename_and_move_preserve_completed_topic_and_chat(
    revision_service, curriculum_workspace, curriculum_session
):
    v = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    lesson = await TutorService(curriculum_session).open_session(
        v.workspace_id, "t1", owner, "lesson"
    )
    await ProgressService(curriculum_session).set_status(v.workspace_id, "t1", owner, "completed")
    edited = await revision_service.edit(
        v.workspace_id,
        owner,
        EditRequest(
            base_revision_id=v.revision_id,
            patches=[
                {"op": "update_item", "item_id": "t1", "title": "Confident lines"},
                {"op": "move_item", "item_id": "t1", "parent_id": "phase", "order": 4},
            ],
        ),
    )
    assert next(i for i in edited.candidate.items if i.id == "t1").title == "Confident lines"
    assert edited.progress["t1"].status == "completed"
    assert (
        await TutorService(curriculum_session).open_session(v.workspace_id, "t1", owner, "again")
    ).chat_id == lesson.chat_id
    restored = await revision_service.restore(
        v.workspace_id, owner, v.revision_id, edited.revision_id
    )
    assert restored.revision_id not in {v.revision_id, edited.revision_id}
    assert restored.progress["t1"].status == "completed"
    assert next(i for i in restored.candidate.items if i.id == "t1").title == "Line control"


async def test_removal_ack_archives_history_and_restore_keeps_it(
    revision_service, curriculum_workspace, curriculum_session
):
    v = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    lesson = await TutorService(curriculum_session).open_session(
        v.workspace_id, "t1", owner, "lesson"
    )
    request = EditRequest(
        base_revision_id=v.revision_id, patches=[{"op": "remove_topic", "item_id": "t1"}]
    )
    with pytest.raises(HistoryRemovalRequiredError):
        await revision_service.edit(v.workspace_id, owner, request)
    request.history_removal_ack = True
    edited = await revision_service.edit(v.workspace_id, owner, request)
    assert "t1" not in {i.id for i in edited.candidate.items}
    archived = await revision_service.archived_topics(v.workspace_id, owner)
    assert archived[0].item.id == "t1" and archived[0].sessions[0].chat_id == lesson.chat_id
    await revision_service.restore(v.workspace_id, owner, v.revision_id, edited.revision_id)
    assert await revision_service.archived_topics(v.workspace_id, owner) == []


async def test_stale_base_does_not_overwrite(revision_service, curriculum_workspace):
    v = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    request = EditRequest(
        base_revision_id=v.revision_id,
        patches=[{"op": "update_item", "item_id": "t1", "title": "First change"}],
    )
    edited = await revision_service.edit(v.workspace_id, owner, request)
    with pytest.raises(RevisionConflictError):
        await revision_service.edit(v.workspace_id, owner, request)
    with pytest.raises(RevisionConflictError):
        await revision_service.restore(v.workspace_id, owner, v.revision_id, v.revision_id)
    assert (await revision_service.history(v.workspace_id, owner))[0].id == edited.revision_id


async def test_over_budget_manual_edit_is_honest_warning(revision_service, curriculum_workspace):
    v = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    edited = await revision_service.edit(
        v.workspace_id,
        owner,
        EditRequest(
            base_revision_id=v.revision_id,
            patches=[{"op": "update_item", "item_id": "t1", "estimate_minutes": 1000}],
        ),
    )
    assert edited.profile.hours_per_week == v.profile.hours_per_week
    assert edited.validation.valid and any(
        i.code == "CAPACITY_EXCEEDED" and i.severity == "warning" for i in edited.validation.issues
    )
    assert sum(s.minutes for s in edited.candidate.sessions if s.topic_id == "t1") == 1000


async def test_new_topic_identity_and_initial_progress(revision_service, curriculum_workspace):
    v = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    item = v.candidate.items[2].model_copy(
        update={"id": "new-concept", "title": "Gesture drawing", "order": 5}
    )
    result = await revision_service.edit(
        v.workspace_id,
        owner,
        EditRequest(
            base_revision_id=v.revision_id,
            patches=[
                {"op": "add_topic", "parent_id": "phase", "item": item.model_dump()},
                {
                    "op": "replace_resources",
                    "item_id": "new-concept",
                    "resources": [
                        {
                            "topic_id": "new-concept",
                            "source_id": "s1",
                            "order": 0,
                            "rationale": "Practice observed lines and forms in the new drawing exercise.",
                        },
                        {
                            "topic_id": "new-concept",
                            "source_id": "s2",
                            "order": 1,
                            "rationale": "Compare these practical drawing exercises against your work.",
                        },
                    ],
                },
            ],
        ),
    )
    assert result.progress["new-concept"].status == "not_started"


async def test_structural_cycle_and_forged_resource_are_rejected(
    revision_service, curriculum_workspace
):
    v = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    with pytest.raises(RevisionValidationError):
        await revision_service.edit(
            v.workspace_id,
            owner,
            EditRequest(
                base_revision_id=v.revision_id,
                patches=[{"op": "move_item", "item_id": "phase", "parent_id": "t1", "order": 0}],
            ),
        )
    with pytest.raises(RevisionValidationError):
        await revision_service.edit(
            v.workspace_id,
            owner,
            EditRequest(
                base_revision_id=v.revision_id,
                patches=[
                    {
                        "op": "replace_resources",
                        "item_id": "t1",
                        "resources": [
                            {
                                "topic_id": "t1",
                                "source_id": "invented",
                                "order": 0,
                                "rationale": "An invented verified resource should never enter a saved curriculum.",
                            }
                        ],
                    }
                ],
            ),
        )


async def test_edit_http_auth_conflict_history_and_source_claims(
    curriculum_workspace, curriculum_session
):
    from httpx import ASGITransport, AsyncClient
    from main import app
    from services.auth_service import create_access_token

    await curriculum_session.commit()
    v = curriculum_workspace.view
    path = f"/api/v1/workspaces/{v.workspace_id}/roadmap"
    body = {
        "baseRevisionId": v.revision_id,
        "patches": [{"op": "update_item", "itemId": "t1", "title": "Saved rename"}],
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.patch(path, json=body)).status_code == 401
        client.cookies.set("access_token", create_access_token(curriculum_workspace.owner_id))
        saved = await client.patch(path, json=body)
        assert saved.status_code == 200
        assert (await client.patch(path, json=body)).json()["error"]["code"] == "REVISION_CONFLICT"
        history = await client.get(path + "/revisions")
        assert history.status_code == 200 and history.json()[0]["changed"] == ["t1"]
        assert (await client.get(path + "/archived-topics")).json() == []
        assert (
            await client.post(path + "/sources/inspect", json={"url": "http://127.0.0.1/private"})
        ).status_code == 422
        assert (
            await client.post(
                path + "/sources/inspect",
                json={"url": "https://example.com", "access": "free", "status": "inspected"},
            )
        ).status_code == 422
        restored = await client.post(
            path + f"/revisions/{v.revision_id}/restore",
            json={"baseRevisionId": saved.json()["revisionId"]},
        )
        assert restored.status_code == 200


async def test_null_title_is_rejected_without_saving(revision_service, curriculum_workspace):
    v = curriculum_workspace.view
    with pytest.raises(RevisionValidationError):
        await revision_service.edit(
            v.workspace_id,
            curriculum_workspace.owner_id,
            EditRequest(
                base_revision_id=v.revision_id,
                patches=[{"op": "update_item", "item_id": "t1", "title": None}],
            ),
        )
    assert (await revision_service.history(v.workspace_id, curriculum_workspace.owner_id))[
        0
    ].id == v.revision_id


async def test_inspected_source_can_be_selected_without_client_verification(
    curriculum_workspace, curriculum_session, sources, monkeypatch
):
    from httpx import ASGITransport, AsyncClient
    from main import app
    from services.auth_service import create_access_token

    async def inspect(_self, url):
        return sources[0].model_copy(
            update={"id": "inspected-new", "url": url, "access": "unknown"}
        )

    monkeypatch.setattr("services.roadmap.source_fetcher.SourceFetcher.fetch", inspect)
    await curriculum_session.commit()
    v = curriculum_workspace.view
    path = f"/api/v1/workspaces/{v.workspace_id}/roadmap"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        client.cookies.set("access_token", create_access_token(curriculum_workspace.owner_id))
        inspected = await client.post(
            path + "/sources/inspect", json={"url": "https://example.com/new-public-source"}
        )
        assert inspected.status_code == 200 and inspected.json()["access"] == "unknown"
        saved = await client.patch(
            path,
            json={
                "baseRevisionId": v.revision_id,
                "patches": [
                    {
                        "op": "replace_resources",
                        "itemId": "t1",
                        "resources": [
                            {
                                "topicId": "t1",
                                "sourceId": inspected.json()["id"],
                                "order": 0,
                                "rationale": "Supports line control exercises with practical observation examples.",
                            }
                        ],
                    }
                ],
            },
        )
        assert saved.status_code == 200
        assert any(
            s["id"] == "inspected-new" and s["access"] == "unknown" for s in saved.json()["sources"]
        )


async def test_choice_recomputes_selected_core_and_rejects_broken_choice(
    revision_service, curriculum_workspace, curriculum_session
):
    from schemas.curriculum import ChoiceData, CurriculumItemData, CurriculumRelationData
    from services.roadmap.curriculum_repository import CurriculumRepository
    from services.roadmap.validation import validate_curriculum
    from services.roadmap.workload import schedule_core, selected_core_topics

    v = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    candidate = v.candidate.model_copy(deep=True)
    candidate.items.append(
        CurriculumItemData(id="choose", kind="choice", title="Choose a practice", order=2)
    )
    candidate.relations = [
        r for r in candidate.relations if not (r.kind == "contains" and r.target_id in {"t2", "t3"})
    ]
    candidate.relations.extend(
        [
            CurriculumRelationData(source_id="phase", target_id="choose", kind="contains"),
            CurriculumRelationData(source_id="choose", target_id="t2", kind="contains"),
            CurriculumRelationData(source_id="choose", target_id="t3", kind="contains"),
        ]
    )
    candidate.choices = [
        ChoiceData(
            choice_id="choose", selected_id="t2", rationale="Choose one drawing practice initially."
        )
    ]
    candidate.sessions = schedule_core(candidate, v.profile)
    base = await CurriculumRepository(curriculum_session, owner).save_revision(
        v.roadmap_id,
        v.revision_id,
        candidate,
        v.sources,
        validate_curriculum(candidate, v.profile, v.sources),
        "active",
    )
    changed = await revision_service.edit(
        v.workspace_id,
        owner,
        EditRequest(
            base_revision_id=base,
            patches=[{"op": "select_alternative", "choice_id": "choose", "selected_id": "t3"}],
        ),
    )
    assert {i.id for i in selected_core_topics(changed.candidate)} == {"t1", "t3"}
    assert "t2" not in {s.topic_id for s in changed.candidate.sessions}
    with pytest.raises(RevisionValidationError):
        await revision_service.edit(
            v.workspace_id,
            owner,
            EditRequest(
                base_revision_id=changed.revision_id,
                patches=[
                    {"op": "select_alternative", "choice_id": "choose", "selected_id": "missing"}
                ],
            ),
        )


async def test_containment_cycle_does_not_save(
    revision_service, curriculum_workspace, curriculum_session
):
    from schemas.curriculum import CurriculumItemData, CurriculumRelationData
    from services.roadmap.curriculum_repository import CurriculumRepository
    from services.roadmap.validation import validate_curriculum

    v = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    candidate = v.candidate.model_copy(deep=True)
    candidate.items.append(
        CurriculumItemData(id="practice-group", kind="group", title="Practice group", order=5)
    )
    candidate.relations.append(
        CurriculumRelationData(source_id="phase", target_id="practice-group", kind="contains")
    )
    candidate.relations = [
        r for r in candidate.relations if not (r.kind == "contains" and r.target_id == "t3")
    ]
    candidate.relations.append(
        CurriculumRelationData(source_id="practice-group", target_id="t3", kind="contains")
    )
    base = await CurriculumRepository(curriculum_session, owner).save_revision(
        v.roadmap_id,
        v.revision_id,
        candidate,
        v.sources,
        validate_curriculum(candidate, v.profile, v.sources),
        "active",
    )
    with pytest.raises(RevisionValidationError):
        await revision_service.edit(
            v.workspace_id,
            owner,
            EditRequest(
                base_revision_id=base,
                patches=[
                    {
                        "op": "move_item",
                        "item_id": "phase",
                        "parent_id": "practice-group",
                        "order": 0,
                    }
                ],
            ),
        )
    assert (await revision_service.history(v.workspace_id, owner))[0].id == base


async def test_concurrent_edit_has_one_winner(curriculum_workspace, curriculum_session):
    import asyncio

    from database import get_session_factory

    v = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    await curriculum_session.commit()

    async def save(title):
        async with get_session_factory()() as db:
            try:
                result = await RevisionService(db).edit(
                    v.workspace_id,
                    owner,
                    EditRequest(
                        base_revision_id=v.revision_id,
                        patches=[{"op": "update_item", "item_id": "t1", "title": title}],
                    ),
                )
                await db.commit()
                return result.revision_id
            except RevisionConflictError:
                await db.rollback()
                return "conflict"

    results = await asyncio.gather(save("Tab one"), save("Tab two"))
    assert results.count("conflict") == 1
