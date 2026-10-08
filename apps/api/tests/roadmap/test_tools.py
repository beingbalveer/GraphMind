import json
import uuid
from dataclasses import replace
from datetime import datetime, timezone

import pytest
from database import get_session_factory
from models.roadmap_job import RoadmapJobReference
from schemas.roadmap_job import JobCheckpoint, StageResult
from services.roadmap.references import ReferenceService
from services.roadmap.search import SearchError, SearchResponse, SearchResult
from services.roadmap.tools import RoadmapToolContext, build_roadmap_tools
from services.skill_service import SkillRegistry, get_skill_registry


class SearchBoundary:
    def require_configured(self):
        pass

    def __init__(self):
        self.calls = 0
        self.failure = False

    async def search(self, query):
        self.calls += 1
        if self.failure:
            raise SearchError("SEARCH_UNAVAILABLE", "Search is temporarily unavailable")
        return SearchResponse(
            results=[
                SearchResult(
                    title="Drawing curriculum",
                    url="https://example.com/drawing",
                    snippet="Observe forms and perspective",
                    provenance={"supported": True, "grounding": {"query": "drawing curriculum"}},
                )
            ],
            queries=[query],
            attribution_html="<div>Search attribution</div>",
            provider="test_search",
            searched_at=datetime.now(timezone.utc),
        )


class FetchBoundary:
    def __init__(self, source):
        self.source = source.model_copy(update={"id": "fetch_source", "access": "unknown"})
        self.calls = 0

    async def fetch(self, url):
        self.calls += 1
        return self.source.model_copy(update={"url": "https://example.com/final"})


@pytest.fixture
async def tool_context(
    worker_job,
    curriculum_session,
    job_repo,
    clock,
    small_profile,
    small_candidate,
    sources,
    tmp_path,
):
    ref = RoadmapJobReference(
        id=f"ref_{uuid.uuid4().hex}",
        job_id=worker_job.id,
        kind="file",
        name="private.txt",
        dedup_key=uuid.uuid4().hex,
        status="inspected",
        size_bytes=80,
        content_type="text/plain",
        storage_path=None,
        sections=[
            {
                "reference_id": "private",
                "locator": "Text",
                "text": "Our confidential payroll launch for Acme client is planned for January.",
            }
        ],
    )
    ref.sections[0]["reference_id"] = ref.id
    curriculum_session.add(ref)
    await curriculum_session.flush()
    claim = await job_repo.claim("tools-worker", clock.now())
    await job_repo.checkpoint(
        claim,
        "understand",
        StageResult(checkpoint=JobCheckpoint(profile=small_profile), summary="Goal understood"),
    )
    claim = await job_repo.claim("tools-worker", clock.now())
    await curriculum_session.commit()
    context = RoadmapToolContext(
        job_id=worker_job.id,
        owner_id=worker_job.owner_id,
        claim=claim,
        profile=small_profile.model_copy(
            update={"background": "My private launch deadline for Acme payroll is January."}
        ),
        checkpoint=JobCheckpoint(profile=small_profile, candidate=small_candidate, sources=sources),
        session_factory=get_session_factory(),
        references=lambda session: ReferenceService(session, tmp_path),
        source_fetcher=FetchBoundary(sources[0]),
        search_backend=SearchBoundary(),
        skill_registry=SkillRegistry(scope="roadmap"),
        clock=clock.now,
    )
    context.test_reference_id = ref.id
    return context


async def test_scoped_allowlist_has_no_graph_writes(tool_context):
    assert set(build_roadmap_tools(tool_context)) == {
        "search_web",
        "fetch_source",
        "read_reference",
        "list_skills",
        "load_skill",
        "validate_curriculum",
        "calculate_workload",
    }


async def test_replayed_search_keeps_evidence_without_extra_charges(
    tool_context, job_repo, worker_job
):
    tool = build_roadmap_tools(tool_context)["search_web"]
    first = await tool.run({"query": "beginner drawing curriculum"}, "call-one")
    second = await tool.run({"query": "beginner drawing curriculum"}, "call-two")
    assert (
        not first.is_error and first.content == second.content and second.tool_call_id == "call-two"
    )
    data = json.loads(first.content)
    assert data["results"][0]["url"] == "https://example.com/drawing"
    assert tool_context.search_backend.calls == 1
    job = await job_repo.read(worker_job.id, worker_job.owner_id)
    assert job.usage.searches == 1 and job.usage.model_calls == 1
    grounded = [source for source in tool_context.checkpoint.sources if source.status == "grounded"]
    assert len(grounded) == 1 and grounded[0].access == "unknown"


