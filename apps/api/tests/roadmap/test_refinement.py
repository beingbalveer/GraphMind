import pytest
from schemas.roadmap_edit import EditRequest
from services.roadmap.curriculum_repository import CurriculumRepository
from services.roadmap.progress import ProgressService
from services.roadmap.revision_service import (
    RevisionConflictError,
    RevisionService,
    compare_revisions,
)
from services.roadmap.validation import validate_curriculum


def test_revision_diff_uses_identity_for_rename(small_candidate):
    changed = small_candidate.model_copy(deep=True)
    topic = next(i for i in changed.items if i.kind == "topic")
    topic.title = "A clearer title"
    diff = compare_revisions(small_candidate, changed)
    assert diff.added == [] and diff.removed == [] and topic.id in diff.changed
    assert diff.identity_changes == []


async def test_proposal_waits_for_explicit_apply_and_preserves_completion(
    curriculum_workspace, curriculum_session
):
    v = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    repo = CurriculumRepository(curriculum_session, owner)
    await ProgressService(curriculum_session).set_status(v.workspace_id, "t1", owner, "completed")
    candidate = v.candidate.model_copy(deep=True)
    candidate.items[2].title = "Confident line control"
    proposal = await repo.save_revision(
        v.roadmap_id,
        v.revision_id,
        candidate,
        v.sources,
        validate_curriculum(candidate, v.profile, v.sources),
        "candidate",
    )
    assert (await repo.read(v.workspace_id)).revision_id == v.revision_id
    applied = await RevisionService(curriculum_session).apply(
        v.workspace_id, owner, proposal, v.revision_id
    )
    assert applied.revision_id == proposal and applied.progress["t1"].status == "completed"
    again = await RevisionService(curriculum_session).apply(
        v.workspace_id, owner, proposal, v.revision_id
    )
    assert again.revision_id == proposal


async def test_current_edit_survives_an_outdated_proposal(curriculum_workspace, curriculum_session):
    v = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    repo = CurriculumRepository(curriculum_session, owner)
    candidate = v.candidate.model_copy(deep=True)
    candidate.items[2].title = "Agent proposal"
    proposal = await repo.save_revision(
        v.roadmap_id,
        v.revision_id,
        candidate,
        v.sources,
        validate_curriculum(candidate, v.profile, v.sources),
        "candidate",
    )
    current = await RevisionService(curriculum_session).edit(
        v.workspace_id,
        owner,
        EditRequest(
            base_revision_id=v.revision_id,
            patches=[{"op": "update_item", "item_id": "t1", "title": "My direct edit"}],
        ),
    )
    with pytest.raises(RevisionConflictError):
        await RevisionService(curriculum_session).apply(
            v.workspace_id, owner, proposal, v.revision_id
        )
    assert (await repo.read(v.workspace_id)).revision_id == current.revision_id


async def test_refinement_understanding_preserves_original_goal_and_pace(
    executor_setup, small_profile
):
    import json

    from ai_core.base import GenerationResult

    executor, provider, claim, job, _repos = executor_setup
    job.operation = "refine"
    job.request.prompt = "Make this more practical with more drawing exercises"
    job.checkpoint.profile = small_profile
    provider.generate.return_value = GenerationResult(
        model_name="test",
        content=json.dumps(
            {
                "profile": small_profile.model_copy(
                    update={"prompt": job.request.prompt, "hours_per_week": None, "duration": None}
                ).model_dump(mode="json")
            }
        ),
    )
    result = await executor.run("understand", job, claim)
    assert result.checkpoint.profile.prompt == small_profile.prompt
    assert result.checkpoint.profile.hours_per_week == small_profile.hours_per_week
    assert result.checkpoint.profile.duration == small_profile.duration


def test_archiving_a_topic_is_a_removal_in_the_proposal_summary(small_candidate):
    changed = small_candidate.model_copy(deep=True)
    changed.items[2].participation = "archived"
    assert compare_revisions(small_candidate, changed).removed == ["t1"]


def test_changed_reused_identity_requires_qualitative_continuity(small_candidate):
    from services.roadmap.revision_service import identity_review_issues

    changed = small_candidate.model_copy(deep=True)
    changed.items[2].title = "Completely different concept"
    assert identity_review_issues(small_candidate, changed, {})
    changed.items[2].title = "Confident line drawing"
    assert (
        identity_review_issues(
            small_candidate,
            changed,
            {
                "t1": "Same line-control concept, original objectives and practice remain; only the label is clearer."
            },
        )
        == []
    )


