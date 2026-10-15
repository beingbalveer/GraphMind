"""Controlled publication of validated curricula into immutable public snapshots.

This module is the LSI-025 boundary between a *private*, workspace-owned
curriculum revision and the *public*, guest-readable snapshot catalog. It is
deliberately tooling-first: a curator publishes a validated revision with
:meth:`PublicSnapshotService.publish_revision` (or the batch helper
:func:`seed_public_snapshots`) instead of authoring content in a CMS.

Guarantees enforced here:

* Only a validated curriculum revision can be published
  (``SNAPSHOT_UNVALIDATED``).
* Only the owner of the source workspace may publish or unpublish it
  (``PUBLICATION_FORBIDDEN``).
* Publication freezes the whole snapshot in one transaction; the
  ``(template_id, snapshot_version)`` unique constraint makes a concurrent
  duplicate fail atomically rather than partially.
* A published ``(template_id, snapshot_version)`` is immutable: re-publishing
  identical content is an idempotent no-op, and different content is rejected
  with ``SNAPSHOT_IMMUTABLE`` (bump the snapshot version instead).
* Unpublishing flips status only; rows and private copies are never deleted.
* Public DTOs are built from explicit, vetted fields, so private IDs, uploads,
  source provenance, and learner progress can never leak.
"""

import hashlib
import json
import re
import uuid
from collections import defaultdict
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import cast

from models.public_snapshot import (
    PublicSnapshot,
    PublicSnapshotOrigin,
    PublicSnapshotPhase,
    PublicSnapshotSource,
    PublicSnapshotTopic,
    PublicSnapshotTopicSource,
)
from models.roadmap import Roadmap, utc_now
from models.workspace import Workspace
from schemas.curriculum import CurriculumView
from schemas.public import (
    PublicLessonDetail,
    PublicLessonFormat,
    PublicLevel,
    PublicPath,
    PublicPhaseDetail,
    PublicRoadmapDetail,
    PublicRoadmapSummary,
    PublicRoadmapSummaryList,
    PublicSnapshotPublication,
    PublicSnapshotRecord,
    PublicSnapshotStatus,
    PublicSourceReference,
    PublicTopicSummary,
)
from services.roadmap.curriculum_repository import CurriculumRepository
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession


class PublicSnapshotError(ValueError):
    """A structured public-snapshot failure with a stable, public-safe code."""

    def __init__(self, code: str, message: str, *, detail: Sequence[str] = ()) -> None:
        self.code = code
        self.detail = list(detail)
        super().__init__(message)


@dataclass(frozen=True)
class SanitizedPhase:
    phase_id: str
    title: str
    position: int
    path: str


@dataclass(frozen=True)
class SanitizedSource:
    source_id: str
    title: str
    url: str | None
    locator: str | None
    kind: str
    position: int


@dataclass(frozen=True)
class SanitizedTopic:
    topic_id: str
    slug: str
    title: str
    brief: str
    objectives: list[str]
    content_markdown: str | None
    exercise: str | None
    format: str | None
    estimate_minutes: int | None
    path: str
    position: int
    phase_id: str
    prerequisites: list[str]
    source_ids: list[str]


@dataclass(frozen=True)
class SanitizedSnapshot:
    template_id: str
    title: str
    summary: str
    category: str
    level: str
    estimated_weeks: int
    hours_per_week: float
    outcomes: list[str]
    prerequisites: list[str]
    tags: list[str]
    phases: list[SanitizedPhase]
    topics: list[SanitizedTopic]
    sources: list[SanitizedSource]


@dataclass(frozen=True)
class CuratedSnapshotSeed:
    """One entry of curated seed/publish tooling: a validated revision to freeze."""

    workspace_id: str
    revision_id: str
    publication: PublicSnapshotPublication


def _public_id(kind: str, template_id: str, private_id: str) -> str:
    """Deterministic opaque public identity; the private ID is never exposed."""
    digest = uuid.uuid5(
        uuid.NAMESPACE_URL, f"graphmind:public:{template_id}:{kind}:{private_id}"
    ).hex[:24]
    return f"pub_{kind}_{digest}"


