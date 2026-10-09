"""Coverage is independent of pacing: selecting a core never deletes the subject map."""

import re
import unicodedata
from typing import TYPE_CHECKING, Any

from models.roadmap import new_id
from schemas.curriculum import (
    ChoiceData,
    CurriculumCandidate,
    CurriculumItemData,
    CurriculumRelationData,
    SourceData,
)
from schemas.roadmap_job import CoverageTopic
from services.roadmap.validation import has_cycle

if TYPE_CHECKING:
    from schemas.roadmap_job import JobCheckpoint
    from services.roadmap.prompts import CoverageRepair, EvidenceReview, ResearchReview


def reference_coverage_issues(
    review: "ResearchReview | CoverageRepair | JobCheckpoint", sources: list[SourceData]
) -> list[str]:
    diagrams = {
        s.id: labels
        for s in sources
        if isinstance(labels := s.provenance.get("diagramLabels"), list)
        and labels
        and s.status in {"grounded", "inspected"}
    }
    topics = {t.id for t in review.coverage_topics}
    seen: set[tuple[str, int]] = set()
    concepts: dict[str, set[str]] = {}
    issues = []
    for disposition in review.reference_dispositions:
        key = (disposition.source_id, disposition.label_index)
        labels = diagrams.get(disposition.source_id, [])
        if key in seen or disposition.label_index >= len(labels):
            issues.append("Use each actual diagram sourceId/labelIndex once; do not invent labels.")
            continue
        seen.add(key)
        if not set(disposition.topic_ids).issubset(topics) or (
            disposition.kind in {"concept", "example", "synonym"} and not disposition.topic_ids
        ):
            issues.append(
                f"[MISSING_REFERENCE] {labels[disposition.label_index]}: {disposition.reason}. Add its distinct actionable competency to coverageTopics, then map it to that actual topic ID."
            )
            continue
        if disposition.kind == "concept":
            label = " ".join(str(labels[disposition.label_index]).casefold().split())
            for topic in disposition.topic_ids:
                concepts.setdefault(topic, set()).add(label)
    missing = [
        (source, index)
        for source, labels in diagrams.items()
        for index in range(len(labels))
        if (source, index) not in seen
    ]
    if missing:
        issues.append(
            f"Missing reference dispositions for {len(missing)} labels. Account for every diagramLabels index, including examples/headers/exclusions. First missing: {missing[:12]}."
        )
    for topic, concept_names in concepts.items():
        if len(concept_names) > 1:
            issues.append(
                f"[MERGED_REFERENCE] {topic}: Create separate actionable topics for distinct concepts {sorted(concept_names)}. Only genuinely synonymous labels may share a lesson using kind=synonym."
            )
    return issues


def evidence_review_issues(review: "EvidenceReview", checks: list[dict[str, Any]]) -> list[str]:
    expected = {check["checkId"]: check for check in checks}
    returned = [verdict.check_id for verdict in review.verdicts]
    if len(returned) != len(expected) or set(returned) != set(expected):
        return [
            "Return exactly one independent verdict per requested checkId; no missing or duplicate checks."
        ]
    return [
        f"[EVIDENCE_REVIEW] {expected[v.check_id].get('topicId', v.check_id)}: {v.reason}"
        for v in review.verdicts
        if not v.approved
    ]


