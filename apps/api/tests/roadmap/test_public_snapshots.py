"""Focused tests for immutable public snapshots and controlled publication (LSI-025)."""

import copy
import json
import uuid
from datetime import datetime, timezone

import pytest
from models.public_snapshot import (
    PublicSnapshot,
    PublicSnapshotOrigin,
    PublicSnapshotPhase,
    PublicSnapshotTopic,
    PublicSnapshotTopicSource,
)
from models.roadmap import CurriculumRevision
from schemas.curriculum import CurriculumRelationData, ResourceData, SourceData
from schemas.public import PublicSnapshotPublication
from schemas.workspace import NodeCreate, WorkspaceCreate
from services.roadmap.public_snapshots import (
    CuratedSnapshotSeed,
    PublicSnapshotError,
    PublicSnapshotService,
    seed_public_snapshots,
)
from services.roadmap.validation import validate_curriculum
from services.workspace_service import WorkspaceService
from sqlalchemy import delete, func, select, update

TEST_PREFIX = "roadmap-test-"


def publication(
    template_id: str, version: str = "2026-10-15.1", **overrides
) -> PublicSnapshotPublication:
    return PublicSnapshotPublication(
        template_id=template_id,
        snapshot_version=version,
        category="visual-arts",
        **overrides,
    )


@pytest.fixture
def snapshots(curriculum_session) -> PublicSnapshotService:
    return PublicSnapshotService(curriculum_session)


@pytest.fixture(autouse=True)
async def cleanup_public_snapshots(curriculum_session):
    yield
    await curriculum_session.rollback()
    await curriculum_session.execute(
        delete(PublicSnapshot).where(PublicSnapshot.template_id.like(f"{TEST_PREFIX}%"))
    )
    await curriculum_session.commit()


def _forbidden_tokens() -> list[str]:
    return [
        "workspaceId",
        "roadmapId",
        "revisionId",
        "chatId",
        "sessionId",
        "ownerId",
        "provenance",
        "evidence",
        '"progress"',
        "referenceId",
        "storagePath",
        "uploadPath",
        "verifiedAt",
    ]


async def _publish(snapshots, workspace, template_id: str, version: str = "2026-10-15.1"):
    return await snapshots.publish_revision(
        workspace.owner_id,
        publication=publication(template_id, version),
        workspace_id=workspace.view.workspace_id,
        revision_id=workspace.view.revision_id,
    )


# ---------------------------------------------------------------------------
# Immutability, freezing, and stable public identities
# ---------------------------------------------------------------------------


async def test_publication_freezes_stable_public_identities(snapshots, curriculum_workspace):
    record = await _publish(snapshots, curriculum_workspace, f"{TEST_PREFIX}drawing")
    assert record.status == "published"
    assert record.topic_count == 3
    assert len(record.content_hash) == 64

    detail = await snapshots.read_roadmap(
        template_id=f"{TEST_PREFIX}drawing", snapshot_version="2026-10-15.1"
    )
    assert detail is not None
    assert detail.id == f"{TEST_PREFIX}drawing"
    assert detail.snapshot_version == "2026-10-15.1"
    assert len(detail.phases) == 1
    topics = detail.phases[0].topics
    assert [topic.title for topic in topics] == [
        "Line control",
        "Simple forms",
        "Observation study",
    ]
    assert all(topic.id.startswith("pub_topic_") for topic in topics)
    # Prerequisites are projected as public topic identities, not private ones.
    simple_forms = next(topic for topic in topics if topic.title == "Simple forms")
    line_control = next(topic for topic in topics if topic.title == "Line control")
    assert simple_forms.prerequisites == [line_control.id]
    assert all(source.id.startswith("pub_src_") for source in detail.sources)

    lesson = await snapshots.read_lesson(
        template_id=f"{TEST_PREFIX}drawing",
        snapshot_version="2026-10-15.1",
        topic_ref="simple-forms",
    )
    assert lesson is not None
    assert lesson.topic_slug == "simple-forms"
    assert lesson.topic_id == simple_forms.id
    assert lesson.objectives == ["Explain and demonstrate simple forms."]
    assert len(lesson.sources) == 2

    # Re-reading is deterministic: the frozen IDs do not move.
    again = await snapshots.read_roadmap(
        template_id=f"{TEST_PREFIX}drawing", snapshot_version="2026-10-15.1"
    )
    assert again is not None
    assert [topic.id for topic in again.phases[0].topics] == [topic.id for topic in topics]


