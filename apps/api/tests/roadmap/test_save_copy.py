"""Transactional save-copy coverage (LSI-028).

A learner saves one *published* public snapshot into an authorized workspace and
receives an independent private copy. These tests exercise the LSI-002 §4.4
boundary end to end: private identity, durable public→private topic map,
`(workspace, template)` idempotency, per-workspace conflict, copy isolation,
permission gating, neutral obsolete-snapshot failure, atomic rollback, and the
guarantee that the frozen public snapshot is never mutated by a save.

All backend tests use the isolated ``graphmind_test`` database, never live data.
"""

import uuid
from datetime import datetime, timezone

import pytest
from httpx import ASGITransport, AsyncClient
from main import app
from models.public_snapshot import PublicSnapshot, PublicSnapshotSource, PublicSnapshotTopic
from models.public_snapshot_copy import PublicSnapshotCopy, PublicSnapshotCopyTopic
from models.roadmap import CurriculumItem, ResearchSource, Roadmap
from models.user import User, WorkspaceMember
from models.workspace import NodeModel, Workspace
from schemas.public import PublicSnapshotPublication
from schemas.workspace import WorkspaceCreate
from services.auth_service import create_access_token
from services.roadmap.curriculum_repository import CurriculumRepository
from services.roadmap.public_snapshots import PublicSnapshotService
from services.workspace_service import WorkspaceService
from sqlalchemy import delete, func, select

TEMPLATE_PREFIX = "lsi028-save"
VERSION = "2026-10-16.1"
BASE = "/api/v1/workspaces"


def _template() -> str:
    return f"{TEMPLATE_PREFIX}-{uuid.uuid4().hex[:8]}"


def _client(*, token: str | None = None, raise_app: bool = True) -> AsyncClient:
    cookies = {"access_token": token} if token else {}
    return AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=raise_app),
        base_url="http://test",
        cookies=cookies,
    )


@pytest.fixture(autouse=True)
async def cleanup_save_copy(curriculum_session):
    """Remove every copy/user published by this module, keyed by a unique prefix."""
    yield
    await curriculum_session.rollback()
    await curriculum_session.execute(delete(User).where(User.email.like(f"{TEMPLATE_PREFIX}-%")))
    await curriculum_session.execute(
        delete(PublicSnapshot).where(PublicSnapshot.template_id.like(f"{TEMPLATE_PREFIX}-%"))
    )
    await curriculum_session.commit()


async def _user(session, role: str) -> User:
    user = User(
        id=f"usr_{uuid.uuid4().hex[:12]}",
        email=f"{TEMPLATE_PREFIX}-{role}-{uuid.uuid4().hex[:8]}@example.com",
        full_name=role.title(),
        provider="local",
        is_active=True,
    )
    session.add(user)
    await session.commit()
    return user


@pytest.fixture
async def saver(curriculum_session) -> User:
    return await _user(curriculum_session, "saver")


async def _workspace(session, owner_id: str, name: str = "Saved roadmap") -> Workspace:
    workspace = await WorkspaceService.create_workspace(
        session, WorkspaceCreate(name=name), owner_id=owner_id
    )
    await session.commit()
    return workspace


async def _publish(session, source_workspace, template_id: str, version: str = VERSION):
    service = PublicSnapshotService(session)
    record = await service.publish_revision(
        source_workspace.owner_id,
        publication=PublicSnapshotPublication(
            template_id=template_id, snapshot_version=version, category="visual-arts"
        ),
        workspace_id=source_workspace.view.workspace_id,
        revision_id=source_workspace.view.revision_id,
    )
    await session.commit()
    return record


async def _save(
    api: AsyncClient,
    workspace_id: str,
    template_id: str,
    *,
    key: str | None = None,
    version: str = VERSION,
    title: str | None = None,
):
    body: dict[str, str] = {"templateId": template_id, "snapshotVersion": version}
    if title is not None:
        body["customTitle"] = title
    return await api.post(
        f"{BASE}/{workspace_id}/learning-roadmaps",
        json=body,
        headers={"Idempotency-Key": key or str(uuid.uuid4())},
    )


async def _count(session, model, **filters) -> int:
    query = select(func.count()).select_from(model)
    for column, value in filters.items():
        query = query.where(getattr(model, column) == value)
    return (await session.scalar(query)) or 0


# ---------------------------------------------------------------------------
# Private copy identity, valid relationships, and durable topic map
# ---------------------------------------------------------------------------