def resource_grounding_issues(
    candidate: CurriculumCandidate, sources: list[SourceData], topic_ids: set[str] | None = None
) -> list[str]:
    actual = {s.id: s for s in sources if s.status in {"grounded", "inspected"}}
    issues = []

    def normalized(text: str) -> str:
        return " ".join(unicodedata.normalize("NFKC", text).split())

    for topic in candidate.items:
        if (
            topic.kind != "topic"
            or topic.participation != "active"
            or (topic_ids is not None and topic.id not in topic_ids)
        ):
            continue
        resources = [r for r in candidate.resources if r.topic_id == topic.id]
        problem = "Provide at least one recorded instructional resource" if not resources else None
        for resource in resources:
            source = actual.get(resource.source_id)
            excerpt = resource.evidence_excerpt or ""
            if (
                source is None
                or not excerpt
                or resource.objective_index is None
                or resource.objective_index >= len(topic.objectives)
            ):
                problem = "Provide an exact 80–500 character evidenceExcerpt and valid zero-based objectiveIndex for each actual instructional source"
                break
            pattern = r"\s+".join(re.escape(token) for token in normalized(excerpt).split())
            passage = re.search(pattern, unicodedata.normalize("NFKC", source.evidence))
            if passage is None:
                problem = "Copy evidenceExcerpt exactly from recorded source evidence; do not invent instructional passages"
                break
            lines = [line for line in source.evidence.splitlines() if line.strip()]
            label_only = (
                bool(source.provenance.get("diagramLabels"))
                or "roadmap" in source.title.casefold()
                or "[Diagram labels" in source.evidence
            ) or (
                source.reference_id is not None
                and len(lines) >= 25
                and sum(len(line.split()) <= 6 for line in lines) / len(lines) >= 0.85
            )
            if label_only:
                problem = "Diagram labels are coverage evidence, not instruction. Find an actual teaching passage for the objective and practical exercise"
                break
        if problem:
            issues.append(f"[RESOURCE_GROUNDING] {topic.id}: {problem}.")
    return issues


def outline_issues(relations: list[CurriculumRelationData], topic_ids: set[str]) -> list[str]:
    if any(
        r.kind not in {"prerequisite", "recommended_next"}
        or r.source_id not in topic_ids
        or r.target_id not in topic_ids
        for r in relations
    ):
        return [
            "Plan only prerequisite or recommended_next edges between exact coverageTopics IDs."
        ]
    edges = [(r.source_id, r.target_id) for r in relations]
    if has_cycle(topic_ids, edges):
        return [
            "The combined prerequisite and recommended_next order contains a cycle. "
            "sourceId must be learned BEFORE targetId. Remove presentation edges that reverse "
            "a required prerequisite. Return a complete acyclic replacement plan."
        ]
    if len(set(edges)) != len(edges):
        return [
            "Keep each ordered topic pair once; do not duplicate prerequisites as presentation edges."
        ]
    return []


def sanitize_outline_relations(
    relations: list[CurriculumRelationData], topic_ids: set[str]
) -> list[CurriculumRelationData]:
    """Keep only useful, safe optional links between researched topic handles."""
    accepted: list[CurriculumRelationData] = []
    edges: set[tuple[str, str]] = set()
    for relation in relations:
        edge = (relation.source_id, relation.target_id)
        if (
            relation.kind not in {"prerequisite", "recommended_next"}
            or relation.source_id not in topic_ids
            or relation.target_id not in topic_ids
            or relation.source_id == relation.target_id
            or edge in edges
        ):
            continue
        if has_cycle(topic_ids, [*edges, edge]):
            continue
        accepted.append(relation)
        edges.add(edge)
    return accepted


