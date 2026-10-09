"""Production composition root; no offline mock-provider fallback for roadmap jobs."""

from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from ai_core.base import BaseLLMProvider, BaseTool, ModelConfig
from ai_core.providers import (
    AnthropicProvider,
    DeepSeekProvider,
    GeminiProvider,
    OllamaProvider,
    OpenAIProvider,
)
from config import Settings, get_settings
from schemas.roadmap_job import Claim, JobError, JobSnapshot, StageName, StageResult
from services.roadmap.job_repository import JobRepository, JobStateError
from services.roadmap.orchestrator import RoadmapStageExecutor as TypedStageExecutor
from services.roadmap.references import ReferenceService
from services.roadmap.search import GeminiSearchBackend
from services.roadmap.source_fetcher import SourceFetcher
from services.roadmap.tools import RoadmapToolContext, SessionFactory, build_roadmap_tools
from services.roadmap.workload import normalize_profile
from services.skill_service import SkillRegistry


def configured_provider(settings: Settings) -> BaseLLMProvider:
    name = settings.DEFAULT_PROVIDER.lower().strip()
    key = {
        "gemini": settings.GEMINI_API_KEY or settings.GOOGLE_API_KEY,
        "google": settings.GEMINI_API_KEY or settings.GOOGLE_API_KEY,
        "openai": settings.OPENAI_API_KEY,
        "anthropic": settings.ANTHROPIC_API_KEY,
        "claude": settings.ANTHROPIC_API_KEY,
        "deepseek": settings.DEEPSEEK_API_KEY,
    }.get(name)
    classes: dict[str, type[BaseLLMProvider]] = {
        "gemini": GeminiProvider,
        "google": GeminiProvider,
        "openai": OpenAIProvider,
        "anthropic": AnthropicProvider,
        "claude": AnthropicProvider,
        "deepseek": DeepSeekProvider,
    }
    if name == "ollama":
        return OllamaProvider(base_url=settings.OLLAMA_BASE_URL)
    if name not in classes or not key:
        raise JobStateError(
            "MODEL_NOT_CONFIGURED",
            error=JobError(
                code="MODEL_NOT_CONFIGURED",
                message="Configure the selected roadmap generation provider and retry.",
                recoverable=True,
                next_action="retry",
            ),
        )
    return classes[name](api_key=key)


class RoadmapStageExecutor:
    def __init__(
        self, session_factory: SessionFactory, *, settings: Settings | None = None
    ) -> None:
        self.sessions = session_factory
        self.settings = settings or get_settings()
        self.skills = SkillRegistry(scope="roadmap")

    @asynccontextmanager
    async def repository(self) -> AsyncIterator[JobRepository]:
        async with self.sessions() as session:
            yield JobRepository(session, settings=self.settings)
            await session.commit()

    def tools(self, job: JobSnapshot, claim: Claim) -> dict[str, BaseTool]:
        return build_roadmap_tools(
            RoadmapToolContext(
                job.id,
                job.owner_id,
                claim,
                job.checkpoint.profile or normalize_profile(job.request),
                job.checkpoint,
                self.sessions,
                lambda session: ReferenceService(
                    session, Path(self.settings.ROADMAP_REFERENCE_DIR)
                ),
                SourceFetcher(),
                GeminiSearchBackend(
                    self.settings.GEMINI_API_KEY or self.settings.GOOGLE_API_KEY or "",
                    self.settings.ROADMAP_SEARCH_MODEL,
                ),
                self.skills,
            )
        )

    async def run(self, stage: StageName, job: JobSnapshot, claim: Claim) -> StageResult:
        # Missing configuration becomes a recoverable job error, never a mock curriculum.
        provider = configured_provider(self.settings)
        executor = TypedStageExecutor(
            provider,
            ModelConfig(
                model_name=self.settings.DEFAULT_MODEL,
                temperature=0.2,
                max_tokens=65536,
                max_retries=0,
                metadata={"thinking_budget": 2048}
                if isinstance(provider, GeminiProvider)
                and self.settings.DEFAULT_MODEL.startswith("gemini-2.5")
                else {},
            ),
            self.tools,
            self.repository,
        )
        try:
            return await executor.run(stage, job, claim)
        finally:
            client = getattr(provider, "client", None)
            if isinstance(provider, GeminiProvider) and client is not None:
                await client.aio.aclose()
            elif client is not None:
                await client.close()