async def test_replaying_applied_proposal_never_overwrites_later_edit(
    curriculum_workspace, curriculum_session
):
    v = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    repo = CurriculumRepository(curriculum_session, owner)
    candidate = v.candidate.model_copy(deep=True)
    candidate.items[2].title = "First proposal"
    proposal = await repo.save_revision(
        v.roadmap_id,
        v.revision_id,
        candidate,
        v.sources,
        validate_curriculum(candidate, v.profile, v.sources),
        "candidate",
    )
    applied = await RevisionService(curriculum_session).apply(
        v.workspace_id, owner, proposal, v.revision_id
    )
    edited = await RevisionService(curriculum_session).edit(
        v.workspace_id,
        owner,
        EditRequest(
            base_revision_id=applied.revision_id,
            patches=[{"op": "update_item", "item_id": "t1", "title": "Later user edit"}],
        ),
    )
    replay = await RevisionService(curriculum_session).apply(
        v.workspace_id, owner, proposal, v.revision_id
    )
    assert replay.revision_id == edited.revision_id


def test_refinement_scopes_new_model_labels_without_changing_existing_ids(small_candidate):
    from schemas.curriculum import CurriculumRelationData
    from services.roadmap.publication import refinement_identities

    changed = small_candidate.model_copy(deep=True)
    changed.items.append(
        changed.items[2].model_copy(update={"id": "new-topic", "title": "A new concept"})
    )
    changed.relations.append(
        CurriculumRelationData(source_id="phase", target_id="new-topic", kind="contains")
    )
    one = refinement_identities("job-one", small_candidate, changed)
    two = refinement_identities("job-two", small_candidate, changed)
    assert next(i.id for i in one.items if i.title == "Line control") == "t1"
    new_one = next(i.id for i in one.items if i.title == "A new concept")
    new_two = next(i.id for i in two.items if i.title == "A new concept")
    assert new_one != new_two and new_one != "new-topic"
    assert any(r.target_id == new_one for r in one.relations)


async def test_refinement_endpoint_seeds_base_and_replays_request(
    curriculum_workspace, curriculum_session
):
    import uuid

    from httpx import ASGITransport, AsyncClient
    from main import app
    from models.roadmap_job import RoadmapJob
    from schemas.roadmap_job import JobCheckpoint
    from services.auth_service import create_access_token
    from sqlalchemy import delete

    v = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    await curriculum_session.commit()
    path = f"/api/v1/workspaces/{v.workspace_id}/roadmap/refinements"
    key = str(uuid.uuid4())
    job_id = None
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            body = {
                "baseRevisionId": v.revision_id,
                "instruction": "Add more deliberate practical drawing exercises",
            }
            assert (
                await client.post(path, headers={"Idempotency-Key": key}, json=body)
            ).status_code == 401
            client.cookies.set("access_token", create_access_token(owner))
            created = await client.post(path, headers={"Idempotency-Key": key}, json=body)
            assert created.status_code == 202
            data = created.json()
            job_id = data["id"]
            assert (
                data["operation"] == "refine"
                and data["targetWorkspaceId"] == v.workspace_id
                and data["startupReady"]
            )
            assert "checkpoint" not in data and "request" not in data
            assert (await client.post(path, headers={"Idempotency-Key": key}, json=body)).json()[
                "id"
            ] == job_id
            row = await curriculum_session.get(RoadmapJob, job_id)
            checkpoint = JobCheckpoint.model_validate(row.checkpoint)
            assert (
                checkpoint.profile.prompt == v.profile.prompt
                and checkpoint.original_candidate == v.candidate
            )
            assert (
                await CurriculumRepository(curriculum_session, owner).read(v.workspace_id)
            ).revision_id == v.revision_id
            body["instruction"] = "            "
            assert (
                await client.post(path, headers={"Idempotency-Key": str(uuid.uuid4())}, json=body)
            ).status_code == 422
    finally:
        if job_id:
            await curriculum_session.execute(delete(RoadmapJob).where(RoadmapJob.id == job_id))
        await curriculum_session.commit()


