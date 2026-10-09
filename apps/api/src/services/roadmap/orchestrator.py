import asyncio
import hashlib
import inspect
import json
import re
import uuid
from collections.abc import Awaitable, Callable
from contextlib import AbstractAsyncContextManager
from typing import Any, TypeVar, cast

from ai_core.base import (
    BaseLLMProvider,
    BaseTool,
    ChatMessage,
    GenerationResult,
    ModelConfig,
    ToolCall,
    ToolResult,
)
from models.roadmap_job import RoadmapJobReference, RoadmapToolReceipt
from pydantic import JsonValue, ValidationError
from schemas.curriculum import (
    CurriculumCandidate,
    CurriculumSchema,
    LearningProfile,
    ResourceData,
    RoadmapRequest,
    SourceData,
)
from schemas.roadmap_job import (
    MAX_COVERAGE_TOPICS,
    Claim,
    JobError,
    JobSnapshot,
    ReferenceDisposition,
    StageName,
    StageResult,
)
from services.roadmap.coverage import (
    coverage_issues,
    evidence_review_issues,
    inventory_candidate,
    outline_issues,
    reference_coverage_issues,
    resource_grounding_issues,
    select_core,
)
from services.roadmap.job_repository import JobRepository, JobStateError
from services.roadmap.prompts import (
    CoreSelection,
    CoverageRepair,
    CoverageTopicBatch,
    EvidenceReview,
    OutlinePlan,
    QualityReview,
    ReferenceBatch,
    ResearchPlan,
    ResearchReview,
    TopicBatch,
    Understanding,
    map_topic_identifiers,
    resolve_source_handles,
    stage_messages,
    topic_handles,
)
from services.roadmap.revision_service import identity_review_issues
from services.roadmap.tools import RoadmapTool
from services.roadmap.validation import validate_curriculum
from services.roadmap.workload import WorkloadError, normalize_profile, schedule_core
from sqlalchemy import select
from structlog import get_logger

T = TypeVar("T", bound=CurriculumSchema)
RepositoryFactory = Callable[[], AbstractAsyncContextManager[JobRepository]]
ToolsFactory = Callable[[JobSnapshot, Claim], dict[str, BaseTool]]
MODEL_RESPONSE_TIMEOUT_SECONDS = 240
logger = get_logger()


def model_tool_content(
    result: ToolResult,
    sources: list[SourceData] | None = None,
    topic_mapping: dict[str, str] | None = None,
) -> str:
    if result.is_error or result.name not in {
        "search_web",
        "fetch_source",
        "read_reference",
        "calculate_workload",
        "validate_curriculum",
    }:
        return cast(str, result.content)
    try:
        data = json.loads(result.content)
    except json.JSONDecodeError:
        return cast(str, result.content)

    handles = {source.id: f"source_{index + 1}" for index, source in enumerate(sources or [])}

    def compact(value: JsonValue) -> JsonValue:
        if isinstance(value, dict):
            return {
                key: handles.get(child, child)
                if key in {"id", "sourceId", "source_id"} and isinstance(child, str)
                else compact(child)
                for key, child in value.items()
                if key not in {"grounding", "attributionHtml", "attribution_html"}
            }
        if isinstance(value, list):
            return [compact(child) for child in value]
        return value

    # Full grounding and publisher attribution stay in the immutable tool receipt.
    # The agent needs source identities/evidence, not repeated rendering metadata.
    return json.dumps(map_topic_identifiers(compact(data), topic_mapping or {}), ensure_ascii=False)


async def run_tool_cycle(
    provider: BaseLLMProvider,
    config: ModelConfig,
    messages: list[ChatMessage],
    tools: dict[str, BaseTool],
    *,
    before_call: Callable[[], Awaitable[None]],
    save_receipt: Callable[[ToolCall, ToolResult], Awaitable[None]],
    source_catalog: Callable[[], list[SourceData]] | None = None,
    topic_catalog: Callable[[], dict[str, str]] | None = None,
    tool_policy: Callable[[], Awaitable[set[str] | None]] | None = None,
) -> GenerationResult:
    oversized_batches = 0
    for _ in range(48):
        await before_call()
        permitted = await tool_policy() if tool_policy else None
        model_tools = (
            {name: tool for name, tool in tools.items() if name in permitted}
            if permitted is not None
            else tools
        )
        try:
            async with asyncio.timeout(MODEL_RESPONSE_TIMEOUT_SECONDS):
                result = await provider.generate(
                    messages, config, tools=list(model_tools.values()) or None
                )
        except TimeoutError as error:
            raise TimeoutError(
                f"Roadmap model response exceeded {MODEL_RESPONSE_TIMEOUT_SECONDS} seconds"
            ) from error
        if not result.tool_calls:
            return result
        logger.info(
            "roadmap_model_tool_proposal",
            count=len(result.tool_calls),
            registered_counts={
                name: sum(c.name == name for c in result.tool_calls) for name in model_tools
            },
            unknown_count=sum(c.name not in tools for c in result.tool_calls),
        )
        if len(result.tool_calls) > 40:
            oversized_batches += 1
            logger.warning(
                "roadmap_tool_batch_rejected",
                count=len(result.tool_calls),
                registered_counts={
                    name: sum(c.name == name for c in result.tool_calls) for name in model_tools
                },
                unknown_count=sum(c.name not in tools for c in result.tool_calls),
            )
            if oversized_batches >= 3:
                raise JobStateError("TOOL_CALL_LIMIT", "Use fewer research tools in each step")
            messages.append(
                ChatMessage.user(
                    "Your tool proposal exceeded the per-step limit and was NOT executed. "
                    "Request at most 8 tools at a time. Reuse strong instructional sources across "
                    "related topics; do not fetch a separate page for every topic. "
                    "After research return the required inventory JSON, not a tool call containing it."
                )
            )
            continue
        messages.append(ChatMessage.assistant(result.content, tool_calls=result.tool_calls))
        searches_in_response = 0
        for call in result.tool_calls:
            if call.name == "search_web":
                searches_in_response += 1
            tool = (
                model_tools.get(call.name)
                if call.name != "search_web" or searches_in_response <= 4
                else None
            )
            tool_result = (
                await tool.run(
                    map_topic_identifiers(
                        call.arguments,
                        {
                            handle: key
                            for key, handle in (topic_catalog() if topic_catalog else {}).items()
                        },
                    ),
                    call.id,
                )
                if tool
                else ToolResult(
                    tool_call_id=call.id,
                    name=call.name,
                    content="Tool unavailable for this job",
                    is_error=True,
                )
            )
            await save_receipt(call, tool_result)
            messages.append(
                ChatMessage.tool(
                    model_tool_content(
                        tool_result,
                        source_catalog() if source_catalog else None,
                        topic_catalog() if topic_catalog else None,
                    ),
                    call.id,
                    call.name,
                )
            )
    raise JobStateError("BUDGET_EXHAUSTED", "This run reached its research limit. Start a new run.")


