from collections import defaultdict, deque
from typing import Literal

from schemas.curriculum import (
    CurriculumCandidate,
    LearningProfile,
    SourceData,
    ValidationIssue,
    ValidationReport,
)
from services.roadmap.workload import WorkloadError, selected_core_topics


def has_cycle(ids: set[str], edges: list[tuple[str, str]]) -> bool:
    counts = dict.fromkeys(ids, 0)
    children: dict[str, set[str]] = defaultdict(set)
    for source, target in edges:
        if source not in ids or target not in ids or target in children[source]:
            continue
        children[source].add(target)
        counts[target] += 1
    ready = deque(key for key, count in counts.items() if not count)
    visited = 0
    while ready:
        key = ready.popleft()
        visited += 1
        for child in children[key]:
            counts[child] -= 1
            if not counts[child]:
                ready.append(child)
    return visited != len(ids)


def validate_curriculum(
    candidate: CurriculumCandidate,
    profile: LearningProfile,
    sources: list[SourceData],
    *,
    manual: bool = False,
) -> ValidationReport:
    issues: list[ValidationIssue] = []

    def issue(
        code: str,
        message: str,
        item_id: str | None = None,
        severity: Literal["error", "warning"] = "error",
    ) -> None:
        issues.append(
            ValidationIssue(code=code, message=message, item_id=item_id, severity=severity)
        )

    capacity_severity: Literal["error", "warning"] = "warning" if manual else "error"
    items = {item.id: item for item in candidate.items}
    ids = set(items)
    if len(items) != len(candidate.items):
        issue("DUPLICATE_ITEM", "Every curriculum item needs a unique identity.")
    roots = [item.id for item in candidate.items if item.kind == "root"]
    if len(roots) != 1:
        issue("ROOT_COUNT", "Use exactly one curriculum root.")
    if len([i for i in candidate.items if i.kind == "topic" and i.participation == "active"]) > 200:
        issue("TOPIC_LIMIT", "Keep the curriculum within 200 actionable topics.")
    if profile.title and candidate.title != profile.title:
        issue("TITLE_CHANGED", "Preserve the learner’s supplied title.")
    children: dict[str, list[str]] = defaultdict(list)
    parents: dict[str, list[str]] = defaultdict(list)
    containment, prerequisites = [], []
    seen_relations: set[tuple[str, str, str]] = set()
    for relation in candidate.relations:
        source, target = relation.source_id, relation.target_id
        relation_key = (source, target, relation.kind)
        if relation_key in seen_relations:
            issue("DUPLICATE_RELATION", "This relationship is listed twice.", target)
        seen_relations.add(relation_key)
        if source not in items or target not in items:
            issue("RELATION_ENDPOINT", "Relationship endpoints must exist.", target)
            continue
        if relation.kind == "contains":
            containment.append((source, target))
            children[source].append(target)
            parents[target].append(source)
            if items[source].kind == "topic" or items[target].kind == "root":
                issue("CONTAINMENT_KIND", "Topics are leaves and the root has no parent.", target)
            if items[source].path == "further" and items[target].path == "core":
                issue(
                    "PATH_INCONSISTENT",
                    "Further-learning groups cannot contain a core topic.",
                    target,
                )
        elif relation.kind == "prerequisite":
            prerequisites.append((source, target))
            if items[source].kind != "topic" or items[target].kind != "topic":
                issue(
                    "PREREQUISITE_KIND", "Express prerequisites between actionable topics.", target
                )
        elif relation.kind == "alternative":
            if items[source].kind != "choice":
                issue("ALTERNATIVE_KIND", "Alternatives belong to a choice group.", source)
    if has_cycle(ids, containment):
        issue("CONTAINMENT_CYCLE", "Containment must form an acyclic rooted hierarchy.")
    if has_cycle(ids, prerequisites):
        issue("PREREQUISITE_CYCLE", "Prerequisites must be acyclic.")
    recommended = [
        (r.source_id, r.target_id) for r in candidate.relations if r.kind == "recommended_next"
    ]
    if has_cycle(ids, prerequisites + recommended):
        issue(
            "RECOMMENDED_ORDER", "Presentation order cannot reverse a prerequisite or form a cycle."
        )
    reachable: set[str] = set()
    queue = deque((root, 1) for root in roots)
    while queue:
        key, depth = queue.popleft()
        if key in reachable:
            continue
        reachable.add(key)
        if depth > 6:
            issue("HIERARCHY_DEPTH", "Use no more than six hierarchy levels.", key)
        queue.extend((child, depth + 1) for child in children[key])
    for item in candidate.items:
        if item.id not in reachable or (item.kind != "root" and not parents[item.id]):
            issue(
                "CONTAINMENT_UNREACHABLE",
                "Every item must belong to the rooted curriculum.",
                item.id,
            )
        if len(parents[item.id]) > 1:
            issue("MULTIPLE_PARENTS", "Use one containment parent per item.", item.id)
        if item.participation != "active":
            continue
        if item.kind == "topic":
            missing = [
                name
                for name, valid in (
                    ("title", bool(item.title.strip())),
                    ("brief", bool(item.brief.strip())),
                    (
                        "objectives",
                        bool(item.objectives)
                        and all(objective.strip() for objective in item.objectives),
                    ),
                    ("exercise", bool(item.exercise and item.exercise.strip())),
                    ("estimateMinutes", bool(item.estimate_minutes and item.estimate_minutes > 0)),
                    ("format", bool(item.format)),
                )
                if not valid
            ]
            if missing:
                issue(
                    "TOPIC_INCOMPLETE",
                    "Provide nonempty topic fields: " + ", ".join(missing) + ".",
                    item.id,
                )
        elif not children[item.id]:
            issue("EMPTY_CONTAINER", "Overview groups need actionable descendants.", item.id)
    selections = {selection.choice_id: selection for selection in candidate.choices}
    if len(selections) != len(candidate.choices):
        issue("DUPLICATE_CHOICE", "Choose one recommendation per choice group.")
    for selection in candidate.choices:
        choice = items.get(selection.choice_id)
        if (
            not choice
            or choice.kind != "choice"
            or selection.selected_id not in children[selection.choice_id]
            or items[selection.selected_id].participation != "active"
            or not selection.rationale.strip()
        ):
            issue(
                "CHOICE_INVALID",
                "Select an active member of this choice group with a rationale.",
                selection.choice_id,
            )
    for item in candidate.items:
        if item.kind == "choice" and item.participation == "active" and item.id not in selections:
            issue("CHOICE_REQUIRED", "Recommend one alternative for this choice group.", item.id)
    for relation in candidate.relations:
        if (
            relation.kind == "alternative"
            and relation.target_id not in children[relation.source_id]
        ):
            issue(
                "ALTERNATIVE_MEMBER",
                "An alternative must also belong to its choice group.",
                relation.target_id,
            )
    try:
        core = selected_core_topics(candidate)
    except WorkloadError:
        core = []
    core_ids = {item.id for item in core}
    if not core_ids:
        issue("CORE_EMPTY", "Provide a realistic actionable core path.")
    for source, target in prerequisites:
        if target in core_ids and source not in core_ids:
            issue(
                "CORE_PREREQUISITE",
                "Core topics cannot depend on further or unselected topics.",
                target,
            )
    source_map = {source.id: source for source in sources}
    if len(source_map) != len(sources):
        issue("DUPLICATE_SOURCE", "Source identities must be unique.")
    resources: dict[str, list[str]] = defaultdict(list)
    for resource in candidate.resources:
        topic, resource_source = items.get(resource.topic_id), source_map.get(resource.source_id)
        if not topic or topic.kind != "topic":
            issue(
                "RESOURCE_TOPIC", "Associate resources with actionable topics.", resource.topic_id
            )
        if (
            not resource_source
            or resource_source.status not in {"inspected", "grounded"}
            or not resource_source.evidence.strip()
            or not (resource_source.url or resource_source.reference_id)
        ):
            issue(
                "RESOURCE_SOURCE",
                "Use recorded inspected or grounded source evidence.",
                resource.topic_id,
            )
        if resource.source_id in resources[resource.topic_id]:
            issue("RESOURCE_DUPLICATE", "Do not repeat a source for one topic.", resource.topic_id)
        resources[resource.topic_id].append(resource.source_id)
        if not resource.rationale.strip():
            issue(
                "RESOURCE_RATIONALE",
                "Explain why this source supports the topic.",
                resource.topic_id,
            )
    for item in candidate.items:
        if item.kind != "topic" or item.participation != "active":
            continue
        if not 1 <= len(resources[item.id]) <= 3:
            issue(
                "RESOURCE_COUNT",
                "Curate one to three qualified resources per topic, normally two.",
                item.id,
            )
        if len(resources[item.id]) == 1:
            rationale = next(
                (r.rationale for r in candidate.resources if r.topic_id == item.id), ""
            )
            if len(rationale.strip()) < 20:
                issue(
                    "RESOURCE_RATIONALE",
                    "Record a meaningful rationale when one source is sufficient.",
                    item.id,
                )
    core_minutes = sum(item.estimate_minutes or 0 for item in core)
    capacity = (
        profile.study_weeks * profile.weekly_minutes
        if profile.study_weeks is not None and profile.weekly_minutes is not None
        else None
    )
    if capacity is not None and core_minutes > capacity:
        issue(
            "CAPACITY_EXCEEDED",
            "Narrow the core outcome or increase the study budget.",
            severity=capacity_severity,
        )
    if profile.weekly_minutes is None:
        if candidate.sessions:
            issue(
                "SESSION_CAPACITY_UNKNOWN",
                "Leave weekly pacing unassigned until hours per week are known.",
            )
    else:
        totals: dict[str, int] = defaultdict(int)
        weekly: dict[int, int] = defaultdict(int)
        first: dict[str, tuple[int, int]] = {}
        last: dict[str, tuple[int, int]] = {}
        sequences: dict[str, list[int]] = defaultdict(list)
        previous_week = 0
        for index, session in enumerate(candidate.sessions):
            if session.topic_id not in core_ids:
                issue("SESSION_TOPIC", "Schedule only the selected core path.", session.topic_id)
            if session.week < previous_week:
                issue("SESSION_ORDER", "List weekly sessions in study order.", session.topic_id)
            previous_week = session.week
            totals[session.topic_id] += session.minutes
            weekly[session.week] += session.minutes
            sequences[session.topic_id].append(session.sequence)
            first.setdefault(session.topic_id, (session.week, index))
            last[session.topic_id] = (session.week, index)
        for item in core:
            if totals[item.id] != item.estimate_minutes:
                issue("SESSION_TOTAL", "Scheduled effort must equal the topic estimate.", item.id)
            if sequences[item.id] != list(range(len(sequences[item.id]))):
                issue("SESSION_SEQUENCE", "Number split sessions consecutively per topic.", item.id)
        if any(minutes > profile.weekly_minutes for minutes in weekly.values()):
            issue(
                "WEEKLY_CAPACITY",
                "A study week exceeds the stated weekly capacity.",
                severity=capacity_severity,
            )
        if profile.study_weeks is not None and any(week > profile.study_weeks for week in weekly):
            issue(
                "SESSION_DURATION",
                "The assigned schedule exceeds the target duration.",
                severity=capacity_severity,
            )
        for source, target in prerequisites:
            if source in last and target in first and last[source] >= first[target]:
                issue(
                    "SESSION_PREREQUISITE",
                    "Finish prerequisite sessions before dependent sessions.",
                    target,
                )
    return ValidationReport(
        valid=not any(i.severity == "error" for i in issues),
        issues=issues,
        core_minutes=core_minutes,
        capacity_minutes=capacity,
    )