async def test_failed_transport_attempts_are_charged_each_time(tool_context, job_repo, worker_job):
    tool_context.search_backend.failure = True
    tool = build_roadmap_tools(tool_context)["search_web"]
    assert (await tool.run({"query": "beginner drawing curriculum"})).is_error
    assert (await tool.run({"query": "beginner drawing curriculum"})).is_error
    job = await job_repo.read(worker_job.id, worker_job.owner_id)
    assert job.usage.searches == job.usage.model_calls == 2
    assert tool_context.last_error.code == "SEARCH_UNAVAILABLE"


async def test_reference_scope_cannot_be_overridden(tool_context):
    tool = build_roadmap_tools(tool_context)["read_reference"]
    assert (
        await tool.run(
            {"reference_id": tool_context.test_reference_id, "owner_id": "another-owner"}
        )
    ).is_error
    valid = await tool.run({"reference_id": tool_context.test_reference_id})
    assert not valid.is_error and "confidential payroll" in valid.content
    forged = replace(tool_context, owner_id="another-owner")
    assert (
        await build_roadmap_tools(forged)["read_reference"].run(
            {"reference_id": tool_context.test_reference_id}
        )
    ).is_error


async def test_private_queries_are_rejected_before_search(tool_context, job_repo, worker_job):
    tool = build_roadmap_tools(tool_context)["search_web"]
    for query in [
        "My private launch deadline for Acme payroll",
        "Our confidential payroll launch for Acme client",
        "alice@example.com drawing course",
    ]:
        result = await tool.run({"query": query})
        assert result.is_error
    job = await job_repo.read(worker_job.id, worker_job.owner_id)
    assert job.usage.searches == 0 and tool_context.search_backend.calls == 0


async def test_skill_loading_is_registered_scoped_and_truthful(tool_context):
    tools = build_roadmap_tools(tool_context)
    for name in ["https://example.com/SKILL.md", "/tmp/SKILL.md", "deep_research", "missing-skill"]:
        assert (await tools["load_skill"].run({"name": name})).is_error
    loaded = await tools["load_skill"].run({"name": "source-review"})
    assert not loaded.is_error
    assert "source-review" in tool_context.checkpoint.loaded_skills
    assert "create_subnode" not in json.loads(loaded.content)["requiredTools"]
    assert "source-review" not in {skill["name"] for skill in get_skill_registry().list_skills()}


async def test_fetch_receipt_keeps_unknown_pricing_and_activity_private(
    tool_context, job_repo, worker_job
):
    tools = build_roadmap_tools(tool_context)
    first = await tools["fetch_source"].run({"url": "https://example.com/drawing"})
    assert not first.is_error and json.loads(first.content)["access"] == "unknown"
    assert (
        await tools["fetch_source"].run({"url": "https://example.com/drawing"})
    ).content == first.content
    assert tool_context.source_fetcher.calls == 1
    await tools["read_reference"].run({"reference_id": tool_context.test_reference_id})
    events = await job_repo.events(worker_job.id, worker_job.owner_id, 0)
    assert all(
        "payroll" not in event.summary.lower()
        and "confidential" not in json.dumps(event.metadata).lower()
        for event in events
    )


async def test_validation_and_workload_use_server_checkpoint(tool_context):
    tools = build_roadmap_tools(tool_context)
    validated = await tools["validate_curriculum"].run({})
    assert not validated.is_error and json.loads(validated.content)["valid"] is True
    workload = json.loads((await tools["calculate_workload"].run({})).content)
    assert workload["coreMinutes"] == 270 and workload["capacityMinutes"] == 720
    assert (await tools["calculate_workload"].run({"hours_per_week": 1000})).is_error


async def test_new_inspection_does_not_overwrite_archived_source_identity(tool_context):
    baseline = tool_context.checkpoint.sources[0].model_copy(
        update={"id": "archived_source", "url": "https://example.com/final"}
    )
    original = baseline.model_dump_json()
    tool_context.checkpoint.sources.append(baseline)
    result = await build_roadmap_tools(tool_context)["fetch_source"].run(
        {"url": "https://example.com/redirect"}
    )
    assert not result.is_error
    current_id = json.loads(result.content)["id"]
    assert current_id != baseline.id
    assert (
        next(
            source for source in tool_context.checkpoint.sources if source.id == baseline.id
        ).model_dump_json()
        == original
    )
    assert any(source.id == current_id for source in tool_context.checkpoint.sources)