async def test_republishing_identical_content_is_idempotent(
    snapshots, curriculum_workspace, curriculum_session
):
    first = await _publish(snapshots, curriculum_workspace, f"{TEST_PREFIX}idem")
    second = await _publish(snapshots, curriculum_workspace, f"{TEST_PREFIX}idem")

    assert first.id == second.id
    assert first.content_hash == second.content_hash
    snapshots_rows = await curriculum_session.scalar(
        select(func.count())
        .select_from(PublicSnapshot)
        .where(PublicSnapshot.template_id == f"{TEST_PREFIX}idem")
    )
    topic_rows = await curriculum_session.scalar(
        select(func.count())
        .select_from(PublicSnapshotTopic)
        .where(PublicSnapshotTopic.snapshot_id == first.id)
    )
    assert snapshots_rows == 1
    assert topic_rows == 3


async def test_changed_content_under_same_version_is_immutable(
    snapshots, curriculum_workspace, curriculum_session
):
    await _publish(snapshots, curriculum_workspace, f"{TEST_PREFIX}immutable")

    # The private revision drifts after publication but the public version does not.
    await curriculum_session.execute(
        update(CurriculumRevision)
        .where(CurriculumRevision.id == curriculum_workspace.view.revision_id)
        .values(title="Drawing foundations v2")
    )
    await curriculum_session.flush()

    with pytest.raises(PublicSnapshotError) as error:
        await _publish(snapshots, curriculum_workspace, f"{TEST_PREFIX}immutable")
    assert error.value.code == "SNAPSHOT_IMMUTABLE"

    # The rejected publication added no rows.
    rows = await curriculum_session.scalar(
        select(func.count())
        .select_from(PublicSnapshot)
        .where(PublicSnapshot.template_id == f"{TEST_PREFIX}immutable")
    )
    assert rows == 1


async def test_unpublish_stops_reads_without_deleting_private_copy(
    snapshots, curriculum_workspace, curriculum_session
):
    from services.roadmap.curriculum_repository import CurriculumRepository

    record = await _publish(snapshots, curriculum_workspace, f"{TEST_PREFIX}unpublish")
    assert await snapshots.read_roadmap(
        template_id=f"{TEST_PREFIX}unpublish", snapshot_version="2026-10-15.1"
    )

    result = await snapshots.unpublish(
        curriculum_workspace.owner_id,
        template_id=f"{TEST_PREFIX}unpublish",
        snapshot_version="2026-10-15.1",
    )
    assert result.status == "unpublished"
    assert result.unpublished_at is not None

    # Public reads stop; the frozen rows and the private copy survive.
    assert (
        await snapshots.read_roadmap(
            template_id=f"{TEST_PREFIX}unpublish", snapshot_version="2026-10-15.1"
        )
        is None
    )
    assert (
        await snapshots.read_lesson(
            template_id=f"{TEST_PREFIX}unpublish",
            snapshot_version="2026-10-15.1",
            topic_ref="line-control",
        )
        is None
    )
    listed = await snapshots.list_published()
    assert all(item.id != f"{TEST_PREFIX}unpublish" for item in listed.items)

    snapshot_row = await curriculum_session.get(PublicSnapshot, record.id)
    assert snapshot_row is not None and snapshot_row.status == "unpublished"
    frozen_topics = await curriculum_session.scalar(
        select(func.count())
        .select_from(PublicSnapshotTopic)
        .where(PublicSnapshotTopic.snapshot_id == record.id)
    )
    assert frozen_topics == 3
    private_view = await CurriculumRepository(curriculum_session).read(
        curriculum_workspace.view.workspace_id
    )
    assert private_view is not None
    assert private_view.revision_id == curriculum_workspace.view.revision_id


async def test_unpublish_is_idempotent_and_requires_permission(snapshots, curriculum_workspace):
    await _publish(snapshots, curriculum_workspace, f"{TEST_PREFIX}perm")

    with pytest.raises(PublicSnapshotError) as error:
        await snapshots.unpublish(
            "usr_outsider",
            template_id=f"{TEST_PREFIX}perm",
            snapshot_version="2026-10-15.1",
        )
    assert error.value.code == "PUBLICATION_FORBIDDEN"

    first = await snapshots.unpublish(
        curriculum_workspace.owner_id,
        template_id=f"{TEST_PREFIX}perm",
        snapshot_version="2026-10-15.1",
    )
    second = await snapshots.unpublish(
        curriculum_workspace.owner_id,
        template_id=f"{TEST_PREFIX}perm",
        snapshot_version="2026-10-15.1",
    )
    assert first.status == second.status == "unpublished"
    assert second.unpublished_at == first.unpublished_at


