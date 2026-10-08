"""Release journeys use real HTTP, storage, worker, tools and publication boundaries."""

import asyncio
import json
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import httpx
from ai_core.base import GenerationResult, ModelConfig, ToolCall
from database import get_session_factory
from services.roadmap.job_repository import JobRepository
from services.roadmap.orchestrator import RoadmapStageExecutor
from services.roadmap.references import ReferenceService
from services.roadmap.search import SearchResponse, SearchResult
from services.roadmap.source_fetcher import SourceFetcher
from services.roadmap.tools import RoadmapToolContext, build_roadmap_tools
from services.roadmap.worker import RoadmapWorker
from services.skill_service import SkillRegistry


async def test_http_cancel_discards_late_agent_result_without_publication(
    auth_client, worker, worker_job, scripted_executor
):
    from models.workspace import Workspace
    from sqlalchemy import func, select

    scripted_executor.block_stage = "understand"
    running = asyncio.create_task(worker.run_once("late-result-worker"))
    await asyncio.wait_for(scripted_executor.started.wait(), 2)
    response = await auth_client.post(f"/api/v1/roadmap/jobs/{worker_job.id}/cancel")
    assert response.status_code == 200
    scripted_executor.release.set()
    await asyncio.wait_for(running, 2)
    snapshot = (await auth_client.get(f"/api/v1/roadmap/jobs/{worker_job.id}")).json()
    assert snapshot["status"] == "canceled" and snapshot["result"] is None
    async with get_session_factory()() as session:
        assert (
            await session.scalar(
                select(func.count())
                .select_from(Workspace)
                .where(Workspace.owner_id == worker_job.owner_id)
            )
            == 0
        )


