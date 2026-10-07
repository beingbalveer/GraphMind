from datetime import datetime, timezone
from pathlib import Path

import pytest
from schemas.curriculum import CurriculumCandidate, LearningProfile, RoadmapRequest, SourceData
from services.roadmap.workload import normalize_profile


@pytest.fixture
def small_candidate() -> CurriculumCandidate:
    return CurriculumCandidate.model_validate_json(
        (Path(__file__).parent / "fixtures/intro-curriculum.json").read_text()
    )


@pytest.fixture
def sources() -> list[SourceData]:
    return [
        SourceData(
            id=f"s{i}",
            title=f"Drawing source {i}",
            url=f"https://example.com/drawing-{i}",
            reference_id=None,
            locator="section:practice",
            verified_at=datetime.now(timezone.utc),
            status="inspected",
            access="free",
            kind="article",
            evidence="Practical exercises covering line control, forms and observation.",
            provenance={"testFixture": True},
        )
        for i in (1, 2)
    ]


@pytest.fixture
def small_profile() -> LearningProfile:
    return normalize_profile(
        RoadmapRequest(
            prompt="Learn beginner drawing through short practical exercises",
            hours_per_week=6,
            duration={"value": 2, "unit": "weeks"},
        )
    )
