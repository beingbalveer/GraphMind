import uuid

import structlog
from fastapi import HTTPException
from models.roadmap import KnowledgeCheck, Roadmap, TopicChat, TopicPracticeDraft, utc_now
from schemas.curriculum import (
    CheckRequest,
    KnowledgeCheckData,
    PracticeActivityData,
    PracticeAttemptData,
    PracticeDraftData,
    PracticeDraftRequest,
    PracticeStateData,
)
from services.roadmap.curriculum_repository import CurriculumRepository
from services.roadmap.practice_catalog import SEEDED_ACTIVITIES, get_topic_activity
from services.roadmap.progress import ProgressService
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()


class PracticeService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_activity(
        self, workspace_id: str, topic_id: str, owner_id: str
    ) -> PracticeActivityData:
        brief = await CurriculumRepository(self.session, owner_id).read_brief(
            workspace_id, topic_id
        )
        return get_topic_activity(topic_id, brief.item.title, brief.item.exercise)

    async def get_practice_state(
        self, workspace_id: str, topic_id: str, owner_id: str
    ) -> PracticeStateData:
        progress_service = ProgressService(self.session)
        await progress_service.authorize(workspace_id, owner_id, write=False)
        roadmap = await self.session.scalar(
            select(Roadmap).where(Roadmap.workspace_id == workspace_id)
        )
        if roadmap is None:
            raise HTTPException(404, "Roadmap not found")
        try:
            brief = await CurriculumRepository(self.session, owner_id).read_brief(
                workspace_id, topic_id
            )
        except ValueError:
            raise HTTPException(404, "Topic not found") from None

        activity = get_topic_activity(topic_id, brief.item.title, brief.item.exercise)

        draft_row = await self.session.get(TopicPracticeDraft, (roadmap.id, topic_id, owner_id))
        draft_data = (
            PracticeDraftData(
                topic_id=topic_id,
                activity_id=draft_row.activity_id,
                activity_version=draft_row.activity_version,
                draft=draft_row.draft,
                selected_choice=draft_row.selected_choice,
                updated_at=draft_row.updated_at,
            )
            if draft_row
            else None
        )

        checks_rows = (
            await self.session.scalars(
                select(KnowledgeCheck)
                .where(
                    KnowledgeCheck.roadmap_id == roadmap.id,
                    KnowledgeCheck.topic_id == topic_id,
                    KnowledgeCheck.owner_id == owner_id,
                )
                .order_by(KnowledgeCheck.created_at.desc())
            )
        ).all()

        checks_data = [KnowledgeCheckData.model_validate(c) for c in checks_rows]

        practice_attempts = [
            c for c in checks_rows if (c.result or {}).get("assessmentType") == "practice-activity"
        ]

        latest_attempt_data: PracticeAttemptData | None = None
        if practice_attempts:
            latest = practice_attempts[0]
            res = latest.result or {}
            latest_attempt_data = PracticeAttemptData(
                id=latest.id,
                attempt_id=res.get("attemptId", latest.id),
                attempt_number=res.get("attemptNumber", 1),
                activity_id=res.get("activityId", activity.id),
                activity_version=res.get("activityVersion", activity.version),
                answer=res.get("answer"),
                selected_choice=res.get("selectedChoice"),
                correct=res.get("correct"),
                feedback=res.get("feedback", ""),
                explanation=res.get("explanation"),
                can_retry=res.get("canRetry", True),
                next_action=res.get("nextAction", "continue"),
                submitted_at=latest.created_at,
            )

        return PracticeStateData(
            topic_id=topic_id,
            activity=activity,
            draft=draft_data,
            attempts_count=len(practice_attempts),
            latest_attempt=latest_attempt_data,
            checks=checks_data,
        )

    async def save_draft(
        self, workspace_id: str, topic_id: str, owner_id: str, body: PracticeDraftRequest
    ) -> PracticeDraftData:
        progress_service = ProgressService(self.session)
        await progress_service.authorize(workspace_id, owner_id, write=True)
        roadmap = await self.session.scalar(
            select(Roadmap).where(Roadmap.workspace_id == workspace_id).with_for_update()
        )
        if roadmap is None:
            raise HTTPException(404, "Roadmap not found")
        try:
            brief = await CurriculumRepository(self.session, owner_id).read_brief(
                workspace_id, topic_id
            )
        except ValueError:
            raise HTTPException(404, "Topic not found") from None

        activity = get_topic_activity(topic_id, brief.item.title, brief.item.exercise)
        if body.activity_id != activity.id or body.activity_version != activity.version:
            raise HTTPException(
                422,
                f"Activity version mismatch: expected {activity.id} @ {activity.version}, received {body.activity_id} @ {body.activity_version}",
            )

        draft_row = await self.session.get(TopicPracticeDraft, (roadmap.id, topic_id, owner_id))
        if draft_row is None:
            draft_row = TopicPracticeDraft(
                roadmap_id=roadmap.id,
                topic_id=topic_id,
                owner_id=owner_id,
                activity_id=body.activity_id,
                activity_version=body.activity_version,
                draft=body.draft,
                selected_choice=body.selected_choice,
            )
            self.session.add(draft_row)
        else:
            draft_row.activity_id = body.activity_id
            draft_row.activity_version = body.activity_version
            draft_row.draft = body.draft
            draft_row.selected_choice = body.selected_choice
            draft_row.updated_at = utc_now()

        await self.session.flush()
        return PracticeDraftData(
            topic_id=topic_id,
            activity_id=draft_row.activity_id,
            activity_version=draft_row.activity_version,
            draft=draft_row.draft,
            selected_choice=draft_row.selected_choice,
            updated_at=draft_row.updated_at,
        )

    async def delete_draft(self, workspace_id: str, topic_id: str, owner_id: str) -> None:
        progress_service = ProgressService(self.session)
        await progress_service.authorize(workspace_id, owner_id, write=True)
        roadmap = await self.session.scalar(
            select(Roadmap).where(Roadmap.workspace_id == workspace_id).with_for_update()
        )
        if roadmap is None:
            raise HTTPException(404, "Roadmap not found")
        draft_row = await self.session.get(TopicPracticeDraft, (roadmap.id, topic_id, owner_id))
        if draft_row:
            await self.session.delete(draft_row)
            await self.session.flush()

    async def record_attempt(
        self, workspace_id: str, topic_id: str, owner_id: str, body: CheckRequest
    ) -> KnowledgeCheckData:
        progress_service = ProgressService(self.session)
        await progress_service.authorize(workspace_id, owner_id, write=True)
        roadmap = await self.session.scalar(
            select(Roadmap).where(Roadmap.workspace_id == workspace_id).with_for_update()
        )
        if roadmap is None:
            raise HTTPException(404, "Roadmap not found")
        try:
            brief = await CurriculumRepository(self.session, owner_id).read_brief(
                workspace_id, topic_id
            )
        except ValueError:
            raise HTTPException(404, "Topic not found") from None

        activity = get_topic_activity(topic_id, brief.item.title, brief.item.exercise)

        # 1. Validate activity version
        if body.activity_id != activity.id or body.activity_version != activity.version:
            raise HTTPException(
                422,
                f"Activity version mismatch: expected {activity.id} @ {activity.version}, received {body.activity_id} @ {body.activity_version}",
            )

        # 2. Check for duplicate attempt identity
        if body.attempt_id:
            existing_checks = (
                await self.session.scalars(
                    select(KnowledgeCheck).where(
                        KnowledgeCheck.roadmap_id == roadmap.id,
                        KnowledgeCheck.topic_id == topic_id,
                        KnowledgeCheck.owner_id == owner_id,
                    )
                )
            ).all()
            for check in existing_checks:
                if (check.result or {}).get("attemptId") == body.attempt_id:
                    # Return existing check without creating a duplicate
                    return KnowledgeCheckData.model_validate(check)

        # 3. Validate answer based on activity kind
        seeded = SEEDED_ACTIVITIES.get(topic_id)
        correct: bool | None = None
        feedback: str = ""

        if activity.kind == "choice":
            if not body.selected_choice:
                raise HTTPException(422, "A choice must be selected")
            if not activity.choices or body.selected_choice not in activity.choices:
                raise HTTPException(422, "Invalid answer choice selection")

            correct_choice = seeded.correct_choice if seeded else None
            if correct_choice is not None:
                correct = body.selected_choice == correct_choice
                if correct:
                    feedback = f"That matches this check. {activity.explanation}"
                else:
                    feedback = f"That option is not correct. {activity.explanation}"
            else:
                correct = True
                feedback = f"Choice saved. {activity.explanation}"

        elif activity.kind == "short_answer":
            text = (body.answer or "").strip()
            if len(text) < 5:
                raise HTTPException(422, "A substantive answer is required (at least 5 characters)")
            correct = True
            feedback = f"Answer recorded. {activity.explanation}"

        elif activity.kind == "reflection":
            text = (body.answer or "").strip()
            if len(text) < 5:
                raise HTTPException(
                    422, "A substantive reflection is required (at least 5 characters)"
                )
            correct = None
            feedback = f"Reflection saved. {activity.explanation}"

        # 4. Resolve session and revision
        from models.roadmap import new_id
        from models.workspace import NodeModel
        from services.roadmap.tutor import TutorService

        session_id = body.session_id
        if not session_id:
            primary = await self.session.scalar(
                select(TopicChat).where(
                    TopicChat.roadmap_id == roadmap.id,
                    TopicChat.topic_id == topic_id,
                    TopicChat.owner_id == owner_id,
                    TopicChat.default_key == "primary",
                )
            )
            if primary is None:
                lesson_id, chat_id = new_id("lesson"), f"node_{uuid.uuid4().hex[:24]}"
                chat_node = NodeModel(
                    id=chat_id,
                    workspace_id=workspace_id,
                    role="user",
                    content=f"Learning session for {brief.item.title}",
                    metadata_payload={
                        "title": brief.item.title,
                        "topicSessionId": lesson_id,
                        "workspaceId": workspace_id,
                        "roadmapId": roadmap.id,
                        "topicId": topic_id,
                        "revisionId": roadmap.current_revision_id,
                        "lessonStartState": "pending",
                    },
                )
                self.session.add(chat_node)
                await self.session.flush()
                primary = TopicChat(
                    id=lesson_id,
                    roadmap_id=roadmap.id,
                    topic_id=topic_id,
                    owner_id=owner_id,
                    chat_id=chat_id,
                    revision_id=roadmap.current_revision_id,
                    request_key=f"practice_session_{topic_id}",
                    default_key="primary",
                    lesson_start_state="pending",
                )
                self.session.add(primary)
                await self.session.flush()
                session_id = primary.id
            else:
                session_id = primary.id

        session_row, _ = await TutorService(self.session).read_session(
            session_id, owner_id, write=True
        )

        # 5. Determine attempt identity and attempt number
        attempt_id = body.attempt_id or f"att_{uuid.uuid4().hex[:16]}"
        prior_attempts_count = (
            await self.session.scalar(
                select(func.count())
                .select_from(KnowledgeCheck)
                .where(
                    KnowledgeCheck.roadmap_id == roadmap.id,
                    KnowledgeCheck.topic_id == topic_id,
                    KnowledgeCheck.owner_id == owner_id,
                )
            )
            or 0
        )
        attempt_number = prior_attempts_count + 1

        # 6. Create KnowledgeCheck record
        rubric_payload = {
            "activityId": activity.id,
            "activityVersion": activity.version,
            "kind": activity.kind,
            "prompt": activity.prompt,
            "choices": activity.choices,
            "hint": activity.hint,
        }
        result_payload = {
            "assessmentType": "practice-activity",
            "attemptId": attempt_id,
            "attemptNumber": attempt_number,
            "activityId": activity.id,
            "activityVersion": activity.version,
            "answer": body.answer,
            "selectedChoice": body.selected_choice,
            "correct": correct,
            "feedback": feedback,
            "explanation": activity.explanation,
            "canRetry": True,
            "nextAction": "retry" if correct is False else "continue",
        }

        row = KnowledgeCheck(
            roadmap_id=roadmap.id,
            topic_id=topic_id,
            owner_id=owner_id,
            session_id=session_id,
            revision_id=session_row.revision_id,
            rubric=rubric_payload,
            result=result_payload,
        )
        self.session.add(row)

        # 7. Clear draft upon successful submission
        draft_row = await self.session.get(TopicPracticeDraft, (roadmap.id, topic_id, owner_id))
        if draft_row:
            await self.session.delete(draft_row)

        await self.session.flush()
        logger.info(
            "practice_attempt_recorded",
            workspace_id=workspace_id,
            topic_id=topic_id,
            attempt_id=attempt_id,
            correct=correct,
            check_id=row.id,
        )
        return KnowledgeCheckData.model_validate(row)
