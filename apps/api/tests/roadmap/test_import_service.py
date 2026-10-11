"""Deterministic roadmap.sh import — parser, grouping, synthesis, persistence."""

import io
import tarfile
import uuid

from models.roadmap import CurriculumRevision, Roadmap
from models.user import User
from models.workspace import NodeModel, Workspace
from schemas.roadmap_job import MAX_COVERAGE_TOPICS
from services.roadmap import import_service as svc
from services.roadmap.import_service import (
    MarkdownFile,
    RoadmapShSnapshot,
    _clean_title,
    build_candidate,
    group_into_phases,
    import_roadmaps,
    import_slug,
    parse_markdown,
)
from services.roadmap.validation import validate_curriculum
from sqlalchemy import delete, func, select


def tarball_with(slug_files: dict[str, list[tuple[str, str]]]) -> bytes:
    """Build an in-memory developer-roadmap tarball with the given content files."""
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz") as tar:
        for slug, files in slug_files.items():
            for name, text in files:
                data = text.encode("utf-8")
                info = tarfile.TarInfo(
                    f"developer-roadmap-master/roadmaps/{slug}/content/{name}"
                )
                info.size = len(data)
                tar.addfile(info, io.BytesIO(data))
    return buffer.getvalue()

SAMPLE = """# Bash

Bash is a command language interpreter that lets users interact with an operating system by executing text-based commands. It serves as the default shell for most Linux distributions.

Visit the following resources to learn more:

- [@official@Bash Website](https://www.gnu.org/software/bash/)
- [@video@Bash in 100 Seconds](https://www.youtube.com/watch?v=I4EWvMFj37g)
"""


def snapshot_for(slug: str, files: list[tuple[str, str]]) -> RoadmapShSnapshot:
    return RoadmapShSnapshot(
        files={slug: [MarkdownFile(name=name, text=text) for name, text in files]}
    )


def parsed_slug(slug: str, files: list[tuple[str, str]]) -> list[svc.ParsedTopic]:
    return [
        topic
        for topic in (
            parse_markdown(MarkdownFile(name=name, text=text)) for name, text in files
        )
        if topic is not None
    ]


# ---------------------------------------------------------------- parser


def test_parse_markdown_extracts_title_brief_and_links():
    topic = parse_markdown(MarkdownFile(name="bash@hash.md", text=SAMPLE))
    assert topic is not None
    assert topic.title == "Bash"
    assert "command language interpreter" in topic.brief
    assert "Visit the following resources" not in topic.brief
    assert topic.links == [
        ("official", "Bash Website", "https://www.gnu.org/software/bash/"),
        ("video", "Bash in 100 Seconds", "https://www.youtube.com/watch?v=I4EWvMFj37g"),
    ]
    assert topic.source_file == "bash@hash.md"


def test_parse_markdown_ignores_non_http_links_and_empty_brief_defaults():
    text = "# Something\n\nShort.\n\n- [@official@X](https://x.dev)\n- [@video@Bad](ftp://bad.example/a)\n"
    topic = parse_markdown(MarkdownFile(name="something.md", text=text))
    assert topic is not None
    assert topic.links == [("official", "X", "https://x.dev")]


def test_clean_title_fixes_placeholders_and_doubled_words():
    assert _clean_title("# Setting up ________", "what-is-and-how-to-setup-x@h.md") == "What Is And How To Setup X"
    assert _clean_title("# Checkpoint", "checkpoint--ci--cd@h.md") == "Checkpoint: Ci Cd"
    assert _clean_title("# RAGRAG", "rag@h.md") == "RAG"
    assert _clean_title("# Kubernetes", "kubernetes@h.md") == "Kubernetes"


# ---------------------------------------------------------------- grouping


def test_group_into_phases_buckets_by_keyword_and_falls_back_to_trailing():
    devops_topics = [
        svc.ParsedTopic(title="Docker", brief="b", source_file="docker.md"),
        svc.ParsedTopic(title="Ansible", brief="b", source_file="ansible.md"),
        svc.ParsedTopic(title="Totally Unmatched Topic", brief="b", source_file="um.md"),
        svc.ParsedTopic(title="Kubernetes", brief="b", source_file="k8s.md"),
    ]
    phases = group_into_phases("devops", devops_topics)
    titles = [p.title for _, entries in phases for p in entries]
    # Docker matches "Containers & Orchestration", Ansible "CI/CD & Automation",
    # Kubernetes "Containers & Orchestration", unmatched falls to the last phase.
    assert "Docker" in titles and "Kubernetes" in titles and "Ansible" in titles
    assert phases[-1][0] == "Additional Topics"
    assert [p.title for p in phases[-1][1]] == ["Totally Unmatched Topic"]


