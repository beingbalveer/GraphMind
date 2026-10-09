import hashlib
import json
import re
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, cast
from urllib.parse import unquote_plus, urlsplit

from ai_core.base import BaseTool
from models.roadmap_job import RoadmapJobReference, RoadmapToolReceipt
from pydantic import Field, JsonValue
from schemas.curriculum import CurriculumSchema, LearningProfile, SourceData
from schemas.roadmap_job import (
    MAX_COVERAGE_TOPICS,
    Claim,
    JobCheckpoint,
    JobError,
    ReferenceSection,
)
from services.file_service import bounded_utf8
from services.roadmap.coverage import select_core
from services.roadmap.job_repository import JobRepository, JobStateError
from services.roadmap.references import ReferenceError, ReferenceService
from services.roadmap.search import SearchBackend, SearchResponse
from services.roadmap.source_fetcher import SourceFetcher, SourceFetchError, canonical_source_url
from services.roadmap.validation import validate_curriculum
from services.roadmap.workload import schedule_core, selected_core_topics
from services.skill_service import SkillRegistry
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

TOOL_NAMES = {
    "search_web",
    "fetch_source",
    "read_reference",
    "list_skills",
    "load_skill",
    "validate_curriculum",
    "calculate_workload",
}
SessionFactory = Callable[[], AsyncSession]


class EmptyArgs(CurriculumSchema):
    pass


class WorkloadArgs(CurriculumSchema):
    core_topic_ids: list[str] | None = Field(
        default=None, min_length=1, max_length=MAX_COVERAGE_TOPICS
    )


class SearchArgs(CurriculumSchema):
    query: str = Field(min_length=1, max_length=500)


class SourceArgs(CurriculumSchema):
    url: str = Field(min_length=1, max_length=2048)


class ReferenceArgs(CurriculumSchema):
    reference_id: str = Field(min_length=1, max_length=64)
    locator: str | None = Field(default=None, max_length=1000)


class SkillArgs(CurriculumSchema):
    name: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,64}$")


@dataclass
class RoadmapToolContext:
    job_id: str
    owner_id: str
    claim: Claim
    profile: LearningProfile | None
    checkpoint: JobCheckpoint
    session_factory: SessionFactory
    references: Callable[[AsyncSession], ReferenceService]
    source_fetcher: SourceFetcher
    search_backend: SearchBackend
    skill_registry: SkillRegistry
    clock: Callable[[], datetime] | None = None
    last_error: JobError | None = None


