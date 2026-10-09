import pytest
from pydantic import ValidationError
from schemas.curriculum import (
    ChoiceData,
    CurriculumCandidate,
    CurriculumItemData,
    CurriculumRelationData,
    LearningProfile,
    SourceData,
)
from services.roadmap.validation import validate_curriculum
from services.roadmap.workload import schedule_core, selected_core_topics


def codes(
    candidate: CurriculumCandidate, profile: LearningProfile, sources: list[SourceData]
) -> set[str]:
    return {i.code for i in validate_curriculum(candidate, profile, sources).issues}


def test_shared_prerequisite_counted_once(
    small_candidate: CurriculumCandidate, small_profile: LearningProfile, sources: list[SourceData]
) -> None:
    small_candidate.relations.append(
        CurriculumRelationData(source_id="t1", target_id="t3", kind="prerequisite")
    )
    report = validate_curriculum(small_candidate, small_profile, sources)
    assert report.valid
    assert report.core_minutes == 270 and report.capacity_minutes == 720


@pytest.mark.parametrize(
    ("change", "expected"),
    [
        ("cycle", "PREREQUISITE_CYCLE"),
        ("dangling", "RELATION_ENDPOINT"),
        ("duplicate", "DUPLICATE_ITEM"),
        ("leaf", "TOPIC_INCOMPLETE"),
        ("resource", "RESOURCE_SOURCE"),
        ("single", "RESOURCE_RATIONALE"),
        ("further", "CORE_PREREQUISITE"),
        ("schedule", "SESSION_TOTAL"),
        ("timing", "SESSION_PREREQUISITE"),
        ("unreachable", "CONTAINMENT_UNREACHABLE"),
    ],
)
def test_rejects_invalid_structure_and_evidence(
    change: str,
    expected: str,
    small_candidate: CurriculumCandidate,
    small_profile: LearningProfile,
    sources: list[SourceData],
) -> None:
    c = small_candidate
    if change == "cycle":
        c.relations.append(
            CurriculumRelationData(source_id="t2", target_id="t1", kind="prerequisite")
        )
    elif change == "dangling":
        c.relations.append(
            CurriculumRelationData(source_id="missing", target_id="t1", kind="contains")
        )
    elif change == "duplicate":
        c.items.append(c.items[-1].model_copy())
    elif change == "leaf":
        c.items[-1].exercise = ""
    elif change == "resource":
        c.resources[0].source_id = "invented"
    elif change == "single":
        c.resources = [r for r in c.resources if not (r.topic_id == "t1" and r.source_id == "s2")]
        c.resources[0].rationale = ""
    elif change == "further":
        c.items[2].path = "further"
        c.sessions = schedule_core(c, small_profile)
    elif change == "schedule":
        c.sessions[-1].minutes = 2
    elif change == "timing":
        c.sessions[0], c.sessions[1] = c.sessions[1], c.sessions[0]
    elif change == "unreachable":
        c.relations = [r for r in c.relations if not (r.kind == "contains" and r.target_id == "t3")]
    assert expected in codes(c, small_profile, sources)
    assert not validate_curriculum(c, small_profile, sources).valid


def test_alternatives_do_not_require_every_tool(
    small_candidate: CurriculumCandidate, small_profile: LearningProfile, sources: list[SourceData]
) -> None:
    c = small_candidate
    c.items.append(
        CurriculumItemData(
            id="choice",
            kind="choice",
            title="Choose one drawing tool",
            brief="One tool is enough.",
            order=1,
        )
    )
    c.relations = [
        r for r in c.relations if not (r.kind == "contains" and r.target_id in {"t2", "t3"})
    ]
    c.relations.extend(
        [CurriculumRelationData(source_id="phase", target_id="choice", kind="contains")]
        + [
            CurriculumRelationData(source_id="choice", target_id=t, kind="contains")
            for t in ("t2", "t3")
        ]
    )
    c.choices = [
        ChoiceData(choice_id="choice", selected_id="t2", rationale="Start with the simpler tool.")
    ]
    c.sessions = schedule_core(c, small_profile)
    assert {i.id for i in selected_core_topics(c)} == {"t1", "t2"}
    report = validate_curriculum(c, small_profile, sources)
    assert report.valid and report.core_minutes == 180
    c.relations.append(CurriculumRelationData(source_id="t3", target_id="t2", kind="prerequisite"))
    assert "CORE_PREREQUISITE" in codes(c, small_profile, sources)