# ---------------------------------------------------------------- synthesis


def test_build_candidate_is_valid_and_self_paced():
    files = [
        ("docker@h1.md", "# Docker\n\nDocker is a container platform that packages applications with their dependencies for portable execution across environments.\n\n- [@official@Docker Docs](https://docs.docker.com/)\n- [@video@Docker in 100 Seconds](https://www.youtube.com/watch?v=Gjnup-PuquQ)\n"),
        ("kubernetes@h2.md", "# Kubernetes\n\nKubernetes orchestrates containerized workloads across clusters with automated deployment, scaling, and management.\n\n- [@official@K8s Docs](https://kubernetes.io/docs/)\n- [@article@K8s Basics](https://kubernetes.io/docs/tutorials/kubernetes-basics/)\n"),
        ("jenkins@h3.md", "# Jenkins\n\nJenkins is an automation server that supports building, deploying, and automating software projects via pipelines.\n\n- [@official@Jenkins](https://www.jenkins.io/)\n"),
    ]
    phases = group_into_phases("devops", parsed_slug("devops", files))
    cand, sources, profile = build_candidate(
        owner_id="usr_x", slug="devops", topics_by_phase=phases, snapshot=snapshot_for("devops", files)
    )
    report = validate_curriculum(cand, profile, sources)
    assert report.valid, [i.message for i in report.issues if i.severity == "error"]

    assert cand.title == "DevOps Roadmap"
    root = next(i for i in cand.items if i.kind == "root")
    phases_items = [i for i in cand.items if i.kind == "phase"]
    topics = [i for i in cand.items if i.kind == "topic"]
    assert phases_items and topics
    # Containment chain root -> phase -> topic is present.
    assert any(r.kind == "contains" and r.source_id == root.id for r in cand.relations)
    assert any(
        r.kind == "contains" and r.source_id == phases_items[0].id for r in cand.relations
    )
    # Every active topic has 1-2 grounded sources + resources.
    assert len(sources) == 5
    assert all(s.status == "grounded" and s.evidence and s.url for s in sources)
    by_topic: dict[str, int] = {}
    for r in cand.resources:
        by_topic[r.topic_id] = by_topic.get(r.topic_id, 0) + 1
    assert set(by_topic.values()) <= {1, 2}
    assert set(by_topic) == {t.id for t in topics}
    # Self-paced profile: no duration, no weekly minutes, no sessions.
    assert profile.weekly_minutes is None and profile.study_weeks is None
    assert cand.sessions == []
    # Deterministic: same inputs -> same item ids.
    cand2, _, _ = build_candidate(
        owner_id="usr_x", slug="devops", topics_by_phase=phases, snapshot=snapshot_for("devops", files)
    )
    assert [i.id for i in cand.items] == [i.id for i in cand2.items]


def test_active_topic_cap_archives_overflow_but_stays_valid():
    count = MAX_COVERAGE_TOPICS + 5
    files = [
        (
            f"topic-{i}@h.md",
            f"# Topic {i}\n\nUnique topic number {i} with a sufficiently long brief to produce objectives and evidence text for the curriculum validator and its resource records.\n\n- [@article@Resource {i}](https://example.com/{i})\n",
        )
        for i in range(count)
    ]
    phases = group_into_phases("devops", parsed_slug("devops", files))
    cand, sources, profile = build_candidate(
        owner_id="usr_x", slug="devops", topics_by_phase=phases, snapshot=snapshot_for("devops", files)
    )
    active = [i for i in cand.items if i.kind == "topic" and i.participation == "active"]
    archived = [i for i in cand.items if i.kind == "topic" and i.participation == "archived"]
    assert len(active) == MAX_COVERAGE_TOPICS
    assert len(archived) == 5
    report = validate_curriculum(cand, profile, sources)
    assert report.valid, [i.message for i in report.issues if i.severity == "error"]


# ---------------------------------------------------------------- persistence


async def make_owner(curriculum_session) -> str:
    owner_id = f"usr_{uuid.uuid4().hex[:12]}"
    curriculum_session.add(
        User(id=owner_id, email=f"{uuid.uuid4().hex}@example.com", full_name="Import owner")
    )
    await curriculum_session.flush()
    return owner_id


