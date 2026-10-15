"""LSI-038: branch promotion lineage, source backlink, and conflict safety.

Focused coverage of the existing promotion -> proposal -> apply contract:

- a promoted topic records durable provenance to the exact persistent
  conversation root and branch node (the triple ``buildNodeUrl`` deep-links to),
- promoting never mutates the source conversation branch,
- duplicate/conflicting promotions stay safe (stale base, idempotency reuse,
  repeated apply, foreign source node).

These tests intentionally reuse the shipped promotion/lineage contract; they add
no new proposal model.
"""

import uuid

from httpx import ASGITransport, AsyncClient
from main import app
from models.roadmap import CurriculumTopicOrigin, Roadmap
from models.workspace import NodeModel
from schemas.curriculum import CurriculumRelationData, RoadmapRequest
from schemas.roadmap_job import PromotionSourceSnapshot, StageResult
from schemas.workspace import NodeCreate, WorkspaceCreate
from services.auth_service import create_access_token
from services.roadmap.publication import PublicationService, refinement_identities
from services.roadmap.revision_service import RevisionService
from services.roadmap.validation import validate_curriculum
from services.workspace_service import WorkspaceService
from sqlalchemy import func, select

STAGES = ["understand", "research", "compose", "personalize", "validate"]


def canonical_node_url(workspace_id: str, chat_id: str, node_id: str) -> str:
    """Mirror ``buildNodeUrl`` from ``apps/web/src/lib/urls.ts``.

    The backend owns the IDs; the web helper is the single place that formats
    them. Keeping the shape here lets the API/lineage test assert the exact
    deep link a promoted topic must offer.
    """

    return f"/w/{workspace_id}/chat/{chat_id}?node={node_id}"


async def _build_promoted_candidate(view):
    """An additive proposal: exactly one new topic under the ``phase`` container."""

    candidate = view.candidate.model_copy(deep=True)
    template = next(item for item in candidate.items if item.id == "t3")
    candidate.items.append(
        template.model_copy(
            update={
                "id": "promoted-perspective-topic",
                "title": "Perspective drawing",
                "brief": "Practice perspective with a simple observed scene.",
                "objectives": ["Draw a simple scene using converging lines."],
                "exercise": "Sketch a room with a horizon and two converging edges.",
                "order": 4,
            }
        )
    )
    candidate.relations.append(
        CurriculumRelationData(
            source_id="phase", target_id="promoted-perspective-topic", kind="contains"
        )
    )
    candidate.resources.extend(
        resource.model_copy(update={"topic_id": "promoted-perspective-topic"})
        for resource in candidate.resources
        if resource.topic_id == "t3"
    )
    candidate.sessions.append(
        candidate.sessions[-1].model_copy(
            update={"topic_id": "promoted-perspective-topic", "week": 2, "sequence": 0}
        )
    )
    return candidate


