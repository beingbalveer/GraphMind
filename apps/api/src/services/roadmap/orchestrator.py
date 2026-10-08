import asyncio
import uuid
from collections.abc import Awaitable, Callable
from contextlib import AbstractAsyncContextManager
from typing import TypeVar

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
from pydantic import ValidationError
from schemas.curriculum import (
    CurriculumCandidate,
    CurriculumSchema,
    LearningProfile,
    RoadmapRequest,
)
from schemas.roadmap_job import Claim, JobSnapshot, StageName, StageResult
from services.roadmap.job_repository import JobRepository, JobStateError
from services.roadmap.prompts import QualityReview, ResearchReview, Understanding, stage_messages
from services.roadmap.revision_service import identity_review_issues
from services.roadmap.tools import RoadmapTool
from services.roadmap.validation import validate_curriculum
from services.roadmap.workload import WorkloadError, normalize_profile, schedule_core
from sqlalchemy import select
from structlog import get_logger

T = TypeVar("T", bound=CurriculumSchema)
RepositoryFactory = Callable[[], AbstractAsyncContextManager[JobRepository]]
ToolsFactory = Callable[[JobSnapshot, Claim], dict[str, BaseTool]]
MODEL_RESPONSE_TIMEOUT_SECONDS = 180
logger = get_logger()


async def run_tool_cycle(
    provider: BaseLLMProvider,
    config: ModelConfig,
    messages: list[ChatMessage],
    tools: dict[str, BaseTool],
    *,
    before_call: Callable[[], Awaitable[None]],
    save_receipt: Callable[[ToolCall, ToolResult], Awaitable[None]],
) -> GenerationResult:
    for _ in range(48):
        await before_call()
        try:
            async with asyncio.timeout(MODEL_RESPONSE_TIMEOUT_SECONDS):
                result = await provider.generate(
                    messages, config, tools=list(tools.values()) or None
                )
        except TimeoutError as error:
            raise TimeoutError(
                f"Roadmap model response exceeded {MODEL_RESPONSE_TIMEOUT_SECONDS} seconds"
            ) from error
        if not result.tool_calls:
            return result
        if len(result.tool_calls) > 40:
            raise JobStateError("TOOL_CALL_LIMIT", "Use fewer research tools in each step")
        messages.append(ChatMessage.assistant(result.content, tool_calls=result.tool_calls))
        for call in result.tool_calls:
            tool = tools.get(call.name)
            tool_result = (
                await tool.run(call.arguments, call.id)
                if tool
                else ToolResult(
                    tool_call_id=call.id,
                    name=call.name,
                    content="Tool unavailable for this job",
                    is_error=True,
                )
            )
            await save_receipt(call, tool_result)
            messages.append(ChatMessage.tool(tool_result.content, call.id, call.name))
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

    async def _charge(self, claim: Claim, category: str = "model") -> None:
        async with self.repositories() as repo:
            if category == "repair":
                current = await repo.read(claim.job_id, (await repo._claimed(claim))[0].owner_id)
                if current.usage.repair_attempts >= min(3, current.limits.repair_attempts):
                    raise JobStateError(
                        "REPAIR_LIMIT", "This roadmap needs a narrower goal. Start a new run."
                    )
                await repo.charge(claim, "repair", f"repair:{uuid.uuid4().hex}")
                await repo.append_event(
                    claim.job_id, "repair_started", "Refining curriculum quality", {}
                )
            else:
                await repo.charge(claim, "model", f"model:{uuid.uuid4().hex}")

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
    ) -> T:
        messages = stage_messages(
            stage, job, schema, await self._references(job, claim), repair=repair
        )
        skill_name = {
            "research": "source-review",
            "compose": "curriculum-design",
            "personalize": "workload-planning",
        }.get(stage)
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
                if error and (
                    error.next_action == "configure_search"
                    or error.code in {"BUDGET_EXHAUSTED", "STALE_LEASE", "JOB_NOT_FOUND"}
                ):
                    raise JobStateError(error.code, error.message, error=error)

        for attempt in range(3):
            result = await run_tool_cycle(
                self.provider, self.config, messages, tools, before_call=before, save_receipt=save
            )
            await self._check(claim)
            try:
                content = result.content.strip()
                if content.startswith("```json") and content.endswith("```"):
                    content = content[7:-3].strip()
                return schema.model_validate_json(content)
            except ValidationError as error:
                errors = [
                    f"{'.'.join(str(part) for part in detail['loc']) or '$'} "
                    f"[{detail['type']}]: {detail['msg'][:200]}"
                    for detail in error.errors(include_input=False, include_context=False)[:30]
                ]
                logger.warning(
                    "roadmap_stage_schema_rejected", job_id=job.id, stage=stage, issues=errors
                )
                if attempt == 2:
                    raise JobStateError(
                        "STAGE_OUTPUT_INVALID",
                        "The agent could not produce a valid roadmap. Try a more specific goal.",
                    ) from None
                messages.extend(
                    [
                        ChatMessage.assistant(result.content),
                        ChatMessage.user(
                            "The output did not match the required JSON schema. Correct these "
                            "fields and return complete JSON; do not invent evidence:\n"
                            + "\n".join(errors)
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
            reviewed = await self._typed(stage, ResearchReview, job, claim, tools)
            actual = {
                source.id
                for source in job.checkpoint.sources
                if source.status in {"grounded", "inspected"}
            }
            public = {
                source.id
                for source in job.checkpoint.sources
                if source.url and source.status in {"grounded", "inspected"}
            }
            if (
                not set(reviewed.source_ids).issubset(actual)
                or len(set(reviewed.source_ids) & public) < 2
            ):
                raise JobStateError(
                    "RESEARCH_INCOMPLETE",
                    "Research needs at least two usable public learning sources",
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
            job.checkpoint.coverage_notes = reviewed.coverage_notes
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
                await self._typed(stage, CurriculumCandidate, job, claim, tools), job
            )
            return StageResult(
                checkpoint=job.checkpoint,
                summary="Curriculum composed"
                if stage == "compose"
                else "Core path and weekly milestones planned",
            )
        assert stage == "validate"
        if job.checkpoint.candidate is None:
            raise JobStateError("CURRICULUM_NOT_READY", "Compose a curriculum before validation")
        while True:
            report = validate_curriculum(
                job.checkpoint.candidate, job.checkpoint.profile, job.checkpoint.sources
            )
            issues = [
                f"[{issue.code}] {issue.item_id or 'curriculum'}: {issue.message}"
                for issue in report.issues
                if issue.severity == "error"
            ]
            if report.valid:
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
            await self._charge(claim, "repair")
            candidate = await self._typed(
                "compose", CurriculumCandidate, job, claim, tools, repair=issues
            )
            job.checkpoint.candidate = self._candidate(candidate, job)
            job.checkpoint.validation = None
