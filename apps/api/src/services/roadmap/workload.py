import heapq

from schemas.curriculum import (
    CurriculumCandidate,
    CurriculumItemData,
    LearningProfile,
    RoadmapRequest,
    WeeklySession,
)


class WorkloadError(ValueError):
    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


def normalize_profile(request: RoadmapRequest) -> LearningProfile:
    weeks = (
        request.duration.value * (4 if request.duration.unit == "months" else 1)
        if request.duration
        else None
    )
    return LearningProfile(
        **request.model_dump(),
        study_weeks=int(weeks) if weeks is not None else None,
        weekly_minutes=int(request.hours_per_week * 60)
        if request.hours_per_week is not None
        else None,
        outcome=request.prompt,
    )


def selected_core_topics(candidate: CurriculumCandidate) -> list[CurriculumItemData]:
    items = {i.id: i for i in candidate.items}
    parents = {r.target_id: r.source_id for r in candidate.relations if r.kind == "contains"}
    choices = {c.choice_id: c.selected_id for c in candidate.choices}

    def included(item: CurriculumItemData) -> bool:
        visited: set[str] = set()
        current: CurriculumItemData | None = item
        while current:
            if current.id in visited or current.path != "core" or current.participation != "active":
                return False
            visited.add(current.id)
            parent = items.get(parents.get(current.id, ""))
            if parent and parent.kind == "choice" and choices.get(parent.id) != current.id:
                return False
            current = parent
        return True

    topics = {i.id: i for i in candidate.items if i.kind == "topic" and included(i)}
    incoming = {key: 0 for key in topics}
    outgoing: dict[str, set[str]] = {key: set() for key in topics}
    for relation in candidate.relations:
        if (
            relation.kind not in {"prerequisite", "recommended_next"}
            or relation.source_id not in topics
            or relation.target_id not in topics
        ):
            continue
        if relation.target_id not in outgoing[relation.source_id]:
            outgoing[relation.source_id].add(relation.target_id)
            incoming[relation.target_id] += 1
    ready = [(topics[key].order, key) for key, count in incoming.items() if not count]
    heapq.heapify(ready)
    result = []
    while ready:
        _, key = heapq.heappop(ready)
        result.append(topics[key])
        for target in sorted(outgoing[key]):
            incoming[target] -= 1
            if not incoming[target]:
                heapq.heappush(ready, (topics[target].order, target))
    if len(result) != len(topics):
        raise WorkloadError("ORDER_CYCLE")
    return result


def schedule_core(candidate: CurriculumCandidate, profile: LearningProfile) -> list[WeeklySession]:
    if profile.weekly_minutes is None:
        return []
    if profile.weekly_minutes < 1:
        raise WorkloadError("INVALID_WEEKLY_CAPACITY")
    sessions: list[WeeklySession] = []
    week, used = 1, 0
    for topic in selected_core_topics(candidate):
        remaining = topic.estimate_minutes or 0
        sequence = 0
        while remaining:
            if len(sessions) >= 10000:
                raise WorkloadError("SCHEDULE_LIMIT")
            available = profile.weekly_minutes - used
            if not available:
                week, used = week + 1, 0
                available = profile.weekly_minutes
            minutes = min(remaining, available)
            sessions.append(
                WeeklySession(week=week, topic_id=topic.id, sequence=sequence, minutes=minutes)
            )
            remaining, used, sequence = remaining - minutes, used + minutes, sequence + 1
    return sessions