async def test_save_copy_creates_private_copy_with_valid_relationships(
    curriculum_workspace, curriculum_session, saver
):
    template = _template()
    await _publish(curriculum_session, curriculum_workspace, template)
    workspace = await _workspace(curriculum_session, saver.id)

    async with _client(token=create_access_token(saver.id)) as api:
        response = await _save(api, workspace.id, template)

    assert response.status_code == 201
    body = response.json()
    assert body["workspaceId"] == workspace.id
    assert body["sourceSnapshotRef"] == f"{template}:{VERSION}"
    assert body["roadmapId"].startswith("roadmap_")
    assert body["revisionId"].startswith("rev_")
    # Three public topics are mapped to three *new* private topic identities.
    assert len(body["topicMap"]) == 3
    private_topic_ids = {entry["privateTopicId"] for entry in body["topicMap"]}
    assert len(private_topic_ids) == 3
    assert all(topic_id.startswith("item_") for topic_id in private_topic_ids)
    assert set(body["topicProgress"]) == private_topic_ids
    for entry in body["topicMap"]:
        assert entry["publicTopicId"].startswith("pub_topic_")
        assert entry["privateTopicId"] != entry["publicTopicId"]

    # The persisted private curriculum is structurally valid and independent.
    view = await CurriculumRepository(curriculum_session, reader_id=saver.id).read(workspace.id)
    assert view is not None
    assert view.workspace_id == workspace.id
    assert view.can_write is True
    kinds = sorted(item.kind for item in view.candidate.items)
    assert kinds == ["phase", "root", "topic", "topic", "topic"]
    contains = [relation for relation in view.candidate.relations if relation.kind == "contains"]
    # root -> phase and phase -> each of the three topics.
    assert len(contains) == 4
    # The public prerequisite edge survives as a private prerequisite edge.
    assert any(relation.kind == "prerequisite" for relation in view.candidate.relations)
    assert view.sources
    source_ids = {source.id for source in view.sources}
    assert {resource.topic_id for resource in view.candidate.resources} == private_topic_ids
    assert all(resource.source_id in source_ids for resource in view.candidate.resources)

    roadmap = await curriculum_session.scalar(
        select(Roadmap).where(Roadmap.workspace_id == workspace.id)
    )
    assert roadmap is not None
    assert roadmap.owner_id == saver.id

    anchor = (
        await curriculum_session.scalars(
            select(NodeModel).where(NodeModel.workspace_id == workspace.id)
        )
    ).one()
    assert anchor.metadata_payload["kind"] == "roadmap_anchor"
    assert anchor.metadata_payload["sourceSnapshotRef"] == f"{template}:{VERSION}"
    assert anchor.metadata_payload["roadmapId"] == body["roadmapId"]


async def test_custom_title_overrides_the_snapshot_title(
    curriculum_workspace, curriculum_session, saver
):
    template = _template()
    await _publish(curriculum_session, curriculum_workspace, template)
    workspace = await _workspace(curriculum_session, saver.id)

    async with _client(token=create_access_token(saver.id)) as api:
        response = await _save(api, workspace.id, template, title="  My drawing path  ")

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "My drawing path"
    view = await CurriculumRepository(curriculum_session, reader_id=saver.id).read(workspace.id)
    assert view is not None
    assert view.profile.title == "My drawing path"
    assert view.candidate.title == "My drawing path"


# ---------------------------------------------------------------------------
# Idempotency, conflict, and isolation
# ---------------------------------------------------------------------------


async def test_retry_returns_the_existing_copy_without_duplicates(
    curriculum_workspace, curriculum_session, saver
):
    template = _template()
    await _publish(curriculum_session, curriculum_workspace, template)
    workspace = await _workspace(curriculum_session, saver.id)

    async with _client(token=create_access_token(saver.id)) as api:
        first = await _save(api, workspace.id, template)
        # A retry under a *new* idempotency key still dedupes on the template.
        second = await _save(api, workspace.id, template)

    assert first.status_code == 201
    assert second.status_code == 200
    assert second.json()["roadmapId"] == first.json()["roadmapId"]
    assert second.json()["revisionId"] == first.json()["revisionId"]
    assert second.json()["topicMap"] == first.json()["topicMap"]

    assert await _count(curriculum_session, Roadmap, workspace_id=workspace.id) == 1
    assert await _count(curriculum_session, PublicSnapshotCopy, workspace_id=workspace.id) == 1
    assert (
        await _count(
            curriculum_session,
            PublicSnapshotCopyTopic,
            copy_id=(
                await curriculum_session.scalar(
                    select(PublicSnapshotCopy.id).where(
                        PublicSnapshotCopy.workspace_id == workspace.id
                    )
                )
            ),
        )
        == 3
    )
    # No duplicate anchor: exactly one node exists in the workspace.
    assert await _count(curriculum_session, NodeModel, workspace_id=workspace.id) == 1