def test_container_estimates_are_not_double_counted(
    small_candidate: CurriculumCandidate, small_profile: LearningProfile, sources: list[SourceData]
) -> None:
    small_candidate.items[1].estimate_minutes = 270
    assert validate_curriculum(small_candidate, small_profile, sources).core_minutes == 270


def test_impossible_capacity_is_an_error_and_manual_edit_a_warning(
    small_candidate: CurriculumCandidate, small_profile: LearningProfile, sources: list[SourceData]
) -> None:
    profile = small_profile.model_copy(update={"weekly_minutes": 30, "study_weeks": 1})
    small_candidate.sessions = schedule_core(small_candidate, profile)
    report = validate_curriculum(small_candidate, profile, sources)
    assert not report.valid and "CAPACITY_EXCEEDED" in {i.code for i in report.issues}
    manual = validate_curriculum(small_candidate, profile, sources, manual=True)
    assert manual.valid and all(i.severity == "warning" for i in manual.issues)


@pytest.mark.parametrize(("levels", "valid"), [(6, True), (7, False)])
def test_hierarchy_depth_boundary(
    levels: int,
    valid: bool,
    small_candidate: CurriculumCandidate,
    small_profile: LearningProfile,
    sources: list[SourceData],
) -> None:
    c = small_candidate
    c.relations = [r for r in c.relations if not (r.kind == "contains" and r.source_id == "phase")]
    parent = "phase"
    for n in range(levels - 3):
        gid = f"g{n}"
        c.items.append(
            CurriculumItemData(
                id=gid, kind="group", title="A useful group", brief="Group the exercises.", order=n
            )
        )
        c.relations.append(CurriculumRelationData(source_id=parent, target_id=gid, kind="contains"))
        parent = gid
    c.relations.extend(
        CurriculumRelationData(source_id=parent, target_id=t, kind="contains")
        for t in ("t1", "t2", "t3")
    )
    report = validate_curriculum(c, small_profile, sources)
    assert report.valid == valid
    if not valid:
        assert "HIERARCHY_DEPTH" in {i.code for i in report.issues}


@pytest.mark.parametrize(("count", "valid"), [(240, True), (241, False)])
def test_actionable_topic_limit(
    count: int,
    valid: bool,
    small_candidate: CurriculumCandidate,
    small_profile: LearningProfile,
    sources: list[SourceData],
) -> None:
    c = small_candidate
    for n in range(4, count + 1):
        c.items.append(c.items[2].model_copy(update={"id": f"t{n}", "order": n, "path": "further"}))
        c.relations.append(
            CurriculumRelationData(source_id="phase", target_id=f"t{n}", kind="contains")
        )
        c.resources.extend(
            r.model_copy(update={"topic_id": f"t{n}"}) for r in list(c.resources[:2])
        )
    assert validate_curriculum(c, small_profile, sources).valid == valid


def test_candidate_rejects_extra_model_fields(small_candidate: CurriculumCandidate) -> None:
    with pytest.raises(ValidationError):
        CurriculumCandidate.model_validate(
            {**small_candidate.model_dump(), "publishImmediately": True}
        )


def test_containment_cycle_and_empty_overview_are_rejected(
    small_candidate: CurriculumCandidate, small_profile: LearningProfile, sources: list[SourceData]
) -> None:
    small_candidate.relations.append(
        CurriculumRelationData(source_id="phase", target_id="root", kind="contains")
    )
    assert "CONTAINMENT_CYCLE" in codes(small_candidate, small_profile, sources)
    small_candidate.items.append(
        CurriculumItemData(id="empty", kind="group", title="Empty overview", order=1)
    )
    assert "EMPTY_CONTAINER" in codes(small_candidate, small_profile, sources)


def test_recommended_order_cannot_reverse_a_prerequisite(
    small_candidate: CurriculumCandidate, small_profile: LearningProfile, sources: list[SourceData]
) -> None:
    small_candidate.relations.append(
        CurriculumRelationData(source_id="t2", target_id="t1", kind="recommended_next")
    )
    assert "RECOMMENDED_ORDER" in codes(small_candidate, small_profile, sources)
