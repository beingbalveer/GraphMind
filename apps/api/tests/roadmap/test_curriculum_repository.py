import uuid

import pytest
from models.roadmap import (
    CurriculumItem,
    CurriculumRevision,
    Roadmap,
    TopicChat,
    TopicProgress,
    TopicResource,
)
from models.workspace import Workspace
from schemas.workspace import NodeCreate, WorkspaceCreate
from services.roadmap.curriculum_repository import CurriculumRepository
from services.roadmap.validation import validate_curriculum
from services.roadmap.workload import schedule_core
from services.workspace_service import WorkspaceService
from sqlalchemy import delete, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession


async def test_read_roundtrips_curriculum(
    repository: CurriculumRepository, curriculum_workspace
) -> None:
    saved = curriculum_workspace.view
    loaded = await repository.read(saved.workspace_id)
    assert loaded is not None
    assert loaded == saved
    brief = await repository.read_brief(saved.workspace_id, "t2")
    assert [i.id for i in brief.prerequisites] == ["t1"]
    assert len(brief.resources) == 2 and brief.resources[0].rationale


async def test_rename_move_remove_preserve_identity_and_history(
    repository: CurriculumRepository, curriculum_workspace
) -> None:
    before = curriculum_workspace.view
    db = curriculum_workspace.session
    db.add(
        TopicProgress(
            roadmap_id=before.roadmap_id,
            topic_id="t1",
            owner_id=curriculum_workspace.owner_id,
            status="completed",
        )
    )
    db.add(
        TopicChat(
            id="lesson-one",
            roadmap_id=before.roadmap_id,
            topic_id="t1",
            owner_id=curriculum_workspace.owner_id,
            chat_id=before.canvas_anchor_chat_id,
            revision_id=before.revision_id,
            request_key="first",
            default_key="default",
        )
    )
    await db.flush()
    candidate = before.candidate.model_copy(deep=True)
    candidate.items[2].title = "Deliberate line practice"
    candidate.items[2].order = 5
    candidate.sessions = schedule_core(candidate, before.profile)
    report = validate_curriculum(candidate, before.profile, before.sources)
    revision_id = await repository.save_revision(
        before.roadmap_id, before.revision_id, candidate, before.sources, report, "active"
    )
    changed = await repository.read(before.workspace_id)
    assert changed and changed.revision_id == revision_id
    assert changed.progress["t1"].status == "completed"
    old = await db.get(CurriculumRevision, before.revision_id)
    assert old and old.status == "archived"
    candidate.items[2].participation = "archived"
    candidate.relations = [r for r in candidate.relations if r.kind != "prerequisite"]
    candidate.sessions = schedule_core(candidate, before.profile)
    await repository.save_revision(
        before.roadmap_id,
        revision_id,
        candidate,
        before.sources,
        validate_curriculum(candidate, before.profile, before.sources),
        "active",
    )
    assert await db.get(CurriculumItem, "t1")
    assert (
        await db.get(TopicProgress, (before.roadmap_id, "t1", curriculum_workspace.owner_id))
    ).status == "completed"
    assert await db.get(TopicChat, "lesson-one")
    archived_brief = await repository.read_brief(before.workspace_id, "t1")
    assert archived_brief.item.participation == "archived"
    assert archived_brief.default_chat_id == before.canvas_anchor_chat_id


async def test_candidate_revision_does_not_replace_current_and_stale_active_write_fails(
    repository: CurriculumRepository, curriculum_workspace
) -> None:
    view = curriculum_workspace.view
    candidate = view.candidate.model_copy(deep=True)
    candidate.items[2].title = "Proposed title"
    proposal = await repository.save_revision(
        view.roadmap_id, view.revision_id, candidate, view.sources, view.validation, "candidate"
    )
    assert proposal != view.revision_id
    assert (await repository.read(view.workspace_id)).revision_id == view.revision_id
    active = await repository.save_revision(
        view.roadmap_id, view.revision_id, candidate, view.sources, view.validation, "active"
    )
    with pytest.raises(ValueError, match="REVISION_CONFLICT"):
        await repository.save_revision(
            view.roadmap_id, view.revision_id, candidate, view.sources, view.validation, "active"
        )
    assert (await repository.read(view.workspace_id)).revision_id == active


async def test_cross_roadmap_identity_and_resource_links_are_rejected(
    repository: CurriculumRepository, curriculum_workspace, curriculum_session: AsyncSession
) -> None:
    view = curriculum_workspace.view
    other_ws = await WorkspaceService.create_workspace(
        curriculum_session, WorkspaceCreate(name="Other curriculum")
    )
    anchor = await WorkspaceService.add_node_and_edge(
        curriculum_session,
        other_ws.id,
        NodeCreate(id=f"node_{uuid.uuid4().hex[:12]}", role="user", content="Other anchor"),
    )
    async with curriculum_session.begin_nested():
        with pytest.raises(ValueError, match="ITEM_OWNERSHIP_MISMATCH"):
            await repository.create(
                curriculum_workspace.owner_id,
                other_ws.id,
                anchor.id,
                view.profile,
                view.candidate,
                view.sources,
                view.validation,
            )
    # An invalid ownership pair must be rejected by PostgreSQL, even outside service validation.
    with pytest.raises(IntegrityError):
        async with curriculum_session.begin_nested():
            curriculum_session.add(
                TopicResource(
                    revision_id=view.revision_id,
                    roadmap_id="another-roadmap",
                    topic_id="t1",
                    source_id="s1",
                    position=9,
                    rationale="Cannot borrow ownership",
                )
            )
            await curriculum_session.flush()
    assert (await repository.read(view.workspace_id)).candidate == view.candidate