async def test_publication_requires_source_ownership(snapshots, curriculum_workspace):
    with pytest.raises(PublicSnapshotError) as error:
        await snapshots.publish_revision(
            "usr_outsider",
            publication=publication(f"{TEST_PREFIX}forbidden"),
            workspace_id=curriculum_workspace.view.workspace_id,
            revision_id=curriculum_workspace.view.revision_id,
        )
    assert error.value.code == "PUBLICATION_FORBIDDEN"


async def test_publication_rejects_unvalidated_revision(
    snapshots, curriculum_workspace, curriculum_session
):
    await curriculum_session.execute(
        update(CurriculumRevision)
        .where(CurriculumRevision.id == curriculum_workspace.view.revision_id)
        .values(
            validation={
                "valid": False,
                "issues": [],
                "core_minutes": 0,
                "capacity_minutes": None,
            }
        )
    )
    await curriculum_session.flush()
    with pytest.raises(PublicSnapshotError) as error:
        await _publish(snapshots, curriculum_workspace, f"{TEST_PREFIX}unvalidated")
    assert error.value.code == "SNAPSHOT_UNVALIDATED"
    rows = await curriculum_session.scalar(
        select(func.count())
        .select_from(PublicSnapshot)
        .where(PublicSnapshot.template_id == f"{TEST_PREFIX}unvalidated")
    )
    assert rows == 0


# ---------------------------------------------------------------------------
# Sanitization
# ---------------------------------------------------------------------------


def _leaky_sources() -> list[SourceData]:
    return [
        SourceData(
            id=f"s{i}",
            title=f"Drawing source {i}",
            url=f"https://example.com/drawing-{i}",
            locator="section:practice",
            verified_at=datetime.now(timezone.utc),
            status="inspected",
            access="free",
            kind="article",
            evidence="Practise contour lines by observing the boundary of an object.",
            provenance={
                "workspaceId": "ws_private_secret",
                "storagePath": "/srv/private/uploads/notes.pdf",
                "chatId": "node_private_secret",
            },
        )
        for i in (1, 2)
    ] + [
        SourceData(
            id="s_unavailable",
            title="Unavailable draft reference",
            url="https://example.com/unavailable",
            locator="section:draft",
            verified_at=datetime.now(timezone.utc),
            status="unavailable",
            access="paid",
            kind="article",
            evidence="This source was never verified and must never be public.",
            provenance={"uploadPath": "/srv/private/draft.pdf"},
        )
    ]


async def test_public_payloads_exclude_private_and_unvetted_data(
    snapshots, repository, curriculum_session, small_candidate, small_profile
):
    cand = copy.deepcopy(small_candidate)
    by_id = {item.id: item for item in cand.items}
    by_id["t2"].content_markdown = "# Simple forms\n\nSketch boxes and spheres from observation."
    by_id["t1"].participation = "archived"
    # An archived prerequisite cannot gate a remaining active topic.
    cand.relations = [
        relation
        for relation in cand.relations
        if not (relation.source_id == "t1" and relation.target_id == "t2")
    ]
    cand.sessions = [session for session in cand.sessions if session.topic_id != "t1"]
    private_sources = _leaky_sources()

    owner_id = "usr_default_admin"
    ws = await WorkspaceService.create_workspace(
        curriculum_session, WorkspaceCreate(name="Sanitization test"), owner_id=owner_id
    )
    anchor = await WorkspaceService.add_node_and_edge(
        curriculum_session,
        ws.id,
        NodeCreate(id=f"node_{uuid.uuid4().hex[:12]}", role="user", content="Public anchor"),
    )
    try:
        view = await repository.create(
            owner_id,
            ws.id,
            anchor.id,
            small_profile,
            cand,
            private_sources,
            validate_curriculum(cand, small_profile, private_sources),
        )
        record = await snapshots.publish_revision(
            owner_id,
            publication=publication(f"{TEST_PREFIX}sanitize"),
            workspace_id=ws.id,
            revision_id=view.revision_id,
        )
        # Archived topic is not published; the authored topics are.
        assert record.topic_count == 2

        detail = await snapshots.read_roadmap(
            template_id=f"{TEST_PREFIX}sanitize", snapshot_version="2026-10-15.1"
        )
        assert detail is not None
        assert [topic.title for topic in detail.phases[0].topics] == [
            "Simple forms",
            "Observation study",
        ]
        # Only referenced, vetted sources survive; the unreferenced unavailable one is dropped.
        assert len(detail.sources) == 2

        lesson = await snapshots.read_lesson(
            template_id=f"{TEST_PREFIX}sanitize",
            snapshot_version="2026-10-15.1",
            topic_ref="simple-forms",
        )
        assert lesson is not None
        assert lesson.content_markdown and "Simple forms" in lesson.content_markdown
        assert len(lesson.sources) == 2

        serialized = json.dumps(
            {
                "detail": detail.model_dump(mode="json", by_alias=True),
                "lesson": lesson.model_dump(mode="json", by_alias=True),
            }
        )
        for token in _forbidden_tokens():
            assert token not in serialized, f"private token {token!r} leaked into a public payload"
        assert ws.id not in serialized
        assert view.roadmap_id not in serialized
        assert view.revision_id not in serialized
        assert "ws_private_secret" not in serialized
        assert "node_private_secret" not in serialized
        assert "/srv/private" not in serialized
        assert detail.phases[0].topics[0].id not in {"t2", "t3"}

        # The private provenance side table is the only place private IDs live.
        origin = await curriculum_session.get(PublicSnapshotOrigin, record.id)
        assert origin is not None
        assert origin.source_workspace_id == ws.id
        assert origin.source_revision_id == view.revision_id
    finally:
        from models.workspace import Workspace

        await curriculum_session.rollback()
        await curriculum_session.execute(delete(Workspace).where(Workspace.id == ws.id))
        await curriculum_session.commit()