async def cleanup_owner(curriculum_session, owner_id: str) -> None:
    await curriculum_session.execute(delete(Workspace).where(Workspace.owner_id == owner_id))
    await curriculum_session.execute(delete(User).where(User.id == owner_id))
    await curriculum_session.commit()


FILES_DEVOPS = [
    ("docker@h1.md", "# Docker\n\nDocker is a container platform that packages applications with their dependencies for portable execution across environments.\n\n- [@official@Docker Docs](https://docs.docker.com/)\n"),
    ("ansible@h2.md", "# Ansible\n\nAnsible is an open-source automation tool for configuration management, application deployment, and task orchestration.\n\n- [@official@Ansible Website](https://www.ansible.com/)\n"),
]


async def test_import_slug_creates_workspace_roadmap_and_anchor(curriculum_session):
    owner_id = await make_owner(curriculum_session)
    try:
        snapshot = snapshot_for("devops", FILES_DEVOPS)
        view, status = await import_slug(
            curriculum_session, owner_id=owner_id, slug="devops", snapshot=snapshot
        )
        assert status == "created"
        assert view.candidate.title == "DevOps Roadmap"

        workspace = await curriculum_session.get(Workspace, view.workspace_id)
        roadmap = await curriculum_session.get(Roadmap, view.roadmap_id)
        revision = await curriculum_session.get(CurriculumRevision, view.revision_id)
        assert workspace is not None and workspace.owner_id == owner_id
        assert roadmap is not None and roadmap.workspace_id == workspace.id
        assert revision is not None and revision.status == "active"

        anchors = (
            await curriculum_session.scalars(
                select(NodeModel).where(
                    NodeModel.workspace_id == workspace.id, NodeModel.role == "system"
                )
            )
        ).all()
        assert len(anchors) == 1
        meta = anchors[0].metadata_payload
        assert meta["importSource"] == "roadmap.sh" and meta["importSlug"] == "devops"
        assert roadmap.canvas_anchor_chat_id == anchors[0].id
        assert roadmap.workspace_id == workspace.id
        assert anchors[0].workspace_id == workspace.id
    finally:
        await cleanup_owner(curriculum_session, owner_id)


async def test_import_slug_is_idempotent(curriculum_session):
    owner_id = await make_owner(curriculum_session)
    try:
        snapshot = snapshot_for("devops", FILES_DEVOPS)
        first, status = await import_slug(
            curriculum_session, owner_id=owner_id, slug="devops", snapshot=snapshot
        )
        assert status == "created"
        second, status2 = await import_slug(
            curriculum_session, owner_id=owner_id, slug="devops", snapshot=snapshot
        )
        assert status2 == "existing"
        assert second.workspace_id == first.workspace_id
        workspace_count = await curriculum_session.scalar(
            select(func.count(Workspace.id)).where(Workspace.owner_id == owner_id)
        )
        assert workspace_count == 1
    finally:
        await cleanup_owner(curriculum_session, owner_id)


async def test_import_roadmaps_isolates_per_slug_failures(curriculum_session):
    owner_id = await make_owner(curriculum_session)
    try:
        archive = tarball_with({"devops": FILES_DEVOPS})
        results, errors = await import_roadmaps(
            curriculum_session, owner_id=owner_id, slugs=["devops", "nope"],
            downloader=lambda url: archive,
        )
        # 'nope' is not a curated field -> error entry, devops committed.
        assert {r["slug"] for r in results} == {"devops"}
        assert {e["slug"] for e in errors} == {"nope"}
        assert errors[0]["error"] == "UNKNOWN_FIELD"
    finally:
        await cleanup_owner(curriculum_session, owner_id)


async def test_import_roadmaps_unknown_curated_slug_missing_from_snapshot_is_isolated(
    curriculum_session,
):
    owner_id = await make_owner(curriculum_session)
    try:
        archive = tarball_with({"devops": FILES_DEVOPS})
        results, errors = await import_roadmaps(
            curriculum_session, owner_id=owner_id, slugs=["devops", "ai-engineer"],
            downloader=lambda url: archive,
        )
        assert {r["slug"] for r in results} == {"devops"}
        assert {e["slug"] for e in errors} == {"ai-engineer"}
        assert "ROADMAP_SH_SLUG_UNAVAILABLE" in errors[0]["error"]
    finally:
        await cleanup_owner(curriculum_session, owner_id)
