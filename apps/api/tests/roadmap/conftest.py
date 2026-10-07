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


@pytest.fixture(autouse=True)
def no_embedding_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    from unittest.mock import AsyncMock

    monkeypatch.setattr(
        "services.semantic_service.SemanticService.compute_and_save_node_embedding", AsyncMock()
    )


@pytest.fixture
async def curriculum_session():
    from database import get_session_factory

    async with get_session_factory()() as session:
        try:
            yield session
        finally:
            await session.rollback()


@pytest.fixture
async def repository(curriculum_session):
    from services.roadmap.curriculum_repository import CurriculumRepository

    return CurriculumRepository(curriculum_session)


@pytest.fixture
async def curriculum_workspace(
    repository, curriculum_session, small_candidate, small_profile, sources
):
    import uuid
    from types import SimpleNamespace

    from schemas.workspace import NodeCreate, WorkspaceCreate
    from services.roadmap.validation import validate_curriculum
    from services.workspace_service import WorkspaceService

    owner_id = "usr_default_admin"
    ws = await WorkspaceService.create_workspace(
        curriculum_session, WorkspaceCreate(name="Curriculum test"), owner_id=owner_id
    )
    anchor = await WorkspaceService.add_node_and_edge(
        curriculum_session,
        ws.id,
        NodeCreate(
            id=f"node_{uuid.uuid4().hex[:12]}", role="user", content="Roadmap canvas anchor"
        ),
    )
    view = await repository.create(
        owner_id,
        ws.id,
        anchor.id,
        small_profile,
        small_candidate,
        sources,
        validate_curriculum(small_candidate, small_profile, sources),
    )
    return SimpleNamespace(view=view, owner_id=owner_id, session=curriculum_session)


class TestClock:
    __test__ = False

    def __init__(self):
        self.value = datetime.now(timezone.utc)

    def now(self):
        return self.value

    def advance(self, *, seconds):
        from datetime import timedelta

        self.value += timedelta(seconds=seconds)


@pytest.fixture
def clock():
    return TestClock()


@pytest.fixture
async def job_owner(curriculum_session):
    import uuid

    from models.user import User

    owner = User(
        id=f"usr_{uuid.uuid4().hex[:12]}",
        email=f"{uuid.uuid4().hex}@example.com",
        full_name="Job test owner",
        provider="local",
    )
    curriculum_session.add(owner)
    await curriculum_session.flush()
    return owner.id


@pytest.fixture
async def job_repo(curriculum_session, clock):
    from services.roadmap.job_repository import JobRepository

    return JobRepository(curriculum_session, clock=clock.now)


@pytest.fixture
async def ready_job(job_repo, job_owner):
    import uuid

    job = await job_repo.create(
        job_owner, RoadmapRequest(prompt="Learn practical beginner drawing"), str(uuid.uuid4())
    )
    return await job_repo.start(job.id, job_owner)