async def test_reference_title_uses_actual_display_name(tool_context):
    result = await build_roadmap_tools(tool_context)["read_reference"].run(
        {"reference_id": tool_context.test_reference_id}
    )
    assert not result.is_error
    assert json.loads(result.content)["source"]["title"] == "private.txt"


async def test_validation_receipt_changes_with_repaired_candidate(tool_context):
    tool = build_roadmap_tools(tool_context)["validate_curriculum"]
    first = await tool.run({})
    assert json.loads(first.content)["valid"] is True
    tool_context.checkpoint.candidate.items[2].objectives = []
    second = await tool.run({})
    assert json.loads(second.content)["valid"] is False


async def test_final_url_reuses_current_job_inspection(tool_context, job_repo, worker_job):
    tool = build_roadmap_tools(tool_context)["fetch_source"]
    first = await tool.run({"url": "https://example.com/redirect"})
    second = await tool.run({"url": "https://example.com/final"})
    assert not second.is_error and second.content == first.content
    assert tool_context.source_fetcher.calls == 1
    assert (await job_repo.read(worker_job.id, worker_job.owner_id)).usage.unique_fetches == 1


async def test_link_reference_records_inspection_state(tool_context, curriculum_session):
    reference = RoadmapJobReference(
        id=f"ref_{uuid.uuid4().hex}",
        job_id=tool_context.job_id,
        kind="link",
        name="https://example.com/redirect",
        url="https://example.com/redirect",
        status="staged",
        size_bytes=0,
        dedup_key=uuid.uuid4().hex,
    )
    curriculum_session.add(reference)
    await curriculum_session.commit()
    result = await build_roadmap_tools(tool_context)["fetch_source"].run({"url": reference.url})
    assert not result.is_error
    await curriculum_session.refresh(reference)
    assert reference.status == "inspected" and reference.sections


async def test_missing_search_configuration_does_not_consume_attempt(
    tool_context, job_repo, worker_job
):
    from services.roadmap.search import GeminiSearchBackend

    tool_context.search_backend = GeminiSearchBackend(api_key="", model="test-model")
    result = await build_roadmap_tools(tool_context)["search_web"].run(
        {"query": "drawing curriculum"}
    )
    assert result.is_error
    assert tool_context.last_error.code == "SEARCH_NOT_CONFIGURED"
    assert tool_context.last_error.recoverable
    usage = (await job_repo.read(worker_job.id, worker_job.owner_id)).usage
    assert usage.model_calls == 0 and usage.searches == 0


async def test_search_returns_usable_source_ids_to_the_agent(tool_context):
    result = await build_roadmap_tools(tool_context)["search_web"].run(
        {"query": "drawing curriculum"}
    )
    data = json.loads(result.content)
    source = next(s for s in tool_context.checkpoint.sources if s.url == data["results"][0]["url"])
    assert data["results"][0]["provenance"]["sourceId"] == source.id


async def test_understanding_tools_protect_request_background_before_profile_is_inferred(
    worker_job, job_repo, curriculum_session, clock
):
    from config import Settings
    from services.roadmap.stages import RoadmapStageExecutor

    claim = await job_repo.claim("private-understanding", clock.now())
    await curriculum_session.commit()
    worker_job.request.background = "Confidential payroll account recovery procedure"
    executor = RoadmapStageExecutor(
        get_session_factory(),
        settings=Settings(_env_file=None, GEMINI_API_KEY=None, GOOGLE_API_KEY=None),
    )
    tools = executor.tools(worker_job, claim)
    result = await tools["search_web"].run(
        {"query": "Confidential payroll account recovery tutorials"}
    )
    assert result.is_error
    assert tools["search_web"].context.last_error.code == "PRIVATE_SEARCH_QUERY"


async def test_clarification_answers_cannot_be_copied_into_public_queries(tool_context):
    tool_context.checkpoint.clarification_answers = [
        "Confidential project Blue Orchid payroll launch"
    ]
    result = await build_roadmap_tools(tool_context)["search_web"].run(
        {"query": "Blue Orchid payroll launch curriculum"}
    )
    assert result.is_error
    assert tool_context.search_backend.calls == 0