async def _promotion_claim(
    curriculum_workspace,
    job_repo,
    clock,
    scripted_executor,
    curriculum_session,
    *,
    source_title: str = "Perspective branch",
):
    """Seed a persisted branch, prepare an additive proposal, and return the publish claim."""

    view = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    root = NodeModel(
        id=f"promotion-root-{uuid.uuid4().hex}",
        workspace_id=view.workspace_id,
        role="user",
        content="Explore perspective drawing",
        metadata_payload={"title": source_title},
    )
    node = NodeModel(
        id=f"promotion-node-{uuid.uuid4().hex}",
        workspace_id=view.workspace_id,
        parent_id=root.id,
        role="assistant",
        content="A useful branch-origin explanation.",
        metadata_payload={},
    )
    curriculum_session.add_all([root, node])
    await curriculum_session.flush()
    source = PromotionSourceSnapshot(
        workspace_id=view.workspace_id,
        owner_id=None,
        private=False,
        chat_id=root.id,
        node_id=node.id,
        target_container_id="phase",
        source_title=source_title,
        excerpt="user: Explore perspective drawing\nassistant: A useful branch-origin explanation.",
    )
    job = await job_repo.create(
        owner,
        RoadmapRequest(prompt="Add one perspective topic"),
        str(uuid.uuid4()),
        operation="refine",
        base_revision_id=view.revision_id,
    )
    await job_repo.start(job.id, owner)
    candidate = await _build_promoted_candidate(view)
    report = validate_curriculum(candidate, view.profile, view.sources)
    assert report.valid, report.issues
    for stage in STAGES:
        claim = await job_repo.claim("promotion-worker", clock.now())
        stage_checkpoint = scripted_executor.results[stage].checkpoint.model_copy(deep=True)
        stage_checkpoint.candidate = candidate
        stage_checkpoint.original_candidate = view.candidate
        stage_checkpoint.validation = report
        stage_checkpoint.promotion_source = source
        await job_repo.checkpoint(
            claim, stage, StageResult(checkpoint=stage_checkpoint, summary=f"{stage} completed")
        )
    publish_claim = await job_repo.claim("promotion-worker", clock.now())
    return publish_claim, view, owner, root, node, source, candidate, job


async def test_promoted_topic_links_back_to_exact_persistent_source_branch(
    curriculum_workspace, job_repo, clock, scripted_executor, curriculum_session
):
    claim, view, owner, root, node, source, candidate, job = await _promotion_claim(
        curriculum_workspace, job_repo, clock, scripted_executor, curriculum_session
    )

    result = await PublicationService(curriculum_session, clock=clock.now).publish(claim)
    assert result.kind == "proposal"

    proposal = await RevisionService(curriculum_session).proposal(
        view.workspace_id, owner, result.revision_id
    )
    assert len(proposal.origins) == 1
    origin = proposal.origins[0]
    expected_candidate = refinement_identities(job.id, view.candidate, candidate)
    expected_topic_id = next(
        item.id
        for item in expected_candidate.items
        if item.title == "Perspective drawing" and item.kind == "topic"
    )
    assert origin.topic_id == expected_topic_id

    # Lineage points at the exact persisted root + leaf node, not a display string.
    assert origin.source_workspace_id == view.workspace_id
    assert origin.source_chat_id == root.id
    assert origin.source_node_id == node.id
    assert origin.unavailable is False
    assert origin.source_title == "Perspective branch"
    assert "branch-origin explanation" in origin.source_excerpt

    # The promoted topic deep link is the canonical buildNodeUrl shape and every
    # segment is backed by a real persisted node in the same workspace.
    link = canonical_node_url(
        origin.source_workspace_id, origin.source_chat_id, origin.source_node_id
    )
    assert link == canonical_node_url(view.workspace_id, root.id, node.id)
    assert await curriculum_session.get(NodeModel, root.id) is not None
    assert await curriculum_session.get(NodeModel, node.id) is not None

    # Additive: the promoted topic plus every original active topic coexist.
    promoted = next(
        item for item in proposal.view.candidate.items if item.id == origin.topic_id
    )
    assert promoted.participation == "active"
    live_ids = {item.id for item in proposal.view.candidate.items if item.participation == "active"}
    assert {item.id for item in view.candidate.items if item.participation == "active"} <= live_ids