async def test_researched_http_journey_survives_restart_and_preserves_learning(
    auth_client, worker_job, small_candidate, small_profile, tmp_path, monkeypatch
):
    from config import get_settings

    monkeypatch.setattr(get_settings(), "ROADMAP_REFERENCE_DIR", str(tmp_path))
    # The common authenticated fixture has an active job; retire that test reservation.
    assert (
        await auth_client.post(f"/api/v1/roadmap/jobs/{worker_job.id}/cancel")
    ).status_code == 200
    request = small_profile.model_dump(mode="json", by_alias=True)
    request = {key: request[key] for key in ("prompt", "level", "duration", "hoursPerWeek")}
    key = str(uuid.uuid4())
    headers = {"Idempotency-Key": key}
    first = await auth_client.post("/api/v1/roadmap/jobs", json=request, headers=headers)
    repeated = await auth_client.post("/api/v1/roadmap/jobs", json=request, headers=headers)
    assert first.status_code == repeated.status_code == 202
    job_id = first.json()["id"]
    assert repeated.json()["id"] == job_id
    reference = await auth_client.post(
        f"/api/v1/roadmap/jobs/{job_id}/references",
        files={
            "file": (
                "goals.txt",
                b"Practice observing and drawing household objects.",
                "text/plain",
            )
        },
    )
    assert reference.status_code == 201
    assert (await auth_client.post(f"/api/v1/roadmap/jobs/{job_id}/start")).status_code == 200

    @asynccontextmanager
    async def repositories():
        async with get_session_factory()() as session:
            yield JobRepository(session)
            await session.commit()

    class SearchTransport:
        calls = 0

        def require_configured(self):
            pass

        async def search(self, query):
            self.calls += 1
            return SearchResponse(
                results=[
                    SearchResult(
                        title=f"Drawing practice {index}",
                        url=f"https://example.com/drawing-{index}",
                        snippet="Practical observation, line control and shapes.",
                        provenance={"supported": True, "testFixture": True},
                    )
                    for index in (1, 2)
                ],
                queries=[query],
                attribution_html=None,
                provider="scripted-source-transport",
                searched_at=datetime.now(timezone.utc),
            )

    search = SearchTransport()

    async def resolve(host, port):
        return ["93.184.216.34"]

    fetcher = SourceFetcher(
        resolver=resolve,
        transport_factory=lambda host, address: httpx.MockTransport(
            lambda request: httpx.Response(
                200,
                headers={"Content-Type": "text/html"},
                text=f"<title>{request.url.path}</title><h1>Practice drawing</h1><p>Observe shapes, practice line control and review a still life.</p>",
            )
        ),
    )
    context = None
    researched = False
    asked = False

    def tool_factory(job, claim):
        nonlocal context
        context = RoadmapToolContext(
            job.id,
            job.owner_id,
            claim,
            job.checkpoint.profile,
            job.checkpoint,
            get_session_factory(),
            lambda session: ReferenceService(session, tmp_path),
            fetcher,
            search,
            SkillRegistry(scope="roadmap"),
        )
        return build_roadmap_tools(context)

    async def generate(*args, **kwargs):
        nonlocal researched, asked
        stage = context.claim.stage
        if stage == "understand" and not asked:
            asked = True
            output = {
                "question": {
                    "id": "outcome",
                    "text": "Which practical outcome?",
                    "suggestions": ["Still life", "Portrait"],
                }
            }
        elif stage == "understand":
            output = {"profile": small_profile.model_dump(mode="json", by_alias=True)}
        elif stage == "research" and not researched:
            researched = True
            return GenerationResult(
                model_name="scripted",
                content="",
                tool_calls=[
                    ToolCall(
                        id="search",
                        name="search_web",
                        arguments={"query": "beginner drawing curriculum"},
                    ),
                    ToolCall(
                        id="fetch-1",
                        name="fetch_source",
                        arguments={"url": "https://example.com/drawing-1"},
                    ),
                    ToolCall(
                        id="fetch-2",
                        name="fetch_source",
                        arguments={"url": "https://example.com/drawing-2"},
                    ),
                ],
            )
        elif stage == "research":
            output = {
                "sourceIds": [source.id for source in context.checkpoint.sources if source.url],
                "coverageNotes": ["Compared observed drawing and deliberate practice."],
            }
        elif stage in ("compose", "personalize"):
            candidate = small_candidate.model_copy(deep=True)
            inspected = [
                source.id
                for source in context.checkpoint.sources
                if source.url and source.status == "inspected"
            ]
            mapping = dict(zip(("s1", "s2"), inspected, strict=True))
            for resource in candidate.resources:
                resource.source_id = mapping[resource.source_id]
            output = candidate.model_dump(mode="json", by_alias=True)
        else:
            output = {"approved": True, "issues": []}
        return GenerationResult(model_name="scripted", content=json.dumps(output))

    provider = AsyncMock()
    provider.generate.side_effect = generate
    executor = RoadmapStageExecutor(
        provider, ModelConfig(model_name="scripted"), tool_factory, repositories
    )
    worker = RoadmapWorker(get_session_factory(), executor, heartbeat_interval=0.01)
    assert await worker.run_once("first-worker")
    waiting = (await auth_client.get(f"/api/v1/roadmap/jobs/{job_id}")).json()
    assert waiting["status"] == "awaiting_input"
    assert (
        await auth_client.post(
            f"/api/v1/roadmap/jobs/{job_id}/answers",
            json={"questionId": "outcome", "answer": "Complete an observed still life"},
        )
    ).status_code == 200
    assert await worker.run_once("first-worker")
    assert await worker.run_once("first-worker")
    async with repositories() as repo:
        saved = await repo.read(job_id, worker_job.owner_id)
        assert saved.stage == "compose" and saved.usage.searches == 1
    # Reconnecting a client and constructing a new worker must reuse researched receipts.
    restarted = RoadmapWorker(get_session_factory(), executor, heartbeat_interval=0.01)
    for _ in range(4):
        assert await restarted.run_once("restarted-worker")
    ready = (await auth_client.get(f"/api/v1/roadmap/jobs/{job_id}")).json()
    assert ready["status"] == "completed" and search.calls == 1
    events = await auth_client.get(f"/api/v1/roadmap/jobs/{job_id}/events?after=3")
    assert events.status_code == 200 and "id: 3\n" not in events.text
    assert "stage_completed" in events.text and "checkpoint" not in events.text
    wid = ready["result"]["workspaceId"]
    root = f"/api/v1/workspaces/{wid}/roadmap"
    view = (await auth_client.get(root)).json()
    phase = next(item["id"] for item in view["candidate"]["items"] if item["kind"] == "phase")
    topic = next(item["id"] for item in view["candidate"]["items"] if item["kind"] == "topic")
    lesson = await auth_client.post(
        f"{root}/topics/{topic}/sessions",
        json={"fresh": False},
        headers={"Idempotency-Key": str(uuid.uuid4())},
    )
    reopened = await auth_client.post(
        f"{root}/topics/{topic}/sessions",
        json={"fresh": False},
        headers={"Idempotency-Key": str(uuid.uuid4())},
    )
    assert lesson.status_code == reopened.status_code == 201
    assert lesson.json()["chatId"] == reopened.json()["chatId"]
    completed = await auth_client.patch(
        f"{root}/topics/{topic}/progress", json={"status": "completed"}
    )
    assert completed.status_code == 200
    edited = await auth_client.patch(
        root,
        json={
            "baseRevisionId": view["revisionId"],
            "patches": [{"op": "move_item", "itemId": topic, "parentId": phase, "order": 4}],
        },
    )
    assert edited.status_code == 200
    moved = edited.json()
    async with get_session_factory()() as session:
        from services.roadmap.curriculum_repository import CurriculumRepository
        from services.roadmap.validation import validate_curriculum

        repo = CurriculumRepository(session, worker_job.owner_id)
        current = await repo.read(wid)
        candidate = current.candidate.model_copy(deep=True)
        next(
            item for item in candidate.items if item.id == topic
        ).title = "Deliberate line practice"
        proposal = await repo.save_revision(
            current.roadmap_id,
            current.revision_id,
            candidate,
            current.sources,
            validate_curriculum(candidate, current.profile, current.sources),
            "candidate",
        )
        await session.commit()
    stale = await auth_client.post(
        f"{root}/revisions/{proposal}/apply", json={"baseRevisionId": view["revisionId"]}
    )
    assert stale.status_code == 409
    unchanged = (await auth_client.get(root)).json()
    assert unchanged["revisionId"] == moved["revisionId"]
    assert unchanged["progress"][topic]["status"] == "completed"
    applied = await auth_client.post(
        f"{root}/revisions/{proposal}/apply", json={"baseRevisionId": moved["revisionId"]}
    )
    assert applied.status_code == 200 and applied.json()["progress"][topic]["status"] == "completed"
    restored = await auth_client.post(
        f"{root}/revisions/{view['revisionId']}/restore", json={"baseRevisionId": proposal}
    )
    assert restored.status_code == 200 and restored.json()["revisionId"] != view["revisionId"]
    assert restored.json()["progress"][topic]["status"] == "completed"
    session_read = await auth_client.get(f"{root}/sessions/{lesson.json()['id']}")
    assert (
        session_read.status_code == 200 and session_read.json()["chatId"] == lesson.json()["chatId"]
    )