def test_sanitizer_drops_referenced_unavailable_sources(small_candidate, small_profile):
    from schemas.curriculum import CurriculumView, ValidationReport
    from services.roadmap.public_snapshots import sanitize_curriculum

    cand = copy.deepcopy(small_candidate)
    cand.resources.append(
        ResourceData(
            topic_id="t2",
            source_id="s_unavailable",
            order=2,
            rationale="References a source that must never be published.",
            objective_index=0,
        )
    )
    view = CurriculumView(
        roadmap_id="roadmap_private",
        workspace_id="ws_private_secret",
        canvas_anchor_chat_id="node_private_secret",
        revision_id="rev_private_secret",
        profile=small_profile,
        candidate=cand,
        sources=_leaky_sources(),
        progress={},
        validation=ValidationReport(valid=True, issues=[], core_minutes=0, capacity_minutes=None),
    )
    sanitized = sanitize_curriculum(
        view,
        template_id="roadmap-test-pure",
        publication=publication("roadmap-test-pure"),
    )
    titles = [source.title for source in sanitized.sources]
    assert "Unavailable draft reference" not in titles
    assert len(sanitized.sources) == 2
    assert all(source.source_id.startswith("pub_src_") for source in sanitized.sources)


async def test_publication_rejects_unstructured_topics(
    snapshots, repository, curriculum_session, small_candidate, small_profile, sources
):
    cand = copy.deepcopy(small_candidate)
    # Detach t1 from its phase; it now hangs directly off the root and has no phase.
    cand.relations = [
        relation
        for relation in cand.relations
        if not (relation.target_id == "t1" and relation.source_id == "phase")
    ]
    cand.relations.append(CurriculumRelationData(source_id="root", target_id="t1", kind="contains"))
    owner_id = "usr_default_admin"
    ws = await WorkspaceService.create_workspace(
        curriculum_session, WorkspaceCreate(name="Unstructured test"), owner_id=owner_id
    )
    anchor = await WorkspaceService.add_node_and_edge(
        curriculum_session,
        ws.id,
        NodeCreate(id=f"node_{uuid.uuid4().hex[:12]}", role="user", content="Public anchor"),
    )
    try:
        view = await repository.create(
            owner_id,
            ws.id,
            anchor.id,
            small_profile,
            cand,
            sources,
            validate_curriculum(cand, small_profile, sources),
        )
        with pytest.raises(PublicSnapshotError) as error:
            await snapshots.publish_revision(
                owner_id,
                publication=publication(f"{TEST_PREFIX}unstructured"),
                workspace_id=ws.id,
                revision_id=view.revision_id,
            )
        assert error.value.code == "SNAPSHOT_UNSTRUCTURED"
        assert "t1" in error.value.detail
    finally:
        from models.workspace import Workspace

        await curriculum_session.rollback()
        await curriculum_session.execute(delete(Workspace).where(Workspace.id == ws.id))
        await curriculum_session.commit()