async def test_repository_does_not_commit(
    curriculum_session: AsyncSession, repository: CurriculumRepository, curriculum_workspace
) -> None:
    view = curriculum_workspace.view
    await curriculum_session.rollback()
    assert await curriculum_session.get(Roadmap, view.roadmap_id) is None
    assert (
        await curriculum_session.execute(
            select(CurriculumRevision).where(CurriculumRevision.id == view.revision_id)
        )
    ).scalar_one_or_none() is None


async def test_workspace_delete_cascades_owned_curriculum(repository, curriculum_workspace) -> None:
    view = curriculum_workspace.view
    db = curriculum_workspace.session
    await db.execute(delete(Workspace).where(Workspace.id == view.workspace_id))
    assert await db.scalar(select(Roadmap.id).where(Roadmap.id == view.roadmap_id)) is None
    assert (
        await db.scalar(
            select(CurriculumItem.id).where(CurriculumItem.roadmap_id == view.roadmap_id)
        )
        is None
    )


async def test_revision_source_snapshot_is_immutable(repository, curriculum_workspace) -> None:
    view = curriculum_workspace.view
    extra = view.sources[0].model_copy(update={"id": "proposal-only"})
    proposal = await repository.save_revision(
        view.roadmap_id,
        view.revision_id,
        view.candidate,
        [*view.sources, extra],
        view.validation,
        "candidate",
    )
    assert len((await repository.read_revision(view.roadmap_id, proposal)).sources) == 3
    assert (await repository.read(view.workspace_id)).sources == view.sources
    changed_source = view.sources[0].model_copy(
        update={"evidence": "Different evidence must have a new source identity."}
    )
    with pytest.raises(ValueError, match="SOURCE_IMMUTABLE"):
        await repository.save_revision(
            view.roadmap_id,
            view.revision_id,
            view.candidate,
            [changed_source, *view.sources[1:]],
            view.validation,
            "candidate",
        )


async def test_current_revision_cannot_point_into_another_roadmap(
    repository, curriculum_workspace
) -> None:
    view = curriculum_workspace.view
    db = curriculum_workspace.session
    ws = await WorkspaceService.create_workspace(db, WorkspaceCreate(name="Foreign pointer"))
    anchor = await WorkspaceService.add_node_and_edge(
        db,
        ws.id,
        NodeCreate(
            id=f"node_{uuid.uuid4().hex[:12]}", role="user", content="Foreign pointer anchor"
        ),
    )
    with pytest.raises(IntegrityError):
        async with db.begin_nested():
            db.add(
                Roadmap(
                    id="foreign-plan",
                    owner_id=curriculum_workspace.owner_id,
                    workspace_id=ws.id,
                    canvas_anchor_chat_id=anchor.id,
                    current_revision_id=view.revision_id,
                    profile=view.profile.model_dump(mode="json"),
                )
            )
            await db.flush()
            await db.execute(text("SET CONSTRAINTS fk_roadmap_current_revision IMMEDIATE"))


async def test_wrong_anchor_workspace_rejected(
    repository: CurriculumRepository, curriculum_workspace, curriculum_session: AsyncSession
) -> None:
    view = curriculum_workspace.view
    ws = await WorkspaceService.create_workspace(
        curriculum_session, WorkspaceCreate(name="Wrong anchor")
    )
    with pytest.raises(ValueError, match="ANCHOR_OWNERSHIP_MISMATCH"):
        await repository.create(
            curriculum_workspace.owner_id,
            ws.id,
            view.canvas_anchor_chat_id,
            view.profile,
            view.candidate,
            view.sources,
            view.validation,
        )


async def test_generated_create_rejects_manual_capacity_warning(
    repository, curriculum_workspace
) -> None:
    view = curriculum_workspace.view
    db = curriculum_workspace.session
    ws = await WorkspaceService.create_workspace(db, WorkspaceCreate(name="Too ambitious"))
    anchor = await WorkspaceService.add_node_and_edge(
        db,
        ws.id,
        NodeCreate(id=f"node_{uuid.uuid4().hex[:12]}", role="user", content="Budget anchor"),
    )
    profile = view.profile.model_copy(update={"weekly_minutes": 30, "study_weeks": 1})
    candidate = view.candidate.model_copy(deep=True)
    prefix = uuid.uuid4().hex[:8]
    for item in candidate.items:
        item.id = prefix + item.id
    for relation in candidate.relations:
        relation.source_id = prefix + relation.source_id
        relation.target_id = prefix + relation.target_id
    for resource in candidate.resources:
        resource.topic_id = prefix + resource.topic_id
        resource.source_id = prefix + resource.source_id
    fresh_sources = [
        source.model_copy(update={"id": prefix + source.id}) for source in view.sources
    ]
    candidate.sessions = schedule_core(candidate, profile)
    warning = validate_curriculum(candidate, profile, fresh_sources, manual=True)
    assert warning.valid
    with pytest.raises(ValueError, match="UNVALIDATED_CURRICULUM"):
        await repository.create(
            curriculum_workspace.owner_id,
            ws.id,
            anchor.id,
            profile,
            candidate,
            fresh_sources,
            warning,
        )
