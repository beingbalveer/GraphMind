"""Server-verified roadmap context for persisted workspace conversations."""

from dataclasses import dataclass

from ai_core import ChatMessage, ChatRole
from fastapi import HTTPException
from models.roadmap import Roadmap, TopicChat
from models.workspace import NodeModel
from services.roadmap.curriculum_repository import CurriculumRepository
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

MAX_LINEAGE_TOKENS = 5000
MAX_TOTAL_CONTEXT_TOKENS = 12000
MAX_ROADMAP_CONTEXT_CHARS = 6000


@dataclass
class VerifiedConversation:
    root: NodeModel
    lineage: list[ChatMessage]
    topic_session: TopicChat | None
    roadmap_context: str
    selected_topic_ids: list[str]


def _bounded_text(value: str, limit: int) -> str:
    value = value.strip()
    return value if len(value) <= limit else value[: limit - 1].rstrip() + "…"


async def resolve_persisted_conversation(
    session: AsyncSession,
    *,
    workspace_id: str,
    root_id: str,
    target_id: str,
    owner_id: str,
    selected_topic_ids: list[str] | None,
) -> VerifiedConversation:
    """Resolve ancestry and roadmap scope exclusively from persisted records."""
    root = await session.get(NodeModel, root_id)
    if root is None or root.workspace_id != workspace_id or root.parent_id is not None:
        raise HTTPException(404, "Conversation root not found")

    path: list[NodeModel] = []
    seen: set[str] = set()
    current_id: str | None = target_id
    while current_id:
        if current_id in seen or len(path) >= 200:
            raise HTTPException(422, "Conversation ancestry is invalid")
        seen.add(current_id)
        node = await session.get(NodeModel, current_id)
        if node is None or node.workspace_id != workspace_id:
            raise HTTPException(404, "Conversation node not found")
        path.append(node)
        if node.id == root_id:
            break
        current_id = node.parent_id
    if not path or path[-1].id != root_id:
        raise HTTPException(404, "Conversation node is outside the requested root")
    path.reverse()
    lineage = []
    valid_roles = {role.value for role in ChatRole}
    for node in path:
        if node.role not in valid_roles:
            continue
        content = node.content
        if node.highlighted_context and node.role == ChatRole.USER.value:
            content = (
                f'[Focusing on excerpt: "{_bounded_text(node.highlighted_context, 1000)}"]\n\n'
                f"{content}"
            )
        lineage.append(ChatMessage(role=ChatRole(node.role), content=content))

    topic_session = await session.scalar(select(TopicChat).where(TopicChat.chat_id == root_id))
    if topic_session is not None and topic_session.owner_id != owner_id:
        raise HTTPException(404, "Conversation root not found")

    roadmap = await session.scalar(select(Roadmap).where(Roadmap.workspace_id == workspace_id))
    if roadmap is None:
        if selected_topic_ids:
            raise HTTPException(422, "Selected topics require a workspace roadmap")
        return VerifiedConversation(root, lineage, topic_session, "", [])

    if topic_session is not None:
        if topic_session.roadmap_id != roadmap.id:
            raise HTTPException(404, "Topic session not found")
        return VerifiedConversation(root, lineage, topic_session, "", [])

    metadata = root.metadata_payload or {}
    effective_ids = selected_topic_ids
    if effective_ids is None:
        stored = metadata.get("roadmapTopicIds", [])
        effective_ids = stored if isinstance(stored, list) else []
    if (
        not isinstance(effective_ids, list)
        or any(not isinstance(topic_id, str) or not topic_id for topic_id in effective_ids)
        or len(effective_ids) > 3
        or len(set(effective_ids)) != len(effective_ids)
    ):
        raise HTTPException(422, "Select no more than three distinct roadmap topics")

    view = await CurriculumRepository(session, owner_id).read(workspace_id)
    if view is None:
        if effective_ids:
            raise HTTPException(422, "Selected topics require a workspace roadmap")
        return VerifiedConversation(root, lineage, None, "", [])
    active = {
        item.id: item
        for item in view.candidate.items
        if item.kind == "topic" and item.participation == "active"
    }
    invalid = [topic_id for topic_id in effective_ids if topic_id not in active]
    if invalid and selected_topic_ids is not None:
        raise HTTPException(422, "One or more selected roadmap topics are unavailable")
    if selected_topic_ids is None and invalid:
        # A previously selected topic can be archived by a later roadmap revision.
        # Keep the preference on the root but stop injecting unavailable topics.
        effective_ids = [topic_id for topic_id in effective_ids if topic_id in active]

    # Persist explicit preferences on the root; descendants always resolve here.
    if selected_topic_ids is not None:
        root.metadata_payload = {**metadata, "roadmapTopicIds": list(effective_ids)}

    selected = [active[topic_id] for topic_id in effective_ids]
    prerequisites: dict[str, list[str]] = {}
    for relation in view.candidate.relations:
        if relation.kind == "prerequisite":
            prerequisites.setdefault(relation.target_id, []).append(relation.source_id)
    parts = [
        "WORKSPACE LEARNING ROADMAP CONTEXT (verified, read-only):",
        f"Goal: {_bounded_text(view.profile.prompt, 700)}",
        f"Outcome: {_bounded_text(view.profile.outcome, 700)}",
        f"Learner level: {view.profile.level}",
    ]
    if view.profile.background:
        parts.append(f"Learner background: {_bounded_text(view.profile.background, 500)}")
    progress_values = []
    for key in list(active)[:30]:
        progress = view.progress.get(key)
        progress_values.append(
            f"{active[key].title}: {progress.status if progress is not None else 'not_started'}"
        )
    if progress_values:
        parts.append("Learner progress: " + "; ".join(progress_values))
    if selected:
        for item in selected:
            parts.append(
                f"Selected topic: {item.title}. Brief: {_bounded_text(item.brief, 900)}. "
                f"Objectives: {_bounded_text('; '.join(item.objectives), 700)}. "
                f"Exercise: {_bounded_text(item.exercise or '', 500)}"
            )
            selected_source_ids = {
                resource.source_id
                for resource in view.candidate.resources
                if resource.topic_id == item.id
            }
            for resource in [source for source in view.sources if source.id in selected_source_ids][
                :3
            ]:
                parts.append(
                    f"Resource reference: {resource.title} ({resource.url or 'no URL'}). "
                    f"Evidence: {_bounded_text(resource.evidence, 350)}"
                )
            for prerequisite_id in prerequisites.get(item.id, [])[:3]:
                prerequisite = active.get(prerequisite_id)
                if prerequisite:
                    parts.append(
                        f"Immediate prerequisite: {prerequisite.title}. "
                        f"{_bounded_text(prerequisite.brief, 300)}"
                    )
    else:
        next_topics = [
            item.title
            for item in active.values()
            if item.path == "core"
            and (view.progress.get(item.id) is None or view.progress[item.id].status != "completed")
        ][:8]
        if next_topics:
            parts.append("Core roadmap topics: " + "; ".join(next_topics))
    context = _bounded_text("\n".join(parts), MAX_ROADMAP_CONTEXT_CHARS)
    return VerifiedConversation(root, lineage, None, context, list(effective_ids))