class RoadmapTool(BaseTool):
    def __init__(
        self,
        name: str,
        description: str,
        schema: type[CurriculumSchema],
        context: RoadmapToolContext,
    ) -> None:
        self.name = name
        self.description = description
        self.parameters_schema = schema
        self.context = context

    def _repo(self, session: AsyncSession) -> JobRepository:
        return JobRepository(session, clock=self.context.clock)

    async def _authorize(self, repo: JobRepository) -> None:
        row, _ = await repo._claimed(self.context.claim)
        if row.id != self.context.job_id or row.owner_id != self.context.owner_id:
            raise JobStateError("JOB_NOT_FOUND", "Roadmap job not found")

    def _key(self, arguments: dict[str, Any]) -> str:
        payload: dict[str, Any] = {"tool": self.name, "arguments": arguments}
        if self.name in {"validate_curriculum", "calculate_workload"}:
            payload.update(
                {
                    "profile": self.context.profile.model_dump(mode="json")
                    if self.context.profile
                    else None,
                    "candidate": self.context.checkpoint.candidate.model_dump(mode="json")
                    if self.context.checkpoint.candidate
                    else None,
                    "sources": [
                        source.model_dump(mode="json") for source in self.context.checkpoint.sources
                    ],
                }
            )
        digest = hashlib.sha256(
            json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()
        return f"tool:{self.name}:{digest}"

    async def _private_query(
        self, query: str, *, code: str = "PRIVATE_SEARCH_QUERY", public_dates: bool = False
    ) -> set[str]:
        identifiers = (
            re.sub(r"(?<!\d)\d{4}-\d{2}-\d{2}(?!\d)", "", query) if public_dates else query
        )
        if re.search(
            r"[\w.+-]+@[\w.-]+\.\w+|(?:sk-|ghp_|AIza|AKIA)[A-Za-z0-9_-]{12,}|\b(?:usr_|job_|ref_)[a-f0-9]{8,}|(?:\+?\d[\d ()-]{7,}\d)",
            identifiers,
        ):
            raise JobStateError(
                code, "Use public subject keywords or source URLs without private identifiers"
            )
        private_text = [self.context.profile.background or ""] if self.context.profile else []
        private_text.extend(self.context.checkpoint.clarification_answers)
        async with self.context.session_factory() as session:
            await self._authorize(self._repo(session))
            references = (
                await session.scalars(
                    select(RoadmapJobReference).where(
                        RoadmapJobReference.job_id == self.context.job_id
                    )
                )
            ).all()
            reference_urls = {
                reference.url
                for reference in references
                if reference.kind == "link" and reference.url
            }
            for reference in references:
                private_text.extend(
                    ReferenceSection.model_validate(section).text for section in reference.sections
                )
            await session.commit()
        words = re.findall(r"\w+", query.lower())
        phrases = {" ".join(words[index : index + 4]) for index in range(max(0, len(words) - 3))}
        for value in private_text:
            normalized = " ".join(re.findall(r"\w+", value.lower()))
            if any(phrase in normalized for phrase in phrases):
                raise JobStateError(
                    code,
                    "Do not copy private background or reference text into external requests",
                )

        return reference_urls

    async def _private_source_url(self, url: str) -> None:
        decoded = url
        for _ in range(len(url) + 1):
            value = unquote_plus(decoded)
            if value == decoded:
                break
            decoded = value
        # Exclude ISO publication dates only from identifier detection, not private-copy checks.
        reference_urls = await self._private_query(
            decoded, code="PRIVATE_SOURCE_URL", public_dates=True
        )
        if urlsplit(url).query:
            registered = reference_urls | {
                source.url for source in self.context.checkpoint.sources if source.url
            }
            if canonical_source_url(url) not in {
                canonical_source_url(value) for value in registered
            }:
                raise JobStateError(
                    "SOURCE_URL_NOT_REGISTERED",
                    "Search for this exact source URL first, or use a user-provided reference link.",
                )

    async def _reserve(self, key: str, arguments: dict[str, Any]) -> JsonValue | None:
        async with self.context.session_factory() as session:
            repo = self._repo(session)
            await self._authorize(repo)
            receipt = await repo.get_receipt(self.context.claim, key)
            if receipt is not None:
                await session.commit()
                return cast(JsonValue, receipt["data"])
            if self.name == "search_web":
                self.context.search_backend.require_configured()
                await repo.charge(self.context.claim, "model", key)
                await repo.charge(self.context.claim, "search", key)
            elif self.name == "fetch_source" and not self._known_source(arguments["url"]):
                await repo.charge(self.context.claim, "fetch", key)
            else:
                existing = await session.get(
                    RoadmapToolReceipt, (self.context.job_id, self.context.claim.stage, key)
                )
                if existing is None:
                    session.add(
                        RoadmapToolReceipt(
                            job_id=self.context.job_id,
                            stage=self.context.claim.stage,
                            operation_key=key,
                            reservations={},
                        )
                    )
                    await session.flush()
            await session.commit()
            return None

    def _known_source(self, url: str) -> SourceData | None:
        canonical = canonical_source_url(url)
        return next(
            (
                source
                for source in self.context.checkpoint.sources
                if source.url == canonical
                and source.status == "inspected"
                and source.provenance.get("evidenceJobId") == self.context.job_id
            ),
            None,
        )

    def _source_id(self, value: str) -> str:
        return f"src_{uuid.uuid5(uuid.NAMESPACE_URL, f'{self.context.job_id}:{value}').hex}"

    def _remember_source(self, source: SourceData) -> None:
        values = self.context.checkpoint.sources
        index = next(
            (index for index, existing in enumerate(values) if existing.id == source.id),
            None,
        )
        if index is None:
            values.append(source)
        elif values[index].status != "inspected" or source.status == "inspected":
            values[index] = source.model_copy(
                update={"provenance": {**values[index].provenance, **source.provenance}}
            )

    def _observe(self, data: JsonValue) -> None:
        if self.name == "search_web":
            response = SearchResponse.model_validate(data)
            for result in response.results:
                if result.provenance.get("supported") and result.snippet:
                    self._remember_source(
                        SourceData(
                            id=self._source_id(result.url),
                            title=result.title,
                            url=result.url,
                            status="grounded",
                            kind="web",
                            access="unknown",
                            evidence=bounded_utf8(result.snippet, 32768),
                            verified_at=response.searched_at,
                            provenance={
                                **result.provenance,
                                "provider": response.provider,
                                "attributionHtml": response.attribution_html,
                                "evidenceJobId": self.context.job_id,
                            },
                        )
                    )
        elif self.name in {"fetch_source", "read_reference"}:
            source = SourceData.model_validate(
                data
                if self.name == "fetch_source"
                else data["source"]
                if isinstance(data, dict)
                else None
            )
            self._remember_source(source)
        elif self.name == "load_skill" and isinstance(data, dict):
            name = data.get("name")
            if isinstance(name, str) and name not in self.context.checkpoint.loaded_skills:
                self.context.checkpoint.loaded_skills.append(name)

    async def _perform(self, arguments: dict[str, Any]) -> JsonValue:
        if self.name == "search_web":
            response = await self.context.search_backend.search(arguments["query"])
            for result in response.results:
                if result.provenance.get("supported") and result.snippet:
                    result.provenance = {
                        **result.provenance,
                        "sourceId": self._source_id(result.url),
                    }
            return cast(JsonValue, response.model_dump(mode="json", by_alias=True))
        if self.name == "fetch_source":
            existing = self._known_source(arguments["url"])
            source = existing or await self.context.source_fetcher.fetch(arguments["url"])
            if existing is None:
                original = canonical_source_url(arguments["url"])
                same_job = next(
                    (
                        value
                        for value in self.context.checkpoint.sources
                        if value.provenance.get("evidenceJobId") == self.context.job_id
                        and value.url in {source.url, original}
                    ),
                    None,
                )
                source = source.model_copy(
                    update={
                        "id": same_job.id
                        if same_job
                        else self._source_id(source.url or arguments["url"]),
                        "provenance": {
                            **(same_job.provenance if same_job else {}),
                            **source.provenance,
                            "evidenceJobId": self.context.job_id,
                        },
                    }
                )
            return cast(JsonValue, source.model_dump(mode="json", by_alias=True))
        if self.name == "read_reference":
            async with self.context.session_factory() as session:
                await self._authorize(self._repo(session))
                sections = await self.context.references(session).read(
                    self.context.job_id, self.context.owner_id, arguments["reference_id"]
                )
                record = await session.get(RoadmapJobReference, arguments["reference_id"])
                assert record is not None
                title = record.name
                await session.commit()
            locator = arguments.get("locator")
            selected = [
                section for section in sections if locator is None or section.locator == locator
            ]
            if not selected:
                raise ReferenceError(
                    "REFERENCE_UNAVAILABLE", "This reference has no readable text at that locator"
                )
            evidence = bounded_utf8(
                "\n\n".join(f"[{section.locator}]\n{section.text}" for section in selected), 32768
            )
            source = SourceData(
                id=self._source_id(f"{arguments['reference_id']}:{locator or 'overview'}"),
                title=title,
                reference_id=arguments["reference_id"],
                locator=locator or selected[0].locator,
                kind="reference",
                status="inspected",
                access="unknown",
                evidence=evidence,
                verified_at=self.context.clock()
                if self.context.clock
                else datetime.now(timezone.utc),
                provenance={
                    "trust": "untrusted_evidence",
                    "evidenceJobId": self.context.job_id,
                    "sectionsAvailable": [section.locator for section in sections],
                    "extractionLimited": sum(len(section.text.encode()) for section in selected)
                    > 32768,
                },
            )
            return {"source": source.model_dump(mode="json", by_alias=True)}
        if self.name == "list_skills":
            return {
                "skills": [
                    entry
                    for entry in self.context.skill_registry.list_skills()
                    if set(entry["required_tools"]).issubset(TOOL_NAMES)
                ]
            }
        if self.name == "load_skill":
            skill = self.context.skill_registry.get(arguments["name"])
            if skill is None or not set(skill.required_tools).issubset(TOOL_NAMES):
                raise JobStateError(
                    "SKILL_UNAVAILABLE", "Choose an available registered roadmap skill"
                )
            return {
                "name": skill.name,
                "content": skill.render_prompt_section(),
                "requiredTools": [name for name in skill.required_tools],
            }
        candidate = self.context.checkpoint.candidate
        profile = self.context.profile
        if candidate is None or profile is None:
            raise JobStateError(
                "CURRICULUM_NOT_READY", "Compose a curriculum before checking its workload"
            )
        if arguments.get("core_topic_ids") is not None:
            try:
                candidate = select_core(
                    candidate, arguments["core_topic_ids"], candidate.outcome, candidate.assumptions
                )
                candidate.sessions = schedule_core(candidate, profile)
            except ValueError as error:
                raise JobStateError("INVALID_CORE_PROPOSAL", str(error)) from None
        report = validate_curriculum(candidate, profile, self.context.checkpoint.sources)
        if self.name == "validate_curriculum":
            return cast(JsonValue, report.model_dump(mode="json", by_alias=True))
        return {
            "coreMinutes": report.core_minutes,
            "capacityMinutes": report.capacity_minutes,
            "selectedTopicIds": [topic.id for topic in selected_core_topics(candidate)],
            "sessions": [
                session.model_dump(mode="json", by_alias=True)
                for session in schedule_core(candidate, profile)
            ],
        }

    async def _update_link(
        self,
        session: AsyncSession,
        url: str,
        *,
        source: SourceData | None = None,
        error: str | None = None,
    ) -> None:
        rows = (
            await session.scalars(
                select(RoadmapJobReference)
                .where(
                    RoadmapJobReference.job_id == self.context.job_id,
                    RoadmapJobReference.kind == "link",
                    RoadmapJobReference.url == canonical_source_url(url),
                )
                .with_for_update()
            )
        ).all()
        for row in rows:
            if source is not None:
                row.status = "inspected"
                row.name = source.title[:255]
                row.sections = [
                    ReferenceSection(
                        reference_id=row.id,
                        locator=source.locator or "Page text",
                        text=source.evidence,
                    ).model_dump(mode="json")
                ]
                row.error = (
                    "Inspection limit reached; evidence is a bounded excerpt."
                    if source.provenance.get("extractionLimited")
                    else None
                )
            else:
                row.status = "unavailable"
                row.error = error
        await session.flush()

    async def execute(self, **kwargs: Any) -> JsonValue:
        assert self.parameters_schema is not None
        arguments = self.parameters_schema.model_validate(kwargs).model_dump()
        key = self._key(arguments)
        try:
            if self.name == "search_web":
                await self._private_query(arguments["query"])
            elif self.name == "fetch_source":
                await self._private_source_url(arguments["url"])
            replay = await self._reserve(key, arguments)
            if replay is not None:
                self._observe(replay)
                self.context.last_error = None
                return replay
            data = await self._perform(arguments)
            async with self.context.session_factory() as session:
                repo = self._repo(session)
                await self._authorize(repo)
                await repo.save_receipt(self.context.claim, key, {"data": data})
                metadata: dict[str, JsonValue] = {"tool": self.name}
                if self.name == "fetch_source":
                    source = SourceData.model_validate(data)
                    await self._update_link(session, arguments["url"], source=source)
                    metadata.update({"sourceUrl": source.url, "sourceTitle": source.title})
                    if source.provenance.get("extractionLimited"):
                        await repo.append_event(
                            self.context.job_id,
                            "extraction_limit",
                            "A source inspection reached its evidence limit",
                            {"tool": self.name},
                        )
                elif self.name == "search_web":
                    search = SearchResponse.model_validate(data)
                    metadata.update({"provider": search.provider, "count": len(search.results)})
                elif self.name == "read_reference":
                    metadata["referenceId"] = arguments["reference_id"]
                elif self.name == "load_skill":
                    metadata["skill"] = arguments["name"]
                await repo.append_event(
                    self.context.job_id,
                    "tool_completed",
                    {
                        "search_web": "Searched public learning resources",
                        "fetch_source": "Inspected a public source",
                        "read_reference": "Read an uploaded reference",
                        "list_skills": "Reviewed available roadmap skills",
                        "load_skill": "Loaded a registered roadmap skill",
                        "validate_curriculum": "Checked curriculum structure",
                        "calculate_workload": "Calculated learning effort",
                    }[self.name],
                    metadata,
                )
                await session.commit()
            self._observe(data)
            self.context.last_error = None
            return data
        except (JobStateError, ReferenceError, SourceFetchError) as error:
            self.context.last_error = (
                error.error
                if isinstance(error, JobStateError)
                else JobError(
                    code=error.code,
                    message=str(error)[:500],
                    recoverable=error.code in {"SOURCE_TIMEOUT", "SOURCE_UNAVAILABLE"},
                    next_action="retry"
                    if error.code in {"SOURCE_TIMEOUT", "SOURCE_UNAVAILABLE"}
                    else "new_run",
                )
            )
            try:
                async with self.context.session_factory() as session:
                    repo = self._repo(session)
                    await self._authorize(repo)
                    if self.name == "fetch_source" and isinstance(error, SourceFetchError):
                        await self._update_link(session, arguments["url"], error=str(error)[:500])
                    await repo.append_event(
                        self.context.job_id,
                        "tool_failed",
                        "A research tool could not complete this step",
                        {"tool": self.name, "code": self.context.last_error.code},
                    )
                    await session.commit()
            except JobStateError:
                pass  # Cancellation or fencing already owns the terminal state.
            raise
        except Exception:
            self.context.last_error = JobError(
                code="TOOL_UNAVAILABLE",
                message="This tool is temporarily unavailable",
                recoverable=True,
                next_action="retry",
            )
            raise JobStateError("TOOL_UNAVAILABLE", error=self.context.last_error) from None


def build_roadmap_tools(context: RoadmapToolContext) -> dict[str, BaseTool]:
    specs: dict[str, tuple[str, type[CurriculumSchema]]] = {
        "search_web": (
            "Search public curricula using topical keywords; never disclose private reference text",
            SearchArgs,
        ),
        "fetch_source": ("Inspect a public HTTP source as untrusted evidence", SourceArgs),
        "read_reference": (
            "Read an owner-scoped staged reference; optionally choose a listed page/section locator",
            ReferenceArgs,
        ),
        "list_skills": ("List registered procedural roadmap skills", EmptyArgs),
        "load_skill": (
            "Load a registered application playbook, never a URL or file path",
            SkillArgs,
        ),
        "validate_curriculum": (
            "Validate the saved map or a proposed coreTopicIds selection without changing the map",
            WorkloadArgs,
        ),
        "calculate_workload": (
            "Calculate effort and sessions for proposed coreTopicIds without changing the saved map; omit IDs to check the current core",
            WorkloadArgs,
        ),
    }
    return {
        name: RoadmapTool(name, description, schema, context)
        for name, (description, schema) in specs.items()
    }