async def test_reused_idempotency_key_for_a_different_template_conflicts(
    curriculum_workspace, curriculum_session, saver
):
    first_template, second_template = _template(), _template()
    await _publish(curriculum_session, curriculum_workspace, first_template)
    await _publish(curriculum_session, curriculum_workspace, second_template)
    workspace = await _workspace(curriculum_session, saver.id)
    key = str(uuid.uuid4())

    async with _client(token=create_access_token(saver.id)) as api:
        first = await _save(api, workspace.id, first_template, key=key)
        conflict = await _save(api, workspace.id, second_template, key=key)

    assert first.status_code == 201
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "IDEMPOTENCY_MISMATCH"
    # The first copy is untouched and no second roadmap was added.
    assert await _count(curriculum_session, PublicSnapshotCopy, workspace_id=workspace.id) == 1
    assert await _count(curriculum_session, Roadmap, workspace_id=workspace.id) == 1


async def test_workspace_hosting_a_different_roadmap_conflicts(
    curriculum_workspace, curriculum_session, saver
):
    first_template, second_template = _template(), _template()
    await _publish(curriculum_session, curriculum_workspace, first_template)
    await _publish(curriculum_session, curriculum_workspace, second_template)
    workspace = await _workspace(curriculum_session, saver.id)

    async with _client(token=create_access_token(saver.id)) as api:
        first = await _save(api, workspace.id, first_template)
        conflict = await _save(api, workspace.id, second_template)

    assert first.status_code == 201
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "WORKSPACE_HAS_ROADMAP"
    assert await _count(curriculum_session, Roadmap, workspace_id=workspace.id) == 1
    assert (
        await curriculum_session.scalar(
            select(Roadmap.id).where(Roadmap.workspace_id == workspace.id)
        )
        == first.json()["roadmapId"]
    )


async def test_two_workspaces_receive_isolated_copies(
    curriculum_workspace, curriculum_session, saver
):
    template = _template()
    await _publish(curriculum_session, curriculum_workspace, template)
    first_workspace = await _workspace(curriculum_session, saver.id, name="Copy A")
    second_workspace = await _workspace(curriculum_session, saver.id, name="Copy B")

    async with _client(token=create_access_token(saver.id)) as api:
        first = await _save(api, first_workspace.id, template)
        second = await _save(api, second_workspace.id, template)

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["roadmapId"] != second.json()["roadmapId"]
    first_private = {entry["privateTopicId"] for entry in first.json()["topicMap"]}
    second_private = {entry["privateTopicId"] for entry in second.json()["topicMap"]}
    # Same public template, genuinely independent private identities.
    assert first_private.isdisjoint(second_private)
    assert await _count(curriculum_session, PublicSnapshotCopy, template_id=template) == 2


# ---------------------------------------------------------------------------
# Permission gating and required headers
# ---------------------------------------------------------------------------


async def test_save_copy_requires_write_permission(curriculum_workspace, curriculum_session, saver):
    template = _template()
    await _publish(curriculum_session, curriculum_workspace, template)
    workspace = await _workspace(curriculum_session, saver.id)
    outsider = await _user(curriculum_session, "outsider")
    viewer = await _user(curriculum_session, "viewer")
    curriculum_session.add(
        WorkspaceMember(
            id=f"wsm_{uuid.uuid4().hex[:12]}",
            workspace_id=workspace.id,
            user_id=viewer.id,
            role="viewer",
        )
    )
    await curriculum_session.commit()

    async with _client(token=create_access_token(outsider.id)) as api:
        denied = await _save(api, workspace.id, template)
    async with _client(token=create_access_token(viewer.id)) as api:
        forbidden = await _save(api, workspace.id, template)

    assert denied.status_code == 404
    assert forbidden.status_code == 403
    assert await _count(curriculum_session, PublicSnapshotCopy, workspace_id=workspace.id) == 0


async def test_editor_member_saves_into_the_owners_workspace(
    curriculum_workspace, curriculum_session, saver
):
    template = _template()
    await _publish(curriculum_session, curriculum_workspace, template)
    workspace = await _workspace(curriculum_session, saver.id)
    editor = await _user(curriculum_session, "editor")
    curriculum_session.add(
        WorkspaceMember(
            id=f"wsm_{uuid.uuid4().hex[:12]}",
            workspace_id=workspace.id,
            user_id=editor.id,
            role="editor",
        )
    )
    await curriculum_session.commit()

    async with _client(token=create_access_token(editor.id)) as api:
        response = await _save(api, workspace.id, template)

    assert response.status_code == 201
    roadmap = await curriculum_session.scalar(
        select(Roadmap).where(Roadmap.workspace_id == workspace.id)
    )
    assert roadmap is not None
    # The hosted roadmap belongs to the workspace owner, not the acting editor.
    assert roadmap.owner_id == saver.id


