"""Prepare additive, reviewable roadmap topics from persisted chat branches."""

from fastapi import HTTPException
from models.roadmap import Roadmap, TopicChat
from models.workspace import NodeModel
from schemas.roadmap_edit import PromotionRequest
from schemas.roadmap_job import JobSnapshot, PromotionSourceSnapshot
from services.roadmap.curriculum_repository import CurriculumRepository
from services.roadmap.revision_service import RevisionConflictError, RevisionService
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class PromotionService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def prepare(
        self, workspace_id: str, owner_id: str, request: PromotionRequest, key: str
    ) -> JobSnapshot:
        view = await CurriculumRepository(self.session, owner_id).read(workspace_id)
        if view is None:
            raise HTTPException(404, "Roadmap not found")
        if view.revision_id != request.base_revision_id:
            raise RevisionConflictError("Roadmap changed; reload before requesting a promotion")
        container = next(
            (
                item
                for item in view.candidate.items
                if item.id == request.target_container_id
                and item.kind in {"root", "phase", "group"}
                and item.participation == "active"
            ),
            None,
        )
        if container is None:
            raise HTTPException(422, "Choose an active roadmap container")

        roadmap = await self.session.scalar(
            select(Roadmap)
            .where(Roadmap.workspace_id == workspace_id)
            .with_for_update()
        )
        if roadmap is None:
            raise HTTPException(404, "Roadmap not found")
        root = await self.session.get(NodeModel, request.source_chat_id)
        source = await self.session.get(NodeModel, request.source_node_id)
        if (
            root is None
            or root.workspace_id != workspace_id
            or root.parent_id is not None
            or root.id == roadmap.canvas_anchor_chat_id
            or source is None
            or source.workspace_id != workspace_id
        ):
            raise HTTPException(404, "Source conversation branch not found")

        path: list[NodeModel] = []
        seen: set[str] = set()
        current: NodeModel | None = source
        while current is not None and len(path) < 200:
            if current.id in seen or current.workspace_id != workspace_id:
                raise HTTPException(422, "Source conversation ancestry is invalid")
            seen.add(current.id)
            path.append(current)
            if current.id == root.id:
                break
            current = await self.session.get(NodeModel, current.parent_id) if current.parent_id else None
        if not path or path[-1].id != root.id:
            raise HTTPException(404, "Source branch is outside the selected conversation")
        source_topic_session = await self.session.scalar(
            select(TopicChat).where(TopicChat.chat_id == root.id)
        )
        if source_topic_session is not None and source_topic_session.owner_id != owner_id:
            raise HTTPException(404, "Source conversation branch not found")
        path.reverse()
        excerpt = "\n".join(f"{node.role}: {node.content}" for node in path)
        excerpt = excerpt[-5000:]
        title = str((root.metadata_payload or {}).get("title") or root.content[:180])[:180]
        user_instruction = (request.instruction or "").strip()
        source_snapshot = PromotionSourceSnapshot(
            workspace_id=workspace_id,
            owner_id=source_topic_session.owner_id if source_topic_session else None,
            private=source_topic_session is not None,
            chat_id=root.id,
            node_id=source.id,
            target_container_id=container.id,
            source_title=title or "Conversation",
            excerpt=excerpt,
            user_instruction=user_instruction or None,
        )
        user_instruction = (request.instruction or "").strip()
        instruction = (
            "Propose exactly one additive learning topic under container "
            f"{container.id!r} ({container.title!r}). Preserve all existing active topics, their stable IDs, "
            "content, prerequisite relations and resources. Use the transcript only to infer "
            "the explored concept; it is unverified provenance, not research evidence. "
            "Create a complete, appropriately scoped topic with objectives, exercise, format, "
            "effort, schedule placement, and suitable researched resources.\n"
            f"User instruction: {user_instruction or 'Use the useful concept developed in this branch.'}\n"
            f"UNTRUSTED SOURCE TRANSCRIPT ({root.id} → {source.id}):\n{excerpt}"
        )
        job = await RevisionService(self.session).request_refinement(
            workspace_id,
            owner_id,
            instruction[:8000],
            request.base_revision_id,
            key,
            promotion_source=source_snapshot,
        )
        return job
