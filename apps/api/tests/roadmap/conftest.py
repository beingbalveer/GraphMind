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
    try:
        yield SimpleNamespace(view=view, owner_id=owner_id, session=curriculum_session)
    finally:
        from models.workspace import Workspace
        from sqlalchemy import delete

        await curriculum_session.rollback()
        await curriculum_session.execute(delete(Workspace).where(Workspace.id == ws.id))
        await curriculum_session.commit()


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


class ScriptedStageExecutor:
    def __init__(self, results):
        import asyncio

        self.results = results
        self.calls = []
        self.block_stage = None
        self.started = asyncio.Event()
        self.release = asyncio.Event()
        self.failure = None

    async def run(self, stage, job, claim):
        self.calls.append(stage)
        if stage == self.block_stage:
            self.started.set()
            await self.release.wait()
        if self.failure is not None:
            raise self.failure
        return self.results[stage].model_copy(deep=True)


@pytest.fixture
def scripted_executor(small_profile, small_candidate, sources):
    from schemas.roadmap_job import JobCheckpoint, StageResult
    from services.roadmap.validation import validate_curriculum

    checkpoint = JobCheckpoint(
        profile=small_profile,
        candidate=small_candidate,
        sources=sources,
        validation=validate_curriculum(small_candidate, small_profile, sources),
    )
    return ScriptedStageExecutor(
        {
            stage: StageResult(checkpoint=checkpoint, summary=f"{stage} finished")
            for stage in ["understand", "research", "compose", "personalize", "validate"]
        }
    )


@pytest.fixture
def publication(curriculum_session, clock):
    from services.roadmap.publication import PublicationService

    return PublicationService(curriculum_session, clock=clock.now)


@pytest.fixture
async def publish_claim(job_repo, ready_job, clock, scripted_executor):
    for stage in ["understand", "research", "compose", "personalize", "validate"]:
        claim = await job_repo.claim("test-worker", clock.now())
        await job_repo.checkpoint(claim, stage, scripted_executor.results[stage])
    return await job_repo.claim("test-worker", clock.now())


@pytest.fixture
async def worker_job(ready_job, curriculum_session):
    from models.roadmap_job import RoadmapJob
    from models.user import User
    from models.workspace import Workspace
    from sqlalchemy import delete

    await curriculum_session.commit()
    try:
        yield ready_job
    finally:
        await curriculum_session.rollback()
        await curriculum_session.execute(
            delete(Workspace).where(Workspace.owner_id == ready_job.owner_id)
        )
        await curriculum_session.execute(
            delete(RoadmapJob).where(RoadmapJob.owner_id == ready_job.owner_id)
        )
        await curriculum_session.execute(delete(User).where(User.id == ready_job.owner_id))
        await curriculum_session.commit()


@pytest.fixture
def worker(scripted_executor, clock):
    from database import get_session_factory
    from services.roadmap.worker import RoadmapWorker

    return RoadmapWorker(
        get_session_factory(), scripted_executor, clock=clock.now, heartbeat_interval=0.01
    )


@pytest.fixture
async def auth_client(worker_job):
    from httpx import ASGITransport, AsyncClient
    from main import app
    from services.auth_service import create_access_token

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        cookies={"access_token": create_access_token(worker_job.owner_id)},
    ) as client:
        yield client


@pytest.fixture
async def executor_setup(worker_job, clock):
    from contextlib import asynccontextmanager
    from unittest.mock import AsyncMock

    from ai_core.base import ModelConfig
    from database import get_session_factory
    from services.roadmap.job_repository import JobRepository
    from services.roadmap.orchestrator import RoadmapStageExecutor

    @asynccontextmanager
    async def repos():
        async with get_session_factory()() as session:
            yield JobRepository(session, clock=clock.now)
            await session.commit()

    provider = AsyncMock()
    executor = RoadmapStageExecutor(
        provider, ModelConfig(model_name="test"), lambda job, claim: {}, repos
    )
    async with repos() as repo:
        claim = await repo.claim("stage-test", clock.now())
        job = await repo.read(worker_job.id, worker_job.owner_id)
    return executor, provider, claim, job, repos