def inventory_candidate(
    title: str,
    outcome: str,
    inventory: list[CoverageTopic],
    relations: list[CurriculumRelationData],
    assumptions: list[str],
    original: CurriculumCandidate | None = None,
) -> CurriculumCandidate:
    """The researched inventory owns topic identity; the model plans relationships only."""
    existing = {i.id: i for i in original.items} if original else {}
    root = next(
        (i.model_copy(deep=True) for i in existing.values() if i.kind == "root"),
        CurriculumItemData(id=new_id("root"), kind="root", title=title, order=0),
    )
    root.title, root.path, root.participation = title, "core", "active"
    items = [root]
    links: list[CurriculumRelationData] = []
    phases: dict[str, str] = {}
    # Refinement retains existing hierarchy, selected routes and archived history.
    # New concepts are added under researched areas without flattening old choices.
    if original:
        items.extend(i.model_copy(deep=True) for i in original.items if i.kind != "root")
        links.extend(
            r.model_copy(deep=True)
            for r in original.relations
            if r.kind in {"contains", "alternative"}
        )
        phases = {i.title: i.id for i in items if i.kind == "phase"}
    indexed = {i.id: i for i in items}
    researched = {t.id for t in inventory}
    for item in items:
        if item.kind == "topic" and item.id not in researched:
            item.participation = "archived"
    for topic in inventory:
        if topic.id in indexed:
            item = indexed[topic.id]
            if item.kind != "topic":
                raise ValueError("Coverage topic identity conflicts with an existing container")
            item.title, item.participation = topic.title, "active"
            continue
        if topic.area not in phases:
            phase = CurriculumItemData(
                id=new_id("phase"), kind="phase", title=topic.area, order=len(phases)
            )
            phases[topic.area] = phase.id
            items.append(phase)
            links.append(
                CurriculumRelationData(source_id=root.id, target_id=phase.id, kind="contains")
            )
        item = CurriculumItemData(id=topic.id, kind="topic", title=topic.title, order=len(items))
        items.append(item)
        indexed[item.id] = item
        links.append(
            CurriculumRelationData(
                source_id=phases[topic.area], target_id=topic.id, kind="contains"
            )
        )
    indexed = {i.id: i for i in items}
    parents = {r.target_id: r.source_id for r in links if r.kind == "contains"}
    live = {i.id for i in items if i.kind == "topic" and i.participation == "active"}
    for key in list(live):
        seen = {key}
        while parent := parents.get(key):
            if parent in seen:
                raise ValueError("Curriculum containment cycle")
            live.add(parent)
            seen.add(parent)
            key = parent
    for item in items:
        if item.kind not in {"topic", "root"}:
            item.participation = "active" if item.id in live else "archived"
    choices = []
    for choice in original.choices if original else []:
        members = sorted(
            (i for i in items if parents.get(i.id) == choice.choice_id and i.id in live),
            key=lambda i: (i.order, i.id),
        )
        if not members:
            continue
        if choice.selected_id in {i.id for i in members}:
            choices.append(choice.model_copy(deep=True))
        else:
            choices.append(
                ChoiceData(
                    choice_id=choice.choice_id,
                    selected_id=members[0].id,
                    rationale="The previously recommended route was removed. Start with this remaining active alternative; the other available routes remain visible.",
                )
            )
    return CurriculumCandidate(
        title=title,
        outcome=outcome,
        assumptions=assumptions,
        items=items,
        relations=links + relations,
        choices=choices,
        resources=[r.model_copy(deep=True) for r in original.resources] if original else [],
    )


def coverage_issues(candidate: CurriculumCandidate, inventory: list[CoverageTopic]) -> list[str]:
    present = {i.id for i in candidate.items if i.kind == "topic" and i.participation == "active"}
    return [
        f"[MISSING_COVERAGE] {topic.id}: Include {topic.area} / {topic.title} as an actionable core or further-learning topic."
        for topic in inventory
        if topic.id not in present
    ]


def select_core(
    candidate: CurriculumCandidate, ids: list[str], outcome: str, assumptions: list[str]
) -> CurriculumCandidate:
    result = candidate.model_copy(deep=True)
    topics = {i.id for i in result.items if i.kind == "topic" and i.participation == "active"}
    selected = set(ids)
    if not selected or not selected.issubset(topics):
        raise ValueError("Unknown or empty core topic selection")
    missing = []
    for relation in result.relations:
        if (
            relation.kind == "prerequisite"
            and relation.target_id in selected
            and relation.source_id not in selected
        ):
            missing.append(f"{relation.source_id} required before {relation.target_id}")
    if missing:
        raise ValueError(
            "Missing prerequisites: "
            + "; ".join(missing)
            + ". Include these and their prerequisites, or move dependent topics to further learning."
        )
    parents = {r.target_id: r.source_id for r in result.relations if r.kind == "contains"}
    choices = {c.choice_id: c.selected_id for c in result.choices}
    ancestors = set(selected)
    for topic in selected:
        current = topic
        seen = {current}
        while parent := parents.get(current):
            if parent in seen:
                raise ValueError("Curriculum containment cycle")
            if parent in choices and choices[parent] != current:
                raise ValueError("Core topic belongs to an unselected route")
            ancestors.add(parent)
            seen.add(parent)
            current = parent
    for item in result.items:
        item.path = "core" if item.id in ancestors or item.kind == "root" else "further"
    result.outcome = outcome
    result.assumptions = list(dict.fromkeys([*result.assumptions, *assumptions]))[:30]
    result.sessions = []
    return result
