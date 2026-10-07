from decimal import Decimal

import pytest
from pydantic import ValidationError
from schemas.curriculum import CurriculumCandidate, LearningProfile, RoadmapRequest
from services.roadmap.workload import normalize_profile, schedule_core, selected_core_topics


def test_duration_without_weekly_capacity_creates_no_schedule(
    small_candidate: CurriculumCandidate,
) -> None:
    profile = normalize_profile(
        RoadmapRequest(
            prompt="Learn beginner drawing through practical exercises",
            duration={"value": 2, "unit": "weeks"},
        )
    )
    assert profile.weekly_minutes is None
    assert schedule_core(small_candidate, profile) == []


def test_long_topic_splits_without_new_identity(
    small_candidate: CurriculumCandidate, small_profile: LearningProfile
) -> None:
    small_candidate.items[-1].estimate_minutes = 450
    profile = small_profile.model_copy(update={"weekly_minutes": 120, "study_weeks": None})
    sessions = schedule_core(small_candidate, profile)
    assert sum(s.minutes for s in sessions if s.topic_id == "t3") == 450
    assert all(
        sum(s.minutes for s in sessions if s.week == w) <= 120 for w in {s.week for s in sessions}
    )
    assert {s.topic_id for s in sessions} == {"t1", "t2", "t3"}


def test_prerequisites_precede_presentation_order(
    small_candidate: CurriculumCandidate, small_profile: LearningProfile
) -> None:
    small_candidate.items[2].order = 9
    small_candidate.items[3].order = 0
    ordered = selected_core_topics(small_candidate)
    assert ordered.index(next(i for i in ordered if i.id == "t1")) < ordered.index(
        next(i for i in ordered if i.id == "t2")
    )
    sessions = schedule_core(small_candidate, small_profile)
    assert [s.topic_id for s in sessions].index("t1") < [s.topic_id for s in sessions].index("t2")


def test_title_and_mixed_background_are_preserved() -> None:
    request = RoadmapRequest(
        title="My own learning plan",
        prompt="Learn AI as a backend developer",
        background="Experienced in Python and distributed systems; new to machine learning.",
        duration={"value": Decimal("1.25"), "unit": "months"},
        hours_per_week=Decimal("2.5"),
    )
    profile = normalize_profile(request)
    assert profile.title == request.title
    assert profile.background == request.background
    assert profile.study_weeks == 5 and profile.weekly_minutes == 150
    assert (
        normalize_profile(
            RoadmapRequest(prompt="Learn careful line drawing", title=" ", background=" ")
        ).title
        is None
    )


@pytest.mark.parametrize(
    "duration",
    [
        {"value": "0.1", "unit": "months"},
        {"value": 105, "unit": "weeks"},
        {"value": 27, "unit": "months"},
        {"value": 0, "unit": "weeks"},
    ],
)
def test_duration_rejects_fractional_weeks_and_out_of_bounds(duration: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        RoadmapRequest(prompt="Learn careful line drawing", duration=duration)


@pytest.mark.parametrize("hours", [0, 0.25, 1.2, 80.5, "NaN", "Infinity"])
def test_weekly_capacity_rejects_invalid_values(hours: object) -> None:
    with pytest.raises(ValidationError):
        RoadmapRequest(prompt="Learn careful line drawing", hours_per_week=hours)


def test_phase_order_precedes_local_topic_order(small_candidate):
    from schemas.curriculum import CurriculumRelationData

    phase = next(i for i in small_candidate.items if i.kind == "phase")
    later = phase.model_copy(update={"id": "later", "order": 1})
    phase.order = 0
    topics = [i for i in small_candidate.items if i.kind == "topic"]
    topics[0].order, topics[1].order, topics[2].order = 0, 1, 0
    small_candidate.items.append(later)
    small_candidate.relations = [r for r in small_candidate.relations if r.kind == "contains"]
    for relation in small_candidate.relations:
        if relation.target_id == topics[2].id:
            relation.source_id = later.id
    root = next(i for i in small_candidate.items if i.kind == "root")
    small_candidate.relations.append(
        CurriculumRelationData(source_id=root.id, target_id=later.id, kind="contains")
    )
    assert [i.id for i in selected_core_topics(small_candidate)] == [i.id for i in topics]