async def test_new_concept_gets_no_transferred_completion(curriculum_workspace, curriculum_session):
    from schemas.curriculum import CurriculumRelationData
    from services.roadmap.workload import schedule_core

    v = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    repo = CurriculumRepository(curriculum_session, owner)
    await ProgressService(curriculum_session).set_status(v.workspace_id, "t1", owner, "completed")
    candidate = v.candidate.model_copy(deep=True)
    candidate.items[2].participation = "archived"
    candidate.items.append(
        candidate.items[2].model_copy(
            update={
                "id": "different-concept",
                "participation": "active",
                "title": "Gesture drawing",
            }
        )
    )
    candidate.relations = [
        r for r in candidate.relations if not (r.kind == "prerequisite" and r.source_id == "t1")
    ]
    candidate.relations.append(
        CurriculumRelationData(source_id="phase", target_id="different-concept", kind="contains")
    )
    candidate.resources.extend(
        [
            r.model_copy(update={"topic_id": "different-concept"})
            for r in candidate.resources
            if r.topic_id == "t1"
        ]
    )
    candidate.sessions = schedule_core(candidate, v.profile)
    proposal = await repo.save_revision(
        v.roadmap_id,
        v.revision_id,
        candidate,
        v.sources,
        validate_curriculum(candidate, v.profile, v.sources),
        "candidate",
    )
    applied = await RevisionService(curriculum_session).apply(
        v.workspace_id, owner, proposal, v.revision_id, True
    )
    assert applied.progress["t1"].status == "completed"
    assert applied.progress["different-concept"].status == "not_started"


@pytest.mark.parametrize("action", ["apply", "reject"])
async def test_proposal_http_action_records_handling_without_rolling_back_progress(
    curriculum_workspace, curriculum_session, action
):
    import uuid

    from httpx import ASGITransport, AsyncClient
    from main import app
    from models.roadmap_job import RoadmapJob
    from services.auth_service import create_access_token
    from sqlalchemy import delete

    v = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    service = RevisionService(curriculum_session)
    accepted = await service.request_refinement(
        v.workspace_id,
        owner,
        "Add short deliberate drawing drills",
        v.revision_id,
        str(uuid.uuid4()),
    )
    candidate = v.candidate.model_copy(deep=True)
    candidate.items[2].exercise = "Draw ten slow parallel lines, then compare their spacing."
    proposal = await CurriculumRepository(curriculum_session, owner).save_revision(
        v.roadmap_id,
        v.revision_id,
        candidate,
        v.sources,
        validate_curriculum(candidate, v.profile, v.sources),
        "candidate",
    )
    job = await curriculum_session.get(RoadmapJob, accepted.id)
    job.status = "completed"
    job.result = {
        "kind": "proposal",
        "workspace_id": v.workspace_id,
        "roadmap_id": v.roadmap_id,
        "revision_id": proposal,
        "proposal_state": "candidate",
    }
    # Progress may advance while the background proposal is being generated.
    await ProgressService(curriculum_session).set_status(v.workspace_id, "t1", owner, "completed")
    await curriculum_session.commit()
    path = f"/api/v1/workspaces/{v.workspace_id}/roadmap/revisions/{proposal}"
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            assert (
                await client.post(f"{path}/{action}", json={"baseRevisionId": v.revision_id})
            ).status_code == 401
            client.cookies.set("access_token", create_access_token(owner))
            review = await client.get(f"{path}/proposal")
            assert review.status_code == 200
            assert review.json()["affectedCompletedTopics"] == ["t1"]
            response = await client.post(f"{path}/{action}", json={"baseRevisionId": v.revision_id})
            assert response.status_code == (200 if action == "apply" else 204)
            if action == "apply":
                assert response.json()["revisionId"] == proposal
                assert response.json()["progress"]["t1"]["status"] == "completed"
            handled = await client.get(f"/api/v1/roadmap/jobs/{accepted.id}")
            assert handled.json()["result"]["proposalState"] == (
                "applied" if action == "apply" else "rejected"
            )
            latest = await CurriculumRepository(curriculum_session, owner).read(v.workspace_id)
            # Clear the identity map so the committed HTTP write is observed.
            curriculum_session.expire_all()
            latest = await CurriculumRepository(curriculum_session, owner).read(v.workspace_id)
            assert latest.revision_id == (proposal if action == "apply" else v.revision_id)
            assert latest.progress["t1"].status == "completed"
            if action == "reject":
                assert (
                    await client.post(f"{path}/apply", json={"baseRevisionId": v.revision_id})
                ).status_code == 404
    finally:
        await curriculum_session.execute(delete(RoadmapJob).where(RoadmapJob.id == accepted.id))
        await curriculum_session.commit()