async def test_promoting_leaves_source_branch_unchanged_and_reapply_is_safe(
    curriculum_workspace, job_repo, clock, scripted_executor, curriculum_session
):
    claim, view, owner, root, node, source, candidate, job = await _promotion_claim(
        curriculum_workspace, job_repo, clock, scripted_executor, curriculum_session
    )
    before_nodes = (await curriculum_session.scalars(select(NodeModel))).all()
    before = {
        row.id: (row.parent_id, row.role, row.content, row.workspace_id) for row in before_nodes
    }
    before_count = len(before_nodes)

    result = await PublicationService(curriculum_session, clock=clock.now).publish(claim)
    applied = await RevisionService(curriculum_session).apply(
        view.workspace_id, owner, result.revision_id, view.revision_id
    )

    after_nodes = (await curriculum_session.scalars(select(NodeModel))).all()
    after = {
        row.id: (row.parent_id, row.role, row.content, row.workspace_id) for row in after_nodes
    }
    # Source chat is untouched: no node created, removed, reparented, or rewritten.
    assert len(after_nodes) == before_count
    assert after == before
    assert applied.origins[0].source_chat_id == root.id
    assert applied.origins[0].source_node_id == node.id

    # Re-applying the same applied proposal is a no-op: same revision, one topic,
    # one origin row. Duplicate requests never double-promote.
    reapplied = await RevisionService(curriculum_session).apply(
        view.workspace_id, owner, result.revision_id, view.revision_id
    )
    assert reapplied.revision_id == applied.revision_id == result.revision_id
    promoted = [
        item
        for item in reapplied.candidate.items
        if item.title == "Perspective drawing" and item.kind == "topic"
    ]
    assert len(promoted) == 1
    origin_count = await curriculum_session.scalar(
        select(func.count())
        .select_from(CurriculumTopicOrigin)
        .where(CurriculumTopicOrigin.roadmap_id == view.roadmap_id)
    )
    assert origin_count == 1


async def test_promotion_api_requires_idempotency_and_rejects_conflicts(
    curriculum_workspace, curriculum_session
):
    view = curriculum_workspace.view
    owner = curriculum_workspace.owner_id
    root = await WorkspaceService.add_node_and_edge(
        curriculum_session,
        view.workspace_id,
        NodeCreate(id=f"http-root-{uuid.uuid4().hex}", role="user", content="Explore"),
        compute_embedding=False,
    )
    branch = await WorkspaceService.add_node_and_edge(
        curriculum_session,
        view.workspace_id,
        NodeCreate(
            id=f"http-branch-{uuid.uuid4().hex}",
            parent_id=root.id,
            role="assistant",
            content="A useful concept",
        ),
        compute_embedding=False,
    )
    other = await WorkspaceService.create_workspace(
        curriculum_session, WorkspaceCreate(name="Other scope"), owner_id=owner
    )
    foreign = await WorkspaceService.add_node_and_edge(
        curriculum_session,
        other.id,
        NodeCreate(id=f"foreign-{uuid.uuid4().hex}", role="user", content="Private"),
        compute_embedding=False,
    )
    await curriculum_session.commit()

    container_id = next(item.id for item in view.candidate.items if item.kind == "root")
    path = f"/api/v1/workspaces/{view.workspace_id}/roadmap/promotions"
    stale = {
        "sourceChatId": root.id,
        "sourceNodeId": branch.id,
        "targetContainerId": container_id,
        "baseRevisionId": "stale-revision",
    }
    foreign_body = {
        "sourceChatId": foreign.id,
        "sourceNodeId": foreign.id,
        "targetContainerId": container_id,
        "baseRevisionId": view.revision_id,
    }
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        cookies={"access_token": create_access_token(owner)},
    ) as client:
        missing_key = await client.post(path, json=stale)
        assert missing_key.status_code == 422

        conflict = await client.post(
            path, json=stale, headers={"Idempotency-Key": str(uuid.uuid4())}
        )
        assert conflict.status_code == 409
        assert conflict.json()["error"]["code"] == "REVISION_CONFLICT"

        cross_scope = await client.post(
            path, json=foreign_body, headers={"Idempotency-Key": str(uuid.uuid4())}
        )
        assert cross_scope.status_code == 404

    # A rejected promotion never rewrites the active roadmap.
    roadmap = await curriculum_session.scalar(
        select(Roadmap).where(Roadmap.workspace_id == view.workspace_id)
    )
    assert roadmap is not None and roadmap.current_revision_id == view.revision_id