def _unique_slug(title: str, taken: set[str]) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:64] or "topic"
    slug = base
    counter = 2
    while slug in taken:
        suffix = f"-{counter}"
        slug = f"{base[: 64 - len(suffix)]}{suffix}"
        counter += 1
    taken.add(slug)
    return slug


def _contains_pattern(value: str) -> str:
    """A literal, escaped ``%value%`` pattern for catalog search.

    ``%`` and ``_`` are LIKE wildcards, so an unescaped user query would be a
    wildcard match rather than a literal one. Escaping keeps search deterministic
    for any input.
    """
    escaped = value.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def sanitize_curriculum(
    view: CurriculumView,
    *,
    template_id: str,
    publication: PublicSnapshotPublication,
) -> SanitizedSnapshot:
    """Project a validated private curriculum into vetted public content only.

    Active topics must belong to an active phase; anything ambiguous is rejected
    loudly (``SNAPSHOT_UNSTRUCTURED``) rather than published partially. Source
    provenance, evidence, and access metadata never leave this function.
    """
    candidate = view.candidate
    profile = view.profile
    items = {item.id: item for item in candidate.items}

    parents: dict[str, str] = {}
    for relation in candidate.relations:
        if relation.kind == "contains":
            parents.setdefault(relation.target_id, relation.source_id)

    def resolve_phase(topic_id: str) -> str | None:
        seen: set[str] = set()
        current = topic_id
        while current in parents:
            parent = parents[current]
            if parent in seen:
                return None
            seen.add(parent)
            item = items.get(parent)
            if item is None:
                return None
            if item.kind == "phase":
                return parent
            if item.kind == "root":
                return None
            current = parent
        return None

    phases = [
        item for item in candidate.items if item.kind == "phase" and item.participation == "active"
    ]
    allowed_phases = {phase.id: phase for phase in phases}
    topics = [
        item for item in candidate.items if item.kind == "topic" and item.participation == "active"
    ]
    if not topics:
        raise PublicSnapshotError(
            "SNAPSHOT_EMPTY", "A public snapshot must contain at least one active topic"
        )

    resolved: dict[str, str] = {}
    for topic in topics:
        phase_id = resolve_phase(topic.id)
        if phase_id is None or phase_id not in allowed_phases:
            resolved[topic.id] = ""
        else:
            resolved[topic.id] = phase_id
    unstructured = [topic_id for topic_id, phase_id in resolved.items() if not phase_id]
    if unstructured:
        raise PublicSnapshotError(
            "SNAPSHOT_UNSTRUCTURED",
            "Every published topic must belong to a phase before publication",
            detail=unstructured,
        )

    prerequisites: dict[str, list[str]] = defaultdict(list)
    for relation in candidate.relations:
        if relation.kind == "prerequisite":
            prerequisites[relation.target_id].append(relation.source_id)

    source_lookup = {source.id: source for source in view.sources}
    topic_ids = {topic.id for topic in topics}
    referenced_sources: list[str] = []
    topic_source_links: dict[str, list[tuple[str, int]]] = defaultdict(list)
    for resource in candidate.resources:
        if resource.topic_id not in topic_ids:
            continue
        source = source_lookup.get(resource.source_id)
        if source is None or source.status == "unavailable":
            continue
        if resource.source_id not in referenced_sources:
            referenced_sources.append(resource.source_id)
        topic_source_links[resource.topic_id].append((resource.source_id, resource.order))
    for links in topic_source_links.values():
        links.sort(key=lambda link: link[1])

    source_rows = [
        SanitizedSource(
            source_id=_public_id("src", template_id, source_id),
            title=source_lookup[source_id].title,
            url=source_lookup[source_id].url,
            locator=source_lookup[source_id].locator,
            kind=source_lookup[source_id].kind,
            position=position,
        )
        for position, source_id in enumerate(referenced_sources)
    ]
    source_id_map = {
        source_id: row.source_id for source_id, row in zip(referenced_sources, source_rows)
    }

    topic_id_map = {topic.id: _public_id("topic", template_id, topic.id) for topic in topics}
    taken_slugs: set[str] = set()
    topic_rows: list[SanitizedTopic] = []
    for position, topic in enumerate(sorted(topics, key=lambda item: (item.order, item.id))):
        topic_rows.append(
            SanitizedTopic(
                topic_id=topic_id_map[topic.id],
                slug=_unique_slug(topic.title, taken_slugs),
                title=topic.title,
                brief=topic.brief,
                objectives=list(topic.objectives),
                content_markdown=topic.content_markdown,
                exercise=topic.exercise,
                format=topic.format,
                estimate_minutes=topic.estimate_minutes,
                path=topic.path,
                position=position,
                phase_id=_public_id("phase", template_id, resolved[topic.id]),
                prerequisites=[
                    topic_id_map[source_id]
                    for source_id in prerequisites.get(topic.id, [])
                    if source_id in topic_id_map
                ],
                source_ids=[
                    source_id_map[source_id]
                    for source_id, _ in topic_source_links.get(topic.id, [])
                    if source_id in source_id_map
                ],
            )
        )

    kept_phase_ids = {resolved[topic.id] for topic in topics}
    phase_rows = [
        SanitizedPhase(
            phase_id=_public_id("phase", template_id, phase.id),
            title=phase.title,
            position=phase.order,
            path=phase.path,
        )
        for phase in sorted(phases, key=lambda item: item.order)
        if phase.id in kept_phase_ids
    ]

    estimated_weeks = publication.estimated_weeks or profile.study_weeks
    hours_per_week = publication.hours_per_week or (
        float(profile.hours_per_week) if profile.hours_per_week is not None else None
    )
    if estimated_weeks is None or hours_per_week is None:
        missing = [
            name
            for name, value in (
                ("estimated_weeks", estimated_weeks),
                ("hours_per_week", hours_per_week),
            )
            if value is None
        ]
        raise PublicSnapshotError(
            "SNAPSHOT_METADATA_INCOMPLETE",
            "Provide the missing catalog metadata before publication",
            detail=missing,
        )
    resolved_weeks = int(estimated_weeks)
    resolved_hours = float(hours_per_week)

    return SanitizedSnapshot(
        template_id=template_id,
        title=candidate.title,
        summary=publication.summary or candidate.outcome,
        category=publication.category,
        level=publication.level or profile.level,
        estimated_weeks=resolved_weeks,
        hours_per_week=resolved_hours,
        outcomes=(
            list(publication.outcomes) if publication.outcomes is not None else [candidate.outcome]
        ),
        prerequisites=list(publication.prerequisites or []),
        tags=list(publication.tags),
        phases=phase_rows,
        topics=topic_rows,
        sources=source_rows,
    )