async def test_publication_input_is_strictly_bounded():
    with pytest.raises(ValueError):
        PublicSnapshotPublication(template_id="Invalid Template", snapshot_version="1")
    with pytest.raises(ValueError):
        PublicSnapshotPublication(template_id="ok", snapshot_version="")


async def test_seed_tooling_publishes_a_batch(snapshots, curriculum_workspace, curriculum_session):
    seeds = [
        CuratedSnapshotSeed(
            workspace_id=curriculum_workspace.view.workspace_id,
            revision_id=curriculum_workspace.view.revision_id,
            publication=publication(f"{TEST_PREFIX}seed-a", "2026-10-15.2"),
        ),
        CuratedSnapshotSeed(
            workspace_id=curriculum_workspace.view.workspace_id,
            revision_id=curriculum_workspace.view.revision_id,
            publication=publication(f"{TEST_PREFIX}seed-b", "2026-10-15.3"),
        ),
    ]
    records = await seed_public_snapshots(curriculum_session, curriculum_workspace.owner_id, seeds)
    assert [record.template_id for record in records] == [
        f"{TEST_PREFIX}seed-a",
        f"{TEST_PREFIX}seed-b",
    ]
    assert all(record.status == "published" for record in records)
    # Distinct templates never share a catalog slug.
    assert len({record.slug for record in records}) == 2


async def test_new_version_reuses_the_template_slug(
    snapshots, curriculum_workspace, curriculum_session
):
    """A slug identifies the roadmap template, so versions share it."""
    template_id = f"{TEST_PREFIX}versioned"
    first = await _publish(snapshots, curriculum_workspace, template_id, "2026-10-15.1")
    second = await _publish(snapshots, curriculum_workspace, template_id, "2026-10-15.2")

    assert first.slug == second.slug == template_id
    rows = await curriculum_session.scalar(
        select(func.count())
        .select_from(PublicSnapshot)
        .where(PublicSnapshot.template_id == template_id)
    )
    assert rows == 2

    # Reading by slug resolves the newest published version deterministically.
    detail = await snapshots.read_roadmap(slug=template_id)
    assert detail is not None
    assert detail.snapshot_version == "2026-10-15.2"


async def test_distinct_templates_cannot_reuse_a_slug(snapshots, curriculum_workspace):
    await snapshots.publish_revision(
        curriculum_workspace.owner_id,
        publication=publication(f"{TEST_PREFIX}slug-owner", slug="shared-catalog-slug"),
        workspace_id=curriculum_workspace.view.workspace_id,
        revision_id=curriculum_workspace.view.revision_id,
    )
    with pytest.raises(PublicSnapshotError) as error:
        await snapshots.publish_revision(
            curriculum_workspace.owner_id,
            publication=publication(f"{TEST_PREFIX}slug-rival", slug="shared-catalog-slug"),
            workspace_id=curriculum_workspace.view.workspace_id,
            revision_id=curriculum_workspace.view.revision_id,
        )
    assert error.value.code == "SNAPSHOT_SLUG_CONFLICT"


async def test_published_snapshot_survives_private_deletion(
    snapshots, curriculum_workspace, curriculum_session
):
    """A published snapshot is not deleted when its private workspace is deleted."""
    record = await _publish(snapshots, curriculum_workspace, f"{TEST_PREFIX}detach")
    from models.workspace import Workspace

    workspace_id = curriculum_workspace.view.workspace_id
    await curriculum_session.commit()
    await curriculum_session.execute(delete(Workspace).where(Workspace.id == workspace_id))
    await curriculum_session.commit()

    detail = await snapshots.read_roadmap(
        template_id=f"{TEST_PREFIX}detach", snapshot_version="2026-10-15.1"
    )
    assert detail is not None
    origin = await curriculum_session.get(PublicSnapshotOrigin, record.id)
    assert origin is not None
    assert origin.source_workspace_id is None
    assert origin.published_by == curriculum_workspace.owner_id


def test_snapshot_models_declare_immutable_public_tables():
    assert PublicSnapshot.__tablename__ == "public_snapshots"
    assert PublicSnapshotPhase.__tablename__ == "public_snapshot_phases"
    assert PublicSnapshotTopic.__tablename__ == "public_snapshot_topics"
    assert PublicSnapshotTopicSource.__tablename__ == "public_snapshot_topic_sources"