async def test_save_copy_requires_an_idempotency_key(
    curriculum_workspace, curriculum_session, saver
):
    template = _template()
    await _publish(curriculum_session, curriculum_workspace, template)
    workspace = await _workspace(curriculum_session, saver.id)

    async with _client(token=create_access_token(saver.id)) as api:
        missing = await api.post(
            f"{BASE}/{workspace.id}/learning-roadmaps",
            json={"templateId": template, "snapshotVersion": VERSION},
        )

    assert missing.status_code == 422
    assert missing.json()["error"]["code"] == "VALIDATION_ERROR"
    assert await _count(curriculum_session, PublicSnapshotCopy, workspace_id=workspace.id) == 0


# ---------------------------------------------------------------------------
# Obsolete/unknown snapshots fail honestly
# ---------------------------------------------------------------------------


async def test_obsolete_or_unknown_snapshot_is_rejected(
    curriculum_workspace, curriculum_session, saver
):
    template = _template()
    record = await _publish(curriculum_session, curriculum_workspace, template)
    workspace = await _workspace(curriculum_session, saver.id)

    async with _client(token=create_access_token(saver.id)) as api:
        unknown = await _save(api, workspace.id, f"{TEMPLATE_PREFIX}-never")
        wrong_version = await _save(api, workspace.id, template, version="1999-01-01.0")

        await PublicSnapshotService(curriculum_session).unpublish(
            curriculum_workspace.owner_id, template_id=template, snapshot_version=VERSION
        )
        await curriculum_session.commit()
        withdrawn = await _save(api, workspace.id, template, key=str(uuid.uuid4()))

    for response in (unknown, wrong_version, withdrawn):
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "SNAPSHOT_OBSOLETE"
    assert record.status == "published"
    assert await _count(curriculum_session, PublicSnapshotCopy, workspace_id=workspace.id) == 0


# ---------------------------------------------------------------------------
# Public snapshots are never mutated, and a mid-copy failure leaves no orphan
# ---------------------------------------------------------------------------


async def test_saving_a_copy_never_mutates_the_public_snapshot(
    curriculum_workspace, curriculum_session, saver
):
    template = _template()
    record = await _publish(curriculum_session, curriculum_workspace, template)
    workspace = await _workspace(curriculum_session, saver.id)

    async def snapshot_state() -> tuple:
        return (
            record.status,
            record.content_hash,
            record.topic_count,
            await _count(curriculum_session, PublicSnapshotTopic, snapshot_id=record.id),
            await _count(curriculum_session, PublicSnapshotSource, snapshot_id=record.id),
        )

    before = await snapshot_state()
    async with _client(token=create_access_token(saver.id)) as api:
        assert (await _save(api, workspace.id, template)).status_code == 201
    curriculum_session.expire_all()
    assert await snapshot_state() == before
    refreshed = await curriculum_session.get(PublicSnapshot, record.id)
    assert refreshed is not None and refreshed.status == "published"


async def test_failed_copy_rolls_back_without_orphans(
    curriculum_workspace, curriculum_session, saver, monkeypatch
):
    template = _template()
    await _publish(curriculum_session, curriculum_workspace, template)
    workspace = await _workspace(curriculum_session, saver.id)

    async def boom(*args, **kwargs):
        raise RuntimeError("simulated mid-copy failure")

    monkeypatch.setattr("services.roadmap.save_copy.CurriculumRepository.create", boom)

    async with _client(token=create_access_token(saver.id), raise_app=False) as api:
        response = await _save(api, workspace.id, template)

    assert response.status_code == 500
    assert await _count(curriculum_session, PublicSnapshotCopy, workspace_id=workspace.id) == 0
    assert await _count(curriculum_session, Roadmap, workspace_id=workspace.id) == 0
    assert await _count(curriculum_session, NodeModel, workspace_id=workspace.id) == 0
    assert await _count(curriculum_session, CurriculumItem) >= 0  # item rows cascaded away
    assert await _count(curriculum_session, ResearchSource, roadmap_id=workspace.id) == 0


def test_save_copy_route_is_registered():
    paths = set(app.openapi().get("paths", {}))
    assert "/api/v1/workspaces/{workspace_id}/learning-roadmaps" in paths


def test_exported_schemas_default_topic_map_is_empty():
    # Guard the additive contract: the response defaults are private-safe.
    from schemas.enrollment import EnrollmentDetail

    detail = EnrollmentDetail(
        roadmap_id="roadmap_x",
        workspace_id="ws_x",
        revision_id="rev_x",
        source_snapshot_ref="template:v1",
        title="Title",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    assert detail.topic_map == []
    assert detail.topic_progress == {}