def _content_hash(snapshot: SanitizedSnapshot) -> str:
    payload = {
        "templateId": snapshot.template_id,
        "title": snapshot.title,
        "summary": snapshot.summary,
        "category": snapshot.category,
        "level": snapshot.level,
        "estimatedWeeks": snapshot.estimated_weeks,
        "hoursPerWeek": snapshot.hours_per_week,
        "outcomes": snapshot.outcomes,
        "prerequisites": snapshot.prerequisites,
        "tags": snapshot.tags,
        "phases": [
            {
                "id": phase.phase_id,
                "title": phase.title,
                "order": phase.position,
                "path": phase.path,
            }
            for phase in snapshot.phases
        ],
        "topics": [
            {
                "id": topic.topic_id,
                "slug": topic.slug,
                "title": topic.title,
                "brief": topic.brief,
                "objectives": topic.objectives,
                "contentMarkdown": topic.content_markdown,
                "exercise": topic.exercise,
                "format": topic.format,
                "estimateMinutes": topic.estimate_minutes,
                "path": topic.path,
                "order": topic.position,
                "phaseId": topic.phase_id,
                "prerequisites": topic.prerequisites,
                "sourceIds": topic.source_ids,
            }
            for topic in snapshot.topics
        ],
        "sources": [
            {
                "id": source.source_id,
                "title": source.title,
                "url": source.url,
                "locator": source.locator,
                "kind": source.kind,
                "order": source.position,
            }
            for source in snapshot.sources
        ],
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _record(snapshot: PublicSnapshot) -> PublicSnapshotRecord:
    return PublicSnapshotRecord(
        id=snapshot.id,
        template_id=snapshot.template_id,
        snapshot_version=snapshot.snapshot_version,
        slug=snapshot.slug,
        status=cast(PublicSnapshotStatus, snapshot.status),
        content_hash=snapshot.content_hash,
        topic_count=snapshot.topic_count,
        published_at=snapshot.published_at,
        unpublished_at=snapshot.unpublished_at,
    )


class PublicSnapshotService:
    """Owns no commit: publication and reads share the caller's transaction."""

    def __init__(
        self, session: AsyncSession, *, clock: Callable[[], datetime] | None = None
    ) -> None:
        self.session = session
        self.clock = clock or utc_now

    async def publish_revision(
        self,
        actor_id: str,
        *,
        publication: PublicSnapshotPublication,
        workspace_id: str,
        revision_id: str,
    ) -> PublicSnapshotRecord:
        workspace = await self.session.get(Workspace, workspace_id)
        if workspace is None or workspace.owner_id != actor_id:
            raise PublicSnapshotError(
                "PUBLICATION_FORBIDDEN",
                "Only the owner of the source workspace may publish it",
            )
        roadmap = await self.session.scalar(
            select(Roadmap).where(Roadmap.workspace_id == workspace_id)
        )
        if roadmap is None:
            raise PublicSnapshotError("ROADMAP_NOT_FOUND", "The source roadmap was not found")
        try:
            view = await CurriculumRepository(self.session, reader_id=actor_id).read_revision(
                roadmap.id, revision_id
            )
        except ValueError:
            raise PublicSnapshotError(
                "REVISION_NOT_FOUND", "The source curriculum revision was not found"
            ) from None
        if not view.validation.valid:
            raise PublicSnapshotError(
                "SNAPSHOT_UNVALIDATED",
                "Only a valid curriculum revision can be published",
                detail=[
                    issue.code for issue in view.validation.issues if issue.severity == "error"
                ],
            )

        sanitized = sanitize_curriculum(
            view, template_id=publication.template_id, publication=publication
        )
        content_hash = _content_hash(sanitized)

        existing = await self.session.scalar(
            select(PublicSnapshot)
            .where(
                PublicSnapshot.template_id == publication.template_id,
                PublicSnapshot.snapshot_version == publication.snapshot_version,
            )
            .with_for_update()
        )
        if existing is not None:
            if existing.content_hash != content_hash:
                raise PublicSnapshotError(
                    "SNAPSHOT_IMMUTABLE",
                    "This public snapshot version is immutable; publish a new snapshot version",
                )
            if existing.status != "published":
                existing.status = "published"
                existing.unpublished_at = None
                await self.session.flush()
            return _record(existing)

        # The slug belongs to the template, not the version: every version of a
        # template shares one slug so ``/public/roadmaps/{slug}`` stays stable
        # across releases. It defaults to the (already public, unique) template
        # identifier and may only collide with a *different* template.
        slug = publication.slug or _unique_slug(publication.template_id, set())
        conflict = await self.session.scalar(
            select(PublicSnapshot.id).where(
                PublicSnapshot.slug == slug,
                PublicSnapshot.template_id != publication.template_id,
            )
        )
        if conflict is not None:
            raise PublicSnapshotError(
                "SNAPSHOT_SLUG_CONFLICT",
                "Another public template already owns this slug",
            )

        now = self.clock()
        snapshot = PublicSnapshot(
            template_id=sanitized.template_id,
            snapshot_version=publication.snapshot_version,
            slug=slug,
            title=sanitized.title,
            summary=sanitized.summary,
            category=sanitized.category,
            level=sanitized.level,
            estimated_weeks=sanitized.estimated_weeks,
            hours_per_week=sanitized.hours_per_week,
            topic_count=len(sanitized.topics),
            outcomes=sanitized.outcomes,
            prerequisites=sanitized.prerequisites,
            tags=sanitized.tags,
            content_hash=content_hash,
            status="published",
            published_at=now,
            unpublished_at=None,
        )
        self.session.add(snapshot)
        await self.session.flush()

        for phase in sanitized.phases:
            self.session.add(
                PublicSnapshotPhase(
                    snapshot_id=snapshot.id,
                    phase_id=phase.phase_id,
                    title=phase.title,
                    position=phase.position,
                    path=phase.path,
                )
            )
        for source in sanitized.sources:
            self.session.add(
                PublicSnapshotSource(
                    snapshot_id=snapshot.id,
                    source_id=source.source_id,
                    title=source.title,
                    url=source.url,
                    locator=source.locator,
                    kind=source.kind,
                    position=source.position,
                )
            )
        for topic in sanitized.topics:
            self.session.add(
                PublicSnapshotTopic(
                    snapshot_id=snapshot.id,
                    topic_id=topic.topic_id,
                    phase_id=topic.phase_id,
                    slug=topic.slug,
                    title=topic.title,
                    brief=topic.brief,
                    objectives=topic.objectives,
                    content_markdown=topic.content_markdown,
                    exercise=topic.exercise,
                    format=topic.format,
                    estimate_minutes=topic.estimate_minutes,
                    path=topic.path,
                    position=topic.position,
                    prerequisites=topic.prerequisites,
                )
            )
            for position, source_id in enumerate(topic.source_ids):
                self.session.add(
                    PublicSnapshotTopicSource(
                        snapshot_id=snapshot.id,
                        topic_id=topic.topic_id,
                        source_id=source_id,
                        position=position,
                    )
                )
        self.session.add(
            PublicSnapshotOrigin(
                snapshot_id=snapshot.id,
                source_workspace_id=workspace_id,
                source_roadmap_id=roadmap.id,
                source_revision_id=revision_id,
                published_by=actor_id,
            )
        )
        await self.session.flush()
        return _record(snapshot)

    async def unpublish(
        self, actor_id: str, *, template_id: str, snapshot_version: str
    ) -> PublicSnapshotRecord:
        snapshot = await self.session.scalar(
            select(PublicSnapshot)
            .where(
                PublicSnapshot.template_id == template_id,
                PublicSnapshot.snapshot_version == snapshot_version,
            )
            .with_for_update()
        )
        if snapshot is None:
            raise PublicSnapshotError("SNAPSHOT_NOT_FOUND", "This public snapshot does not exist")
        origin = await self.session.get(PublicSnapshotOrigin, snapshot.id)
        await self._require_publish_permission(actor_id, origin)
        if snapshot.status != "unpublished":
            snapshot.status = "unpublished"
            snapshot.unpublished_at = self.clock()
            await self.session.flush()
        return _record(snapshot)

    async def _require_publish_permission(
        self, actor_id: str, origin: PublicSnapshotOrigin | None
    ) -> None:
        if origin is not None and origin.published_by == actor_id:
            return
        if origin is not None and origin.source_workspace_id:
            workspace = await self.session.get(Workspace, origin.source_workspace_id)
            if workspace is not None and workspace.owner_id == actor_id:
                return
        raise PublicSnapshotError(
            "PUBLICATION_FORBIDDEN",
            "Only the publisher or source owner may change this publication",
        )

    async def _published_snapshot(
        self,
        *,
        template_id: str | None = None,
        snapshot_version: str | None = None,
        slug: str | None = None,
    ) -> PublicSnapshot | None:
        stmt = select(PublicSnapshot).where(PublicSnapshot.status == "published")
        if template_id is not None:
            stmt = stmt.where(PublicSnapshot.template_id == template_id)
        if snapshot_version is not None:
            stmt = stmt.where(PublicSnapshot.snapshot_version == snapshot_version)
        if slug is not None:
            stmt = stmt.where(PublicSnapshot.slug == slug)
        return cast(
            PublicSnapshot | None,
            await self.session.scalar(
                stmt.order_by(PublicSnapshot.published_at.desc(), PublicSnapshot.id)
            ),
        )

    async def read_roadmap(
        self,
        *,
        template_id: str | None = None,
        snapshot_version: str | None = None,
        slug: str | None = None,
    ) -> PublicRoadmapDetail | None:
        snapshot = await self._published_snapshot(
            template_id=template_id, snapshot_version=snapshot_version, slug=slug
        )
        if snapshot is None:
            return None
        return await self._detail(snapshot)

    async def read_lesson(
        self, *, template_id: str, snapshot_version: str, topic_ref: str
    ) -> PublicLessonDetail | None:
        snapshot = await self._published_snapshot(
            template_id=template_id, snapshot_version=snapshot_version
        )
        if snapshot is None:
            return None
        topic = await self.session.scalar(
            select(PublicSnapshotTopic).where(
                PublicSnapshotTopic.snapshot_id == snapshot.id,
                or_(
                    PublicSnapshotTopic.topic_id == topic_ref,
                    PublicSnapshotTopic.slug == topic_ref,
                ),
            )
        )
        if topic is None:
            return None
        return PublicLessonDetail(
            template_id=snapshot.template_id,
            snapshot_version=snapshot.snapshot_version,
            topic_id=topic.topic_id,
            topic_slug=topic.slug,
            title=topic.title,
            brief=topic.brief,
            objectives=list(topic.objectives),
            content_markdown=topic.content_markdown,
            exercise=topic.exercise,
            format=cast(PublicLessonFormat | None, topic.format),
            estimate_minutes=topic.estimate_minutes,
            sources=await self._topic_sources(snapshot.id, topic.topic_id),
        )

    async def list_published(
        self,
        *,
        query: str | None = None,
        category: str | None = None,
        level: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> PublicRoadmapSummaryList:
        filters = [PublicSnapshot.status == "published"]
        if query:
            filters.append(PublicSnapshot.title.ilike(f"%{query.strip()}%"))
        if category:
            filters.append(PublicSnapshot.category == category)
        if level:
            filters.append(PublicSnapshot.level == level)
        total = int(
            (
                await self.session.scalar(
                    select(func.count()).select_from(PublicSnapshot).where(*filters)
                )
            )
            or 0
        )
        rows = (
            await self.session.scalars(
                select(PublicSnapshot)
                .where(*filters)
                .order_by(PublicSnapshot.updated_at.desc(), PublicSnapshot.id)
                .limit(limit)
                .offset(offset)
            )
        ).all()
        return PublicRoadmapSummaryList(
            items=[self._summary(snapshot) for snapshot in rows],
            total=total,
            limit=limit,
            offset=offset,
        )

    async def list_catalog(
        self,
        *,
        query: str | None = None,
        category: str | None = None,
        level: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> PublicRoadmapSummaryList:
        """Anonymous catalog: exactly one published card per roadmap template.

        ``list_published`` returns *every* published row, including superseded
        versions of the same template. A catalog card carries the template id,
        so listing all versions would emit duplicate ids. This ranks published
        rows per template and keeps the newest one (``published_at`` then
        ``id``), the same deterministic choice ``read_roadmap`` uses when it
        resolves the newest version by ``slug``.

        Only ``status = 'published'`` rows are ever considered, so an
        unpublished or superseded snapshot can never be listed.
        """
        filters = [PublicSnapshot.status == "published"]
        if query and query.strip():
            pattern = _contains_pattern(query)
            filters.append(
                or_(
                    PublicSnapshot.title.ilike(pattern, escape="\\"),
                    PublicSnapshot.summary.ilike(pattern, escape="\\"),
                )
            )
        if category:
            filters.append(PublicSnapshot.category == category)
        if level:
            filters.append(PublicSnapshot.level == level)

        newest = (
            select(
                PublicSnapshot.id.label("snapshot_id"),
                func.row_number()
                .over(
                    partition_by=PublicSnapshot.template_id,
                    order_by=[PublicSnapshot.published_at.desc(), PublicSnapshot.id],
                )
                .label("version_rank"),
            )
            .where(*filters)
            .subquery()
        )
        newest_ids = select(newest.c.snapshot_id).where(newest.c.version_rank == 1)
        total = int(
            (await self.session.scalar(select(func.count()).select_from(newest_ids.subquery())))
            or 0
        )
        rows = (
            await self.session.scalars(
                select(PublicSnapshot)
                .where(PublicSnapshot.id.in_(newest_ids))
                .order_by(PublicSnapshot.published_at.desc(), PublicSnapshot.id)
                .limit(limit)
                .offset(offset)
            )
        ).all()
        return PublicRoadmapSummaryList(
            items=[self._summary(snapshot) for snapshot in rows],
            total=total,
            limit=limit,
            offset=offset,
        )

    def _summary(self, snapshot: PublicSnapshot) -> PublicRoadmapSummary:
        return PublicRoadmapSummary(
            id=snapshot.template_id,
            slug=snapshot.slug,
            title=snapshot.title,
            summary=snapshot.summary,
            category=snapshot.category,
            level=cast(PublicLevel, snapshot.level),
            estimated_weeks=snapshot.estimated_weeks,
            hours_per_week=snapshot.hours_per_week,
            topic_count=snapshot.topic_count,
            snapshot_version=snapshot.snapshot_version,
            tags=list(snapshot.tags),
            updated_at=snapshot.updated_at,
        )

    async def _detail(self, snapshot: PublicSnapshot) -> PublicRoadmapDetail:
        phases = (
            await self.session.scalars(
                select(PublicSnapshotPhase)
                .where(PublicSnapshotPhase.snapshot_id == snapshot.id)
                .order_by(PublicSnapshotPhase.position)
            )
        ).all()
        topics = (
            await self.session.scalars(
                select(PublicSnapshotTopic)
                .where(PublicSnapshotTopic.snapshot_id == snapshot.id)
                .order_by(PublicSnapshotTopic.position)
            )
        ).all()
        sources = await self._snapshot_sources(snapshot.id)
        by_phase: dict[str, list[PublicSnapshotTopic]] = defaultdict(list)
        for topic in topics:
            by_phase[topic.phase_id].append(topic)
        return PublicRoadmapDetail(
            id=snapshot.template_id,
            slug=snapshot.slug,
            title=snapshot.title,
            summary=snapshot.summary,
            category=snapshot.category,
            level=cast(PublicLevel, snapshot.level),
            snapshot_version=snapshot.snapshot_version,
            outcomes=list(snapshot.outcomes),
            prerequisites=list(snapshot.prerequisites),
            phases=[
                PublicPhaseDetail(
                    id=phase.phase_id,
                    title=phase.title,
                    order=phase.position,
                    topics=[
                        PublicTopicSummary(
                            id=topic.topic_id,
                            slug=topic.slug,
                            title=topic.title,
                            brief=topic.brief,
                            order=topic.position,
                            path=cast(PublicPath, topic.path),
                            estimate_minutes=topic.estimate_minutes,
                            prerequisites=list(topic.prerequisites),
                        )
                        for topic in by_phase.get(phase.phase_id, [])
                    ],
                )
                for phase in phases
            ],
            sources=sources,
        )

    async def _snapshot_sources(self, snapshot_id: str) -> list[PublicSourceReference]:
        rows = (
            await self.session.scalars(
                select(PublicSnapshotSource)
                .where(PublicSnapshotSource.snapshot_id == snapshot_id)
                .order_by(PublicSnapshotSource.position)
            )
        ).all()
        return [_source_ref(row) for row in rows]

    async def _topic_sources(self, snapshot_id: str, topic_id: str) -> list[PublicSourceReference]:
        links = (
            await self.session.scalars(
                select(PublicSnapshotTopicSource)
                .where(
                    PublicSnapshotTopicSource.snapshot_id == snapshot_id,
                    PublicSnapshotTopicSource.topic_id == topic_id,
                )
                .order_by(PublicSnapshotTopicSource.position)
            )
        ).all()
        if not links:
            return []
        source_ids = [link.source_id for link in links]
        rows = (
            await self.session.scalars(
                select(PublicSnapshotSource).where(
                    PublicSnapshotSource.snapshot_id == snapshot_id,
                    PublicSnapshotSource.source_id.in_(source_ids),
                )
            )
        ).all()
        by_id = {row.source_id: row for row in rows}
        return [_source_ref(by_id[source_id]) for source_id in source_ids if source_id in by_id]


def _source_ref(row: PublicSnapshotSource) -> PublicSourceReference:
    return PublicSourceReference(
        id=row.source_id,
        title=row.title,
        url=row.url,
        locator=row.locator,
        kind=row.kind,
    )


async def seed_public_snapshots(
    session: AsyncSession, actor_id: str, seeds: Sequence[CuratedSnapshotSeed]
) -> list[PublicSnapshotRecord]:
    """Curated seed/publish tooling: freeze a batch of validated revisions.

    Each seed is idempotent, so re-running a seed script republishes identical
    content without duplicating rows and fails loudly on drift.
    """
    service = PublicSnapshotService(session)
    records: list[PublicSnapshotRecord] = []
    for seed in seeds:
        records.append(
            await service.publish_revision(
                actor_id,
                publication=seed.publication,
                workspace_id=seed.workspace_id,
                revision_id=seed.revision_id,
            )
        )
    return records