class RoadmapStageExecutor:
    def __init__(
        self,
        provider: BaseLLMProvider,
        config: ModelConfig,
        tools_factory: ToolsFactory,
        repository_factory: RepositoryFactory,
    ) -> None:
        self.provider = provider
        self.config = config.model_copy(update={"max_retries": 0})
        self.tools_factory = tools_factory
        self.repositories = repository_factory

    async def _check(self, claim: Claim) -> None:
        async with self.repositories() as repo:
            row, _ = await repo._claimed(claim)
            repo._execution_budget(row)

    async def _charge(self, claim: Claim) -> None:
        async with self.repositories() as repo:
            await repo.charge(claim, "model", f"model:{uuid.uuid4().hex}")

    async def _begin_validation_repair(
        self, job: JobSnapshot, claim: Claim, issues: list[str]
    ) -> None:
        prepared = job.checkpoint.model_copy(deep=True)
        prepared.validation_repair_active = True
        prepared.validation_repair_phase = "inventory"
        prepared.validation_repair_issues = issues[:1000]
        async with self.repositories() as repo:
            row, _ = await repo._claimed(claim)
            current = await repo.read(claim.job_id, row.owner_id)
            if current.usage.repair_attempts >= min(3, current.limits.repair_attempts):
                raise JobStateError(
                    "REPAIR_LIMIT", "This roadmap needs a narrower goal. Start a new run."
                )
            await repo.charge(claim, "repair", f"repair:{uuid.uuid4().hex}")
            row.checkpoint = prepared.model_dump(mode="json")
            await repo.session.flush()
            await repo.append_event(
                claim.job_id, "repair_started", "Refining curriculum quality", {}
            )
        # RoadmapTool instances created at run start keep this checkpoint object.
        # Preserve its identity so later tool receipt callbacks cannot restore the
        # pre-repair snapshot over these durable resume markers.
        job.checkpoint.validation_repair_active = prepared.validation_repair_active
        job.checkpoint.validation_repair_phase = prepared.validation_repair_phase
        job.checkpoint.validation_repair_issues = prepared.validation_repair_issues

    async def _references(self, job: JobSnapshot, claim: Claim) -> list[dict[str, object]]:
        async with self.repositories() as repo:
            await repo._claimed(claim)
            rows = (
                await repo.session.scalars(
                    select(RoadmapJobReference).where(RoadmapJobReference.job_id == job.id)
                )
            ).all()
            return [
                {
                    "id": row.id,
                    "name": row.name,
                    "kind": row.kind,
                    "url": row.url,
                    "status": row.status,
                    "error": row.error,
                }
                for row in rows
            ]

    async def _typed(
        self,
        stage: StageName,
        schema: type[T],
        job: JobSnapshot,
        claim: Claim,
        tools: dict[str, BaseTool],
        *,
        repair: list[str] | None = None,
        task: dict[str, Any] | None = None,
        check_output: Callable[[T], list[str] | Awaitable[list[str]]] | None = None,
    ) -> T:
        messages = stage_messages(
            stage, job, schema, await self._references(job, claim), repair=repair, task=task
        )
        skill_name = {
            "research": "source-review",
            "compose": "curriculum-design",
            "personalize": "workload-planning",
        }.get(stage)
        if task and task.get("mode") in {"evidence_review", "reference_mapping"}:
            skill_name = None
        if skill_name and "load_skill" in tools:
            loaded = await tools["load_skill"].run({"name": skill_name})
            if loaded.is_error:
                raise JobStateError(
                    "SKILL_UNAVAILABLE", "The registered roadmap playbook is unavailable"
                )
            messages.insert(
                1, ChatMessage.system("Registered application guidance:\n" + loaded.content)
            )

        async def before() -> None:
            await self._charge(claim)

        async def save(call: ToolCall, result: ToolResult) -> None:
            await self._check(claim)
            # Scoped tools durably save successful canonical receipts before returning.
            # Fatal configuration/budget/fencing errors must stop this model cycle.
            tool = tools.get(call.name)
            if isinstance(tool, RoadmapTool):
                job.checkpoint = tool.context.checkpoint
                error = tool.context.last_error
                if result.is_error:
                    logger.warning(
                        "roadmap_tool_rejected",
                        job_id=job.id,
                        stage=stage,
                        tool=tool.name,
                        code=error.code if error else "TOOL_ERROR",
                    )
                if error and (
                    error.next_action == "configure_search"
                    or error.code in {"BUDGET_EXHAUSTED", "STALE_LEASE", "JOB_NOT_FOUND"}
                ):
                    raise JobStateError(error.code, error.message, error=error)

        async def research_tool_policy() -> set[str] | None:
            if stage != "research" or mode in {"reference_mapping", "evidence_review"}:
                return None
            async with self.repositories() as repo:
                await repo._claimed(claim)
                receipts = (
                    await repo.session.scalars(
                        select(RoadmapToolReceipt.operation_key).where(
                            RoadmapToolReceipt.job_id == job.id,
                            RoadmapToolReceipt.stage == "research",
                            RoadmapToolReceipt.result.is_not(None),
                            RoadmapToolReceipt.operation_key.like("tool:%"),
                        )
                    )
                ).all()
            searches = sum(key.startswith("tool:search_web:") for key in receipts)
            fetches = sum(key.startswith("tool:fetch_source:") for key in receipts)
            if (searches >= 4 and fetches < 2) or searches >= 10:
                return set(tools) - {"search_web"}
            return None

        token_limited = False
        additional_ids = (
            [i.id for i in job.checkpoint.original_candidate.items if i.kind == "topic"]
            if job.checkpoint.original_candidate
            else []
        )
        mode = (task or {}).get("mode")
        allowed = {
            "core_selection": {"load_skill", "calculate_workload", "validate_curriculum"},
            "outline": {"load_skill"},
            "evidence_review": set(),
            "reference_mapping": set(),
            "topic_details": {
                "search_web",
                "fetch_source",
                "read_reference",
                "list_skills",
                "load_skill",
            },
        }.get(str(mode))
        if stage == "understand":
            allowed = set()
        elif stage == "research" and allowed is None:
            allowed = {"search_web", "fetch_source", "read_reference", "list_skills", "load_skill"}
        model_tools = {
            name: tool for name, tool in tools.items() if allowed is None or name in allowed
        }
        for attempt in range(3):
            result = await run_tool_cycle(
                self.provider,
                self.config,
                messages,
                model_tools,
                before_call=before,
                save_receipt=save,
                source_catalog=lambda: job.checkpoint.sources,
                topic_catalog=lambda: topic_handles(job.checkpoint.coverage_topics, additional_ids),
                tool_policy=research_tool_policy,
            )
            await self._check(claim)
            token_limited = token_limited or result.finish_reason == "MAX_TOKENS"
            try:
                content = result.content.strip()
                if content.startswith("```json") and content.endswith("```"):
                    content = content[7:-3].strip()
                output = schema.model_validate_json(
                    resolve_source_handles(
                        content,
                        job.checkpoint.sources,
                        job.checkpoint.coverage_topics,
                        additional_ids,
                    )
                )
            except ValidationError as error:
                errors = [
                    f"{'.'.join(str(part) for part in detail['loc']) or '$'} "
                    f"[{detail['type']}]: {detail['msg'][:200]}"
                    for detail in error.errors(include_input=False, include_context=False)[:30]
                ]
            else:
                checked = check_output(output) if check_output else []
                errors = await checked if inspect.isawaitable(checked) else checked
                if not errors:
                    return cast(T, output)
            logger.warning(
                "roadmap_stage_schema_rejected",
                job_id=job.id,
                stage=stage,
                finish_reason=result.finish_reason,
                returned_characters=len(result.content),
                fenced=result.content.lstrip().startswith("```"),
                envelope_counts={
                    key: result.content.count(chr(34) + key + chr(34))
                    for key in (
                        "coverageTopics",
                        "referenceDispositions",
                        "items",
                        "resources",
                        "objectives",
                    )
                },
                issues=errors,
            )
            if attempt == 2:
                if token_limited:
                    raise JobStateError(
                        "MODEL_OUTPUT_LIMIT",
                        error=JobError(
                            code="MODEL_OUTPUT_LIMIT",
                            message="The model response reached its output limit. Retry to continue saved research.",
                            recoverable=True,
                            next_action="retry",
                        ),
                    ) from None
                pending = (
                    job.checkpoint.pending_inventory_review is not None
                    and job.checkpoint.pending_inventory_stage == claim.stage
                )
                saved_area_inventory = (
                    stage == "research"
                    and job.checkpoint.coverage_inventory_plan is not None
                    and job.checkpoint.coverage_inventory_next_area > 0
                )
                pending = pending or saved_area_inventory
                raise JobStateError(
                    "STAGE_OUTPUT_INVALID",
                    error=JobError(
                        code="STAGE_OUTPUT_INVALID",
                        message="The saved comparison needs more inventory or lesson repair. Retry to continue."
                        if pending
                        else "The agent could not produce a valid roadmap. Try a more specific goal.",
                        recoverable=pending,
                        next_action="retry" if pending else "new_run",
                    ),
                ) from None
            fresh = stage_messages(
                stage, job, schema, await self._references(job, claim), repair=repair, task=task
            )
            registered = [message for message in messages[1:2] if message.role.value == "system"]
            messages[:] = fresh[:1] + registered + fresh[1:]
            messages.extend(
                [
                    ChatMessage.assistant(result.content),
                    ChatMessage.user(
                        "The output did not meet the required schema or evidence checks. Correct these "
                        "fields and return complete JSON; do not invent evidence:\n"
                        + "\n".join(errors)
                        + "\nUse the refreshed evidence catalog above. Copy its exact id values for sourceIds; referenceId, tool receipt IDs, titles and URLs are not source IDs."
                    ),
                ]
            )
        raise AssertionError("Bounded output loop did not return")

    def _candidate(self, candidate: CurriculumCandidate, job: JobSnapshot) -> CurriculumCandidate:
        if job.request.title:
            candidate.title = job.request.title
            for item in candidate.items:
                if item.kind == "root":
                    item.title = job.request.title
        profile = job.checkpoint.profile
        assert profile is not None
        try:
            candidate.sessions = schedule_core(candidate, profile)
        except WorkloadError:
            candidate.sessions = []  # Deterministic validation explains this for bounded repair.
        return candidate

    async def _save_partial(self, job: JobSnapshot, claim: Claim, summary: str) -> None:
        async with self.repositories() as repo:
            row, _ = await repo._claimed(claim)
            repo._execution_budget(row)
            row.checkpoint = job.checkpoint.model_dump(mode="json")
            await repo.session.flush()
            await repo.append_event(job.id, "composition_progress", summary, {})
            await repo.session.flush()

    async def _compose(
        self,
        job: JobSnapshot,
        claim: Claim,
        tools: dict[str, BaseTool],
        *,
        repair: list[str] | None = None,
    ) -> CurriculumCandidate:
        checkpoint = job.checkpoint
        if not checkpoint.coverage_topics:
            return await self._typed(
                "compose", CurriculumCandidate, job, claim, tools, repair=repair
            )
        if checkpoint.validation_repair_active and checkpoint.validation_repair_phase in {
            "compose",
            "personalize",
        }:
            repair = None
        if repair:
            previous = {t.id: t for t in checkpoint.coverage_topics}

            async def amendment_issues(amendment: CoverageRepair) -> list[str]:
                actual = {s.id for s in checkpoint.sources if s.status in {"grounded", "inspected"}}
                ids = [t.id for t in amendment.coverage_topics]
                if len(set(ids)) != len(ids) or any(
                    not set(t.source_ids).issubset(actual) for t in amendment.coverage_topics
                ):
                    return [
                        "Use unique topic IDs and only actual registered sourceIds in the corrected inventory."
                    ]
                if not set(amendment.redetail_topic_ids).issubset(set(ids)):
                    return ["redetailTopicIds must belong to the corrected inventory."]
                await self._complete_reference_map(amendment, job, claim, tools)
                issues = reference_coverage_issues(amendment, checkpoint.sources)
                if not issues and amendment.reference_dispositions:
                    issues.extend(
                        await self._review_reference_dispositions(amendment, job, claim, tools)
                    )
                return cast(list[str], issues)

            pending = checkpoint.pending_inventory_review
            if (
                pending
                and checkpoint.pending_inventory_stage == claim.stage
                and "redetailTopicIds" in pending
            ):
                amendment = CoverageRepair.model_validate(pending)
                pending_issues = await amendment_issues(amendment)
                if pending_issues:
                    amendment = await self._typed(
                        "compose",
                        CoverageRepair,
                        job,
                        claim,
                        tools,
                        repair=[*repair, *pending_issues],
                        task={"mode": "inventory_repair"},
                        check_output=amendment_issues,
                    )
            else:
                amendment = await self._typed(
                    "compose",
                    CoverageRepair,
                    job,
                    claim,
                    tools,
                    repair=repair,
                    task={"mode": "inventory_repair"},
                    check_output=amendment_issues,
                )
            checkpoint.pending_inventory_review = None
            checkpoint.pending_inventory_stage = None
            checkpoint.coverage_topics = amendment.coverage_topics
            checkpoint.reference_dispositions = amendment.reference_dispositions
            rewrite = set(amendment.redetail_topic_ids)
            rewrite.update(
                t.id
                for t in amendment.coverage_topics
                if t.id not in previous or t.title != previous[t.id].title
            )
            retained = {t.id for t in amendment.coverage_topics}
            checkpoint.detailed_topic_ids = [
                key
                for key in checkpoint.detailed_topic_ids
                if key in retained and key not in rewrite
            ]
            checkpoint.composition_started = False
            if checkpoint.validation_repair_active:
                checkpoint.validation_repair_phase = "compose"
                await self._save_partial(
                    job, claim, "Inventory repairs accepted; preparing corrected lessons"
                )
        if repair or not checkpoint.composition_started or checkpoint.candidate is None:
            topic_ids = {topic.id for topic in checkpoint.coverage_topics}
            plan = await self._typed(
                "compose",
                OutlinePlan,
                job,
                claim,
                tools,
                repair=repair,
                task={"mode": "outline"},
                check_output=lambda plan: outline_issues(plan.relations, topic_ids),
            )
            outline = inventory_candidate(
                job.request.title or plan.title,
                plan.outcome,
                checkpoint.coverage_topics,
                plan.relations,
                plan.assumptions,
                checkpoint.candidate or checkpoint.original_candidate,
            )
            missing = coverage_issues(outline, checkpoint.coverage_topics)
            if missing:
                raise JobStateError(
                    "COVERAGE_INCOMPLETE",
                    error=JobError(
                        code="COVERAGE_INCOMPLETE",
                        message="The draft omitted researched topics. Retry to continue saved research.",
                        recoverable=True,
                        next_action="retry",
                    ),
                )
            checkpoint.candidate = outline
            checkpoint.composition_started = True
            if not repair and not checkpoint.validation_repair_active:
                checkpoint.detailed_topic_ids = []
            await self._save_partial(
                job, claim, "Complete subject map drafted; preparing topic lessons"
            )
        candidate = checkpoint.candidate
        assert candidate is not None
        topics = [i for i in candidate.items if i.kind == "topic" and i.participation == "active"]
        if len(topics) > MAX_COVERAGE_TOPICS:
            raise JobStateError(
                "CURRICULUM_SIZE_LIMIT",
                f"Keep the subject map within {MAX_COVERAGE_TOPICS} actionable topics",
            )
        remaining = [i for i in topics if i.id not in checkpoint.detailed_topic_ids]
        for start in range(0, len(remaining), 20):
            ids = [i.id for i in remaining[start : start + 20]]

            async def batch_issues(batch: TopicBatch) -> list[str]:
                actual_sources = {
                    s.id for s in checkpoint.sources if s.status in {"grounded", "inspected"}
                }
                returned = [detail.id for detail in batch.topics]
                resource_ids = {r.topic_id for r in batch.resources}
                if (
                    len(returned) == len(ids)
                    and set(returned) == set(ids)
                    and resource_ids == set(ids)
                    and all(r.source_id in actual_sources for r in batch.resources)
                    and all(
                        1 <= sum(r.topic_id == key for r in batch.resources) <= 3 for key in ids
                    )
                ):
                    preview = candidate.model_copy(deep=True)
                    details = {detail.id: detail for detail in batch.topics}
                    for item in preview.items:
                        if item.id in details:
                            item.objectives = details[item.id].objectives
                    preview.resources = list(batch.resources)
                    issues = resource_grounding_issues(preview, checkpoint.sources, set(ids))
                    if issues:
                        return cast(list[str], issues)
                    sources = {s.id: s for s in checkpoint.sources}
                    checks = [
                        {
                            "checkId": f"lesson_{index}",
                            "kind": "lesson",
                            "topicId": r.topic_id,
                            "title": next(t.title for t in candidate.items if t.id == r.topic_id),
                            "objective": details[r.topic_id].objectives[r.objective_index],
                            "exercise": details[r.topic_id].exercise,
                            "sourceTitle": sources[r.source_id].title,
                            "evidenceExcerpt": r.evidence_excerpt,
                        }
                        for index, r in enumerate(batch.resources)
                    ]
                    return await self._review_evidence(job, claim, tools, checks, "compose")
                return [
                    "Return exactly the requested topicIds once each, with 1–3 actual recorded instructional resources per topic; no extra or invented IDs."
                ]

            batch = await self._typed(
                "compose",
                TopicBatch,
                job,
                claim,
                tools,
                repair=repair,
                task={"mode": "topic_details", "topicIds": ids},
                check_output=batch_issues,
            )
            by_id = {detail.id: detail for detail in batch.topics}
            for item in candidate.items:
                if item.id in by_id:
                    for name, value in by_id[item.id].model_dump(exclude={"id"}).items():
                        setattr(item, name, value)
            candidate.resources = [r for r in candidate.resources if r.topic_id not in ids] + [
                ResourceData.model_validate(r.model_dump()) for r in batch.resources
            ]
            checkpoint.detailed_topic_ids.extend(ids)
            await self._save_partial(
                job,
                claim,
                f"Prepared {len(checkpoint.detailed_topic_ids)} of {len(topics)} topic lessons",
            )
        return candidate

    async def _review_evidence(
        self,
        job: JobSnapshot,
        claim: Claim,
        tools: dict[str, BaseTool],
        checks: list[dict[str, Any]],
        stage: StageName,
        context: dict[str, Any] | None = None,
    ) -> list[str]:
        issues: list[str] = []
        for start in range(0, len(checks), 100):
            batch = checks[start : start + 100]

            def shape_issues(review: EvidenceReview) -> list[str]:
                returned = [v.check_id for v in review.verdicts]
                expected = {c["checkId"] for c in batch}
                return (
                    []
                    if len(returned) == len(expected) and set(returned) == expected
                    else [
                        "Return exactly one verdict for every requested checkId without duplicates."
                    ]
                )

            reviewed = await self._typed(
                stage,
                EvidenceReview,
                job,
                claim,
                tools,
                task={"mode": "evidence_review", "checks": batch, **(context or {})},
                check_output=shape_issues,
            )
            issues.extend(evidence_review_issues(reviewed, batch))
        return issues

    async def _complete_reference_map(
        self,
        review: ResearchReview | CoverageRepair,
        job: JobSnapshot,
        claim: Claim,
        tools: dict[str, BaseTool],
        *,
        only_labels: set[tuple[str, int]] | None = None,
        force: bool = False,
        repair: list[str] | None = None,
    ) -> None:
        job.checkpoint.pending_inventory_review = review.model_dump(mode="json", by_alias=True)
        job.checkpoint.pending_inventory_stage = claim.stage
        await self._save_partial(
            job, claim, "Comparing the subject inventory with reference diagrams"
        )
        seen = (
            {(d.source_id, d.label_index) for d in review.reference_dispositions}
            if only_labels is None and not force
            else set()
        )
        labels = [
            {"sourceId": s.id, "labelIndex": index, "label": label}
            for s in job.checkpoint.sources
            if isinstance(values := s.provenance.get("diagramLabels"), list)
            and s.status in {"grounded", "inspected"}
            for index, label in enumerate(values)
            if (s.id, index) not in seen and (only_labels is None or (s.id, index) in only_labels)
        ]
        topics = {t.id for t in review.coverage_topics}
        for start in range(0, len(labels), 64):
            requested = labels[start : start + 64]
            expected = {(label["sourceId"], label["labelIndex"]) for label in requested}

            def shape_issues(batch: ReferenceBatch) -> list[str]:
                actual = [(d.source_id, d.label_index) for d in batch.reference_dispositions]
                if (
                    len(actual) != len(expected)
                    or set(actual) != expected
                    or any(
                        not set(d.topic_ids).issubset(topics) for d in batch.reference_dispositions
                    )
                ):
                    return [
                        "Map every requested sourceId/labelIndex exactly once to actual inventory topic IDs; do not invent or omit labels."
                    ]
                return []

            batch = await self._typed(
                "research",
                ReferenceBatch,
                job,
                claim,
                tools,
                task={
                    "mode": "reference_mapping",
                    "labels": requested,
                    "coverageTopics": [
                        t.model_dump(mode="json", by_alias=True) for t in review.coverage_topics
                    ],
                },
                repair=repair,
                check_output=shape_issues,
            )
            if only_labels is None and not force:
                review.reference_dispositions.extend(batch.reference_dispositions)
            else:
                replacements = {
                    (d.source_id, d.label_index): d for d in batch.reference_dispositions
                }
                merged: list[ReferenceDisposition] = []
                written: set[tuple[str, int]] = set()
                for disposition in review.reference_dispositions:
                    key = (disposition.source_id, disposition.label_index)
                    if key in written:
                        continue
                    written.add(key)
                    merged.append(replacements.pop(key, disposition))
                review.reference_dispositions = merged + list(replacements.values())
            job.checkpoint.pending_inventory_review = review.model_dump(mode="json", by_alias=True)
            await self._save_partial(
                job, claim, f"Compared {len(review.reference_dispositions)} reference labels"
            )

    async def _review_reference_dispositions(
        self,
        review: ResearchReview | CoverageRepair,
        job: JobSnapshot,
        claim: Claim,
        tools: dict[str, BaseTool],
    ) -> list[str]:
        diagrams = {
            s.id: labels
            for s in job.checkpoint.sources
            if isinstance(labels := s.provenance.get("diagramLabels"), list)
        }
        topics = {t.id: t.title for t in review.coverage_topics}
        checks = [
            {
                "checkId": f"label_{index}",
                "kind": "reference",
                "label": diagrams[d.source_id][d.label_index],
                "disposition": d.kind,
                "reason": d.reason,
                "mappedLessons": [topics[t] for t in d.topic_ids],
            }
            for index, d in enumerate(review.reference_dispositions)
        ]
        return await self._review_evidence(
            job, claim, tools, checks, "research", {"allLessonTitles": list(topics.values())}
        )

    async def _personalize(
        self, job: JobSnapshot, claim: Claim, tools: dict[str, BaseTool]
    ) -> CurriculumCandidate:
        if not job.checkpoint.coverage_topics:
            return await self._typed("personalize", CurriculumCandidate, job, claim, tools)
        candidate = job.checkpoint.candidate
        assert candidate is not None
        assert job.checkpoint.profile is not None
        issues = None
        for attempt in range(3):
            selection = await self._typed(
                "personalize",
                CoreSelection,
                job,
                claim,
                tools,
                repair=issues,
                task={"mode": "core_selection"},
            )
            try:
                selected = self._candidate(
                    select_core(
                        candidate,
                        selection.core_topic_ids,
                        selection.outcome,
                        selection.assumptions,
                    ),
                    job,
                )
                report = validate_curriculum(
                    selected, job.checkpoint.profile, job.checkpoint.sources
                )
                pacing = [
                    issue.message
                    for issue in report.issues
                    if issue.code in {"CAPACITY_EXCEEDED", "CORE_PREREQUISITE"}
                ]
                if pacing:
                    minutes = sum(
                        i.estimate_minutes or 0
                        for i in selected.items
                        if i.kind == "topic" and i.path == "core"
                    )
                    profile = job.checkpoint.profile
                    capacity = (
                        profile.study_weeks * profile.weekly_minutes
                        if profile.study_weeks is not None and profile.weekly_minutes is not None
                        else None
                    )
                    raise ValueError(
                        f"Selected core requires {minutes} minutes; available capacity is "
                        f"{capacity} minutes. " + "; ".join(pacing)
                    )
                return selected
            except ValueError as error:
                issues = [str(error)]
                logger.warning(
                    "roadmap_core_selection_rejected",
                    job_id=job.id,
                    attempt=attempt + 1,
                    reason=str(error),
                    selected_count=len(selection.core_topic_ids),
                )
                if attempt == 2:
                    raise JobStateError(
                        "CORE_SELECTION_INVALID",
                        "The agent could not select a realistic prerequisite-complete core",
                    ) from None
        raise AssertionError("Bounded core selection did not return")

    async def run(self, stage: StageName, job: JobSnapshot, claim: Claim) -> StageResult:
        if stage == "publish":
            raise JobStateError("SERVICE_ONLY_STAGE", "Publication is owned by the service")
        if stage != claim.stage:
            raise JobStateError("STAGE_MISMATCH", "Resume the current saved stage")
        await self._check(claim)
        job = job.model_copy(deep=True)
        tools = self.tools_factory(job, claim)
        if stage == "understand":
            understood = await self._typed(stage, Understanding, job, claim, tools)
            if understood.question:
                if job.question_count >= 3:
                    raise JobStateError(
                        "CLARIFICATION_LIMIT",
                        "Describe a specific outcome and available study time in a new run.",
                    )
                return StageResult(
                    checkpoint=job.checkpoint,
                    question=understood.question,
                    summary="One learning preference needs clarification",
                )
            assert understood.profile is not None
            inferred = understood.profile
            if job.operation == "refine":
                if job.checkpoint.profile is None:
                    raise JobStateError(
                        "PROFILE_MISSING", "Refinement needs the original learning profile"
                    )
                # The refinement instruction is separate from the original learning goal.
                # Keep the established time budget; candidate pacing is recomputed below.
                return StageResult(
                    checkpoint=job.checkpoint,
                    summary="Refinement understood within your existing learning goal and study budget",
                )
            # Optional pacing stays unknown unless the learner supplied it in a clarification.
            values = job.request.model_dump()
            for field in ("duration", "hours_per_week"):
                if values[field] is None and job.checkpoint.clarification_answers:
                    values[field] = getattr(inferred, field)
            normalized = normalize_profile(RoadmapRequest.model_validate(values))
            job.checkpoint.profile = LearningProfile(
                **normalized.model_dump(exclude={"outcome", "assumptions", "known_skills"}),
                outcome=inferred.outcome,
                assumptions=inferred.assumptions,
                known_skills=inferred.known_skills,
            )
            return StageResult(
                checkpoint=job.checkpoint, summary="Learning goal and study budget understood"
            )
        if job.checkpoint.profile is None:
            raise JobStateError("PROFILE_MISSING", "Resume understanding before research")
        if stage == "research":
            # Inspect supplied material before asking the model to inventory it.
            # These scoped tools use the same durable receipts, privacy guard and budgets.
            for reference in await self._references(job, claim):
                name = "fetch_source" if reference["kind"] == "link" else "read_reference"
                arguments = (
                    {"url": reference["url"]}
                    if name == "fetch_source"
                    else {"referenceId": reference["id"]}
                )
                if name in tools:
                    await tools[name].run(arguments)
                    scoped = tools[name]
                    if isinstance(scoped, RoadmapTool):
                        job.checkpoint = scoped.context.checkpoint
                        failure = scoped.context.last_error
                        if failure and failure.code in {
                            "BUDGET_EXHAUSTED",
                            "STALE_LEASE",
                            "JOB_NOT_FOUND",
                        }:
                            raise JobStateError(failure.code, error=failure)

            async def research_plan_issues(plan: ResearchPlan) -> list[str]:
                actual = {
                    s.id for s in job.checkpoint.sources if s.status in {"grounded", "inspected"}
                }
                inspected_public = {
                    s.id for s in job.checkpoint.sources if s.url and s.status == "inspected"
                }
                issues = []
                if len({area.title.casefold() for area in plan.areas}) != len(plan.areas):
                    issues.append("Give every subject area a distinct title.")
                async with self.repositories() as repo:
                    await repo._claimed(claim)
                    searched = await repo.session.scalar(
                        select(RoadmapToolReceipt.operation_key)
                        .where(
                            RoadmapToolReceipt.job_id == job.id,
                            RoadmapToolReceipt.stage == "research",
                            RoadmapToolReceipt.operation_key.like("tool:search_web:%"),
                            RoadmapToolReceipt.result.is_not(None),
                        )
                        .limit(1)
                    )
                if searched is None:
                    issues.append(
                        "Research must call search_web with short public subject keywords and obtain "
                        "grounded learning evidence, even when references are supplied. Do this before "
                        "returning the inventory; do not rely only on the supplied sources."
                    )
                if (
                    not set(plan.source_ids).issubset(actual)
                    or len(set(plan.source_ids) & inspected_public) < 2
                ):
                    issues.append(
                        "Inspect at least TWO different public instructional URLs with fetch_source, then return both exact recorded source IDs in sourceIds. Never fetch the same URL twice; an uploaded PDF does not count as a public URL."
                    )
                return issues

            if job.checkpoint.coverage_inventory_plan:
                plan = ResearchPlan.model_validate(job.checkpoint.coverage_inventory_plan)
            else:
                plan = await self._typed(
                    stage,
                    ResearchPlan,
                    job,
                    claim,
                    tools,
                    task={"mode": "inventory_plan"},
                    check_output=research_plan_issues,
                )
                job.checkpoint.coverage_inventory_plan = plan.model_dump(mode="json", by_alias=True)
                job.checkpoint.coverage_inventory_next_area = 0
                job.checkpoint.coverage_topics = []
                job.checkpoint.coverage_notes = plan.coverage_notes
                job.checkpoint.reference_dispositions = []
                job.checkpoint.pending_inventory_review = None
                job.checkpoint.pending_inventory_stage = None
                await self._save_partial(
                    job, claim, "Research plan saved; detailing each subject area"
                )

            actual = {
                source.id
                for source in job.checkpoint.sources
                if source.status in {"grounded", "inspected"}
            }
            area_items = [area.model_dump(mode="json", by_alias=True) for area in plan.areas]
            if job.checkpoint.coverage_inventory_next_area > len(area_items):
                raise JobStateError(
                    "RESEARCH_CHECKPOINT_INVALID", "The saved inventory cursor is invalid"
                )
            for index in range(job.checkpoint.coverage_inventory_next_area, len(area_items)):
                area = area_items[index]

                def area_issues(batch: CoverageTopicBatch) -> list[str]:
                    actual = {
                        source.id
                        for source in job.checkpoint.sources
                        if source.status in {"grounded", "inspected"}
                    }
                    topics = batch.coverage_topics
                    known_ids = {topic.id for topic in job.checkpoint.coverage_topics}
                    ids = [topic.id for topic in topics]
                    if len(job.checkpoint.coverage_topics) + len(topics) > MAX_COVERAGE_TOPICS:
                        return [
                            f"Keep the complete actionable subject inventory within {MAX_COVERAGE_TOPICS} topics."
                        ]
                    if len(ids) != len(set(ids)) or known_ids.intersection(ids):
                        repeated = sorted(
                            known_ids.intersection(ids) | {key for key in ids if ids.count(key) > 1}
                        )
                        return [
                            "Use unique area-prefixed topic IDs and do not repeat IDs from earlier areas. "
                            f"Conflicting IDs: {', '.join(repeated[:20]) or 'duplicate IDs in this batch'}."
                        ]
                    if any(topic.area != area["title"] for topic in topics):
                        return [
                            "Set every topic area to the exact area title supplied in task.area."
                        ]
                    if any(not set(topic.source_ids).issubset(actual) for topic in topics):
                        return ["Every topic sourceIds value must be an exact recorded source ID."]
                    return []

                batch = await self._typed(
                    stage,
                    CoverageTopicBatch,
                    job,
                    claim,
                    tools,
                    task={
                        "mode": "inventory_area",
                        "area": area["title"],
                        "scope": area["scope"],
                        "areaIndex": index,
                        "areaCount": len(area_items),
                    },
                    check_output=area_issues,
                )
                job.checkpoint.coverage_topics.extend(batch.coverage_topics)
                job.checkpoint.coverage_inventory_next_area = index + 1
                job.checkpoint.pending_inventory_review = None
                job.checkpoint.pending_inventory_stage = None
                await self._save_partial(
                    job,
                    claim,
                    f"Detailed area {index + 1} of {len(area_items)}; saved {len(job.checkpoint.coverage_topics)} concepts",
                )

            actual = {
                source.id
                for source in job.checkpoint.sources
                if source.status in {"grounded", "inspected"}
            }
            public = {
                source.id
                for source in job.checkpoint.sources
                if source.url and source.status == "inspected"
            }
            if not set(plan.source_ids).issubset(actual) or len(set(plan.source_ids) & public) < 2:
                raise JobStateError(
                    "RESEARCH_INCOMPLETE",
                    "Research needs two different inspected public learning sources",
                )
            async with self.repositories() as repo:
                await repo._claimed(claim)
                successful_search = await repo.session.scalar(
                    select(RoadmapToolReceipt.operation_key)
                    .where(
                        RoadmapToolReceipt.job_id == job.id,
                        RoadmapToolReceipt.stage == "research",
                        RoadmapToolReceipt.operation_key.like("tool:search_web:%"),
                        RoadmapToolReceipt.result.is_not(None),
                    )
                    .limit(1)
                )
                if successful_search is None:
                    raise JobStateError("RESEARCH_INCOMPLETE", "Research must use grounded search")
            inventory_ids = [topic.id for topic in job.checkpoint.coverage_topics]
            if len(set(inventory_ids)) != len(inventory_ids) or any(
                not set(topic.source_ids).issubset(actual)
                for topic in job.checkpoint.coverage_topics
            ):
                raise JobStateError(
                    "RESEARCH_INCOMPLETE",
                    "Each coverage topic needs a unique identity and recorded reference evidence",
                )
            pending = job.checkpoint.pending_inventory_review
            if pending and job.checkpoint.pending_inventory_stage == "research":
                try:
                    saved_review = ResearchReview.model_validate(pending)
                except ValidationError:
                    saved_review = None
            else:
                saved_review = None
            reviewed = saved_review or ResearchReview(
                source_ids=plan.source_ids,
                coverage_notes=plan.coverage_notes,
                coverage_topics=job.checkpoint.coverage_topics,
                reference_dispositions=job.checkpoint.reference_dispositions,
            )
            prior_review_issues = job.checkpoint.validation_repair_issues
            if prior_review_issues:
                indexed_labels = [
                    (d.source_id, d.label_index) for d in reviewed.reference_dispositions
                ]
                repaired_indices = {
                    int(match.group(1))
                    for issue in prior_review_issues
                    if (match := re.search(r"label_(\d+)", issue))
                    if int(match.group(1)) < len(indexed_labels)
                }
                targets = {indexed_labels[index] for index in repaired_indices}
                await self._complete_reference_map(
                    reviewed,
                    job,
                    claim,
                    tools,
                    only_labels=targets or None,
                    force=not targets,
                    repair=prior_review_issues,
                )
                job.checkpoint.validation_repair_issues = []
            else:
                await self._complete_reference_map(reviewed, job, claim, tools)
            missing_concepts = [
                disposition
                for disposition in reviewed.reference_dispositions
                if disposition.kind == "concept" and not disposition.topic_ids
            ]
            if missing_concepts:
                labels_by_source = {
                    source.id: source.provenance.get("diagramLabels", [])
                    for source in job.checkpoint.sources
                    if isinstance(source.provenance.get("diagramLabels"), list)
                }
                already_repaired = set(job.checkpoint.coverage_reference_repaired_labels)
                repairable = [
                    disposition
                    for disposition in missing_concepts
                    if f"{disposition.source_id}:{disposition.label_index}" not in already_repaired
                ]
                if repairable:
                    missing_competencies = [
                        {
                            "sourceId": disposition.source_id,
                            "labelIndex": disposition.label_index,
                            "label": labels_by_source[disposition.source_id][
                                disposition.label_index
                            ],
                            "reason": disposition.reason,
                        }
                        for disposition in repairable
                    ]
                    if (
                        len(job.checkpoint.coverage_topics) + len(missing_competencies)
                        > MAX_COVERAGE_TOPICS
                    ):
                        raise JobStateError(
                            "REFERENCE_COVERAGE_INCOMPLETE",
                            "Reference comparison found more distinct competencies than the roadmap limit allows.",
                        )
                    area_titles = [area.title for area in plan.areas]
                    known_ids = {topic.id for topic in job.checkpoint.coverage_topics}
                    actual_sources = {
                        source.id
                        for source in job.checkpoint.sources
                        if source.status in {"grounded", "inspected"}
                    }

                    def repair_issues(batch: CoverageTopicBatch) -> list[str]:
                        ids = [topic.id for topic in batch.coverage_topics]
                        if len(ids) != len(set(ids)) or known_ids.intersection(ids):
                            return ["Use a unique new ID for every missing competency."]
                        if len(batch.coverage_topics) != len(missing_competencies):
                            return ["Return exactly one topic for every listed missing competency."]
                        if any(topic.area not in area_titles for topic in batch.coverage_topics):
                            return ["Each topic area must match one of task.areas exactly."]
                        if any(
                            not set(topic.source_ids).issubset(actual_sources)
                            for topic in batch.coverage_topics
                        ):
                            return ["Use only actual recorded source IDs."]
                        return []

                    added = await self._typed(
                        stage,
                        CoverageTopicBatch,
                        job,
                        claim,
                        tools,
                        task={
                            "mode": "reference_topic_repair",
                            "missingCompetencies": missing_competencies,
                            "areas": area_titles,
                            "sourceIds": sorted(actual_sources),
                        },
                        check_output=repair_issues,
                    )
                    job.checkpoint.coverage_topics.extend(added.coverage_topics)
                    reviewed.coverage_topics = job.checkpoint.coverage_topics
                    job.checkpoint.coverage_reference_topics_added = True
                    job.checkpoint.coverage_reference_repaired_labels.extend(
                        f"{disposition.source_id}:{disposition.label_index}"
                        for disposition in repairable
                    )
                    job.checkpoint.pending_inventory_review = reviewed.model_dump(
                        mode="json", by_alias=True
                    )
                    job.checkpoint.pending_inventory_stage = "research"
                    await self._save_partial(
                        job,
                        claim,
                        f"Added {len(added.coverage_topics)} missing reference competencies",
                    )
                targets = {
                    (disposition.source_id, disposition.label_index)
                    for disposition in missing_concepts
                }
                await self._complete_reference_map(reviewed, job, claim, tools, only_labels=targets)
            structural_issues = reference_coverage_issues(reviewed, job.checkpoint.sources)
            merged_topic_ids = {
                issue.split("] ", 1)[1].split(":", 1)[0]
                for issue in structural_issues
                if issue.startswith("[MERGED_REFERENCE] ")
            }
            if merged_topic_ids:
                labels_by_source = {
                    source.id: source.provenance.get("diagramLabels", [])
                    for source in job.checkpoint.sources
                    if isinstance(source.provenance.get("diagramLabels"), list)
                }
                topic_by_id = {topic.id: topic for topic in reviewed.coverage_topics}
                by_topic: dict[str, dict[str, list[ReferenceDisposition]]] = {}
                for disposition in reviewed.reference_dispositions:
                    if disposition.kind != "concept":
                        continue
                    labels = labels_by_source.get(disposition.source_id, [])
                    if disposition.label_index >= len(labels):
                        continue
                    label = " ".join(str(labels[disposition.label_index]).casefold().split())
                    for topic_id in disposition.topic_ids:
                        if topic_id in merged_topic_ids:
                            by_topic.setdefault(topic_id, {}).setdefault(label, []).append(
                                disposition
                            )
                split_targets: dict[tuple[str, int], tuple[str, str]] = {}
                for topic_id, labels in by_topic.items():
                    for dispositions in list(labels.values())[1:]:
                        for disposition in dispositions:
                            split_targets[(disposition.source_id, disposition.label_index)] = (
                                topic_id,
                                str(
                                    labels_by_source[disposition.source_id][disposition.label_index]
                                ),
                            )

                def repair_key(pair: tuple[str, int]) -> str:
                    return f"{pair[0]}:{pair[1]}"

                pending_splits = [
                    (pair, data)
                    for pair, data in split_targets.items()
                    if repair_key(pair) not in job.checkpoint.coverage_reference_repaired_labels
                ]
                if len(reviewed.coverage_topics) + len(pending_splits) > MAX_COVERAGE_TOPICS:
                    raise JobStateError(
                        "REFERENCE_COVERAGE_INCOMPLETE",
                        "Distinct reference concepts exceed the maximum inventory size.",
                    )
                for start in range(0, len(pending_splits), 40):
                    split_batch = pending_splits[start : start + 40]
                    repair_entries = []
                    for pair, (parent_id, label) in split_batch:
                        parent = topic_by_id[parent_id]
                        repair_entries.append(
                            {
                                "sourceId": pair[0],
                                "labelIndex": pair[1],
                                "label": label,
                                "reason": f"Separate competency currently merged into {parent.title}.",
                                "requiredArea": parent.area,
                                "requiredTopicId": f"reference_{hashlib.sha1(pair[0].encode()).hexdigest()[:8]}_{pair[1]}",
                                "sourceIds": sorted(actual),
                            }
                        )
                    required_ids = [entry["requiredTopicId"] for entry in repair_entries]

                    def split_issues(batch: CoverageTopicBatch) -> list[str]:
                        if [topic.id for topic in batch.coverage_topics] != required_ids:
                            return [
                                "Return one distinct topic for each entry with its exact requiredTopicId, in order."
                            ]
                        if any(
                            topic.area != entry["requiredArea"]
                            or not set(topic.source_ids).issubset(set(entry["sourceIds"]))
                            for topic, entry in zip(
                                batch.coverage_topics, repair_entries, strict=True
                            )
                        ):
                            return [
                                "Copy the exact requiredArea and use only the entry's recorded sourceIds."
                            ]
                        return []

                    added = await self._typed(
                        stage,
                        CoverageTopicBatch,
                        job,
                        claim,
                        tools,
                        task={
                            "mode": "reference_topic_repair",
                            "missingCompetencies": repair_entries,
                            "areas": [area.title for area in plan.areas],
                            "sourceIds": sorted(actual),
                        },
                        check_output=split_issues,
                    )
                    reviewed.coverage_topics.extend(added.coverage_topics)
                    job.checkpoint.coverage_topics = reviewed.coverage_topics
                    job.checkpoint.coverage_reference_repaired_labels.extend(
                        repair_key(pair) for pair, _ in split_batch
                    )
                    job.checkpoint.pending_inventory_review = reviewed.model_dump(
                        mode="json", by_alias=True
                    )
                    job.checkpoint.pending_inventory_stage = "research"
                    await self._save_partial(
                        job,
                        claim,
                        f"Separated {len(added.coverage_topics)} merged reference concepts",
                    )
                if split_targets:
                    for disposition in reviewed.reference_dispositions:
                        if (disposition.source_id, disposition.label_index) in split_targets:
                            disposition.topic_ids = []
                    await self._save_partial(
                        job, claim, "Saving separate reference concept mappings"
                    )
                    await self._complete_reference_map(
                        reviewed,
                        job,
                        claim,
                        tools,
                        only_labels=set(split_targets),
                        repair=structural_issues,
                    )
            job.checkpoint.reference_dispositions = reviewed.reference_dispositions
            await self._save_partial(
                job, claim, "Reference label mapping saved; checking concept coverage"
            )
            issues = reference_coverage_issues(reviewed, job.checkpoint.sources)
            if not issues:
                issues = await self._review_reference_dispositions(reviewed, job, claim, tools)
            if issues:
                job.checkpoint.validation_repair_issues = issues[:1000]
                job.checkpoint.pending_inventory_review = reviewed.model_dump(
                    mode="json", by_alias=True
                )
                job.checkpoint.pending_inventory_stage = "research"
                await self._save_partial(job, claim, "Reference coverage needs another review")
                raise JobStateError(
                    "REFERENCE_COVERAGE_INCOMPLETE",
                    "The researched inventory needs reference-label corrections. Retry to continue saved research.",
                    error=JobError(
                        code="REFERENCE_COVERAGE_INCOMPLETE",
                        message="The researched inventory needs reference-label corrections. Retry to continue saved research.",
                        recoverable=True,
                        next_action="retry",
                    ),
                )
            job.checkpoint.reference_dispositions = reviewed.reference_dispositions
            job.checkpoint.pending_inventory_review = None
            job.checkpoint.pending_inventory_stage = None
            job.checkpoint.coverage_reference_topics_added = False
            job.checkpoint.coverage_reference_repaired_labels = []
            return StageResult(
                checkpoint=job.checkpoint,
                summary="Compared learning sources and curriculum coverage",
            )
        if stage in {"compose", "personalize"}:
            if "research" not in job.checkpoint.completed_stages:
                raise JobStateError(
                    "RESEARCH_INCOMPLETE", "Complete researched evidence before composition"
                )
            job.checkpoint.candidate = self._candidate(
                await self._compose(job, claim, tools)
                if stage == "compose"
                else await self._personalize(job, claim, tools),
                job,
            )
            return StageResult(
                checkpoint=job.checkpoint,
                summary="Curriculum composed"
                if stage == "compose"
                else "Core path and weekly milestones planned",
            )
        assert stage == "validate"
        assert job.checkpoint.profile is not None
        if job.checkpoint.candidate is None:
            raise JobStateError("CURRICULUM_NOT_READY", "Compose a curriculum before validation")
        while True:
            if job.checkpoint.validation_repair_active:
                issues = job.checkpoint.validation_repair_issues
            else:
                report = validate_curriculum(
                    job.checkpoint.candidate, job.checkpoint.profile, job.checkpoint.sources
                )
                issues = [
                    f"[{issue.code}] {issue.item_id or 'curriculum'}: {issue.message}"
                    for issue in report.issues
                    if issue.severity == "error"
                ]
                issues.extend(
                    coverage_issues(job.checkpoint.candidate, job.checkpoint.coverage_topics)
                )
                if job.checkpoint.coverage_topics:
                    issues.extend(reference_coverage_issues(job.checkpoint, job.checkpoint.sources))
                    issues.extend(
                        resource_grounding_issues(job.checkpoint.candidate, job.checkpoint.sources)
                    )
                if report.valid and not issues:
                    review = await self._typed(stage, QualityReview, job, claim, tools)
                    issues.extend(review.issues)
                    if job.operation == "refine":
                        if job.checkpoint.original_candidate is None:
                            issues.append(
                                "Refinement must include its original curriculum for identity review"
                            )
                        else:
                            issues.extend(
                                identity_review_issues(
                                    job.checkpoint.original_candidate,
                                    job.checkpoint.candidate,
                                    review.identity_continuity,
                                )
                            )
                    if review.approved and not issues:
                        job.checkpoint.identity_continuity = review.identity_continuity
                        job.checkpoint.validation = report
                        return StageResult(
                            checkpoint=job.checkpoint,
                            summary="Curriculum structure, workload and source coverage verified",
                        )
                await self._begin_validation_repair(job, claim, issues)
            if job.checkpoint.validation_repair_phase != "personalize":
                candidate = await self._compose(job, claim, tools, repair=issues)
                job.checkpoint.candidate = self._candidate(candidate, job)
                job.checkpoint.validation_repair_phase = "personalize"
                await self._save_partial(
                    job, claim, "Corrected lessons prepared; planning the core path"
                )
            if job.checkpoint.coverage_topics:
                job.checkpoint.candidate = await self._personalize(job, claim, tools)
            job.checkpoint.validation = None
            job.checkpoint.validation_repair_active = False
            job.checkpoint.validation_repair_phase = None
            job.checkpoint.validation_repair_issues = []
            await self._save_partial(job, claim, "Curriculum repairs prepared for review")
