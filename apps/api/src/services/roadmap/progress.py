import asyncio
import json
from typing import Literal

import structlog
from ai_core import ChatMessage, ModelConfig
from ai_core.base import BaseLLMProvider
from config import get_settings
from dependencies import require_workspace_read, require_workspace_write
from errors import RoadmapHTTPError
from fastapi import HTTPException
from models.roadmap import KnowledgeCheck, Roadmap, TopicProgress, utc_now
from models.user import User
from pydantic import Field
from schemas.curriculum import CurriculumSchema, KnowledgeCheckData, TopicProgressData
from schemas.roadmap_job import JobError
from services.roadmap.curriculum_repository import CurriculumRepository
from services.workspace_service import WorkspaceService
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()


class Assessment(CurriculumSchema):
    ready: bool
    criteria: list[str] = Field(min_length=1, max_length=8)
    rating: Literal["developing", "adequate", "strong"]
    strengths: list[str] = Field(max_length=8)
    gaps: list[str] = Field(max_length=8)
    next_step: str = Field(min_length=1, max_length=2000)


class ProgressService:
    def __init__(self, session: AsyncSession, *, provider: BaseLLMProvider | None = None) -> None:
        self.session = session
        self.provider = provider

    def repository(self, owner_id: str) -> CurriculumRepository:
        return CurriculumRepository(self.session, owner_id)

    async def authorize(self, workspace_id: str, owner_id: str, *, write: bool = True) -> None:
        user = await self.session.get(User, owner_id, populate_existing=True)
        if user is None:
            raise HTTPException(404, "Learner not found")
        if not user.is_active:
            raise HTTPException(401, "Learner account is inactive")
        authorize = require_workspace_write if write else require_workspace_read
        await authorize(workspace_id, user, self.session)

    async def set_status(
        self,
        workspace_id: str,
        topic_id: str,
        owner_id: str,
        status: Literal["not_started", "in_progress", "completed"],
        *,
        only_if_not_started: bool = False,
    ) -> TopicProgressData:
        await self.authorize(workspace_id, owner_id)
        roadmap = await self.session.scalar(
            select(Roadmap).where(Roadmap.workspace_id == workspace_id).with_for_update()
        )
        if roadmap is None:
            raise HTTPException(404, "Roadmap not found")
        try:
            await self.repository(owner_id).read_brief(workspace_id, topic_id)
        except ValueError:
            raise HTTPException(404, "Topic not found") from None
        row = await self.session.get(TopicProgress, (roadmap.id, topic_id, owner_id))
        if row is None:
            row = TopicProgress(
                roadmap_id=roadmap.id, topic_id=topic_id, owner_id=owner_id, status="not_started"
            )
            self.session.add(row)
        if not only_if_not_started or row.status == "not_started":
            if row.status != status:
                row.completed_at = utc_now() if status == "completed" else None
            row.status = status
        await self.session.flush()
        logger.info(
            "topic_progress_saved", roadmap_id=roadmap.id, topic_id=topic_id, status=row.status
        )
        return TopicProgressData.model_validate(
            {"topic_id": topic_id, "status": row.status, "completed_at": row.completed_at}
        )

    @staticmethod
    def check_not_ready() -> RoadmapHTTPError:
        return RoadmapHTTPError(
            409,
            JobError(
                code="CHECK_NOT_READY",
                message="Answer a tutor question or explain the topic before requesting an assessment.",
                recoverable=True,
                next_action="retry",
            ),
        )

    async def prepare_check(
        self, workspace_id: str, topic_id: str, owner_id: str, session_id: str
    ) -> list[ChatMessage]:
        from services.roadmap.tutor import TutorService

        tutor = TutorService(self.session)
        row, roadmap = await tutor.read_session(session_id, owner_id, write=True)
        if roadmap.workspace_id != workspace_id or row.topic_id != topic_id:
            raise HTTPException(404, "Topic session not found")
        snapshot = await WorkspaceService.get_graph_snapshot(
            self.session, workspace_id, row.chat_id
        )
        if snapshot is None:
            raise self.check_not_ready()
        nodes = sorted(snapshot.nodes, key=lambda node: node.created_at)
        answer = any(
            node.id != row.chat_id
            and node.role == "user"
            and len(node.content.strip()) >= 10
            and not node.content.strip()
            .lower()
            .startswith(("check understanding", "check my understanding", "quiz me", "evaluate my"))
            for node in nodes
        )
        if not answer or not any(
            node.role == "assistant" and node.content.strip() for node in nodes
        ):
            raise self.check_not_ready()
        context = await tutor.build_context(session_id, owner_id)
        transcript = [{"role": node.role, "content": node.content[:4096]} for node in nodes[-50:]]
        return context + [
            ChatMessage.system(
                "Assess the objectives in originalTopic from the recorded session revision, using only the learner's saved answers. Questions and requests for explanation are not answers. Return ready=false if no substantive answer can be evaluated. This is an AI assessment, never proof of mastery and never a completion action. Return JSON matching: "
                + json.dumps(Assessment.model_json_schema(by_alias=True))
            ),
            ChatMessage.user(json.dumps({"savedTranscript": transcript})),
        ]

    async def record_check(
        self,
        workspace_id: str,
        topic_id: str,
        owner_id: str,
        session_id: str,
        *,
        prepared: list[ChatMessage] | None = None,
    ) -> KnowledgeCheckData:
        from services.roadmap.job_repository import JobStateError
        from services.roadmap.stages import configured_provider
        from services.roadmap.tutor import TutorService

        messages = (
            prepared
            if prepared is not None
            else await self.prepare_check(workspace_id, topic_id, owner_id, session_id)
        )
        try:
            provider = self.provider or configured_provider(get_settings())
        except JobStateError as error:
            raise RoadmapHTTPError(503, error.error) from None
        try:
            async with asyncio.timeout(90):
                generated = await provider.generate(
                    messages,
                    ModelConfig(
                        model_name=get_settings().DEFAULT_MODEL,
                        temperature=0.2,
                        max_tokens=2048,
                        max_retries=0,
                    ),
                )
            text = generated.content.strip()
            if text.startswith("```json") and text.endswith("```"):
                text = text[7:-3].strip()
            assessment = Assessment.model_validate_json(text)
        except Exception as error:
            raise RoadmapHTTPError(
                502,
                JobError(
                    code="CHECK_FAILED",
                    message="Could not assess this answer. Try again.",
                    recoverable=True,
                    next_action="retry",
                ),
            ) from error
        finally:
            if self.provider is None:
                client = getattr(provider, "client", None)
                if client is not None:
                    if hasattr(client, "aio"):
                        await client.aio.aclose()
                    else:
                        await client.close()
        if not assessment.ready:
            raise self.check_not_ready()
        # External inference outlives the authorization snapshot held by the route.
        self.session.expire_all()
        topic_session, roadmap = await TutorService(self.session).read_session(
            session_id, owner_id, write=True
        )
        if topic_session.topic_id != topic_id or roadmap.workspace_id != workspace_id:
            raise HTTPException(404, "Topic session not found")
        row = KnowledgeCheck(
            roadmap_id=roadmap.id,
            topic_id=topic_id,
            owner_id=owner_id,
            session_id=session_id,
            revision_id=topic_session.revision_id,
            rubric={"criteria": assessment.criteria},
            result={
                "assessmentType": "AI-assessed",
                **assessment.model_dump(mode="json", by_alias=True, exclude={"criteria", "ready"}),
            },
        )
        self.session.add(row)
        await self.session.flush()
        logger.info(
            "topic_check_recorded", session_id=session_id, topic_id=topic_id, check_id=row.id
        )
        return KnowledgeCheckData.model_validate(row)
