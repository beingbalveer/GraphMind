from collections import deque
from typing import Any, Dict, List, Optional, Tuple

import structlog
from errors import RoadmapHTTPError
from models.roadmap import CurriculumRevision, RevisionItem, Roadmap, TopicChat, TopicProgress
from models.workspace import EdgeModel, NodeModel, Workspace
from schemas.roadmap_job import JobError
from schemas.workspace import (
    ChatSummary,
    ChatTopicAssociation,
    EdgeResponse,
    GraphDeltaUpdateRequest,
    GraphSnapshotResponse,
    NodeCreate,
    NodeResponse,
    WorkspaceCreate,
    WorkspaceCurriculumSummary,
    WorkspaceResponse,
    WorkspaceUpdate,
)
from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

logger = structlog.get_logger()


class WorkspaceService:
    @staticmethod
    async def list_workspaces(
        session: AsyncSession,
        limit: int = 50,
        offset: int = 0,
        user_id: Optional[str] = None,
    ) -> Tuple[List[WorkspaceResponse], int]:
        """
        List workspaces accessible to the user ordered by most recently updated.
        """
        from models.user import WorkspaceMember

        stmt_filter = None
        if user_id:
            stmt_filter = or_(
                Workspace.owner_id == user_id,
                Workspace.id.in_(
                    select(WorkspaceMember.workspace_id).where(WorkspaceMember.user_id == user_id)
                ),
            )

        total_stmt = select(func.count(Workspace.id))
        if stmt_filter is not None:
            total_stmt = total_stmt.where(stmt_filter)
        total_res = await session.execute(total_stmt)
        total = total_res.scalar_one()

        stmt = select(Workspace).options(selectinload(Workspace.nodes))
        if stmt_filter is not None:
            stmt = stmt.where(stmt_filter)
        stmt = stmt.order_by(Workspace.updated_at.desc()).limit(limit).offset(offset)

        result = await session.execute(stmt)
        workspaces = result.scalars().all()

        ws_ids = [ws.id for ws in workspaces]
        roadmaps_by_ws: Dict[str, Tuple[Roadmap, Optional[CurriculumRevision]]] = {}
        progress_by_roadmap: Dict[str, Tuple[int, int, float]] = {}

        if ws_ids:
            rm_stmt = (
                select(Roadmap, CurriculumRevision)
                .outerjoin(CurriculumRevision, Roadmap.current_revision_id == CurriculumRevision.id)
                .where(Roadmap.workspace_id.in_(ws_ids))
            )
            rm_res = await session.execute(rm_stmt)
            roadmap_ids = []
            for row in rm_res.all():
                rm, rev = row[0], row[1]
                roadmaps_by_ws[rm.workspace_id] = (rm, rev)
                roadmap_ids.append(rm.id)

            if roadmap_ids:
                total_stmt = (
                    select(RevisionItem.roadmap_id, func.count(RevisionItem.item_id))
                    .where(
                        RevisionItem.roadmap_id.in_(roadmap_ids),
                        RevisionItem.kind == "topic",
                        RevisionItem.participation == "active",
                    )
                    .group_by(RevisionItem.roadmap_id)
                )
                total_counts = dict((await session.execute(total_stmt)).all())

                completed_counts: Dict[str, int] = {}
                if user_id:
                    comp_stmt = (
                        select(TopicProgress.roadmap_id, func.count(TopicProgress.topic_id))
                        .where(
                            TopicProgress.roadmap_id.in_(roadmap_ids),
                            TopicProgress.owner_id == user_id,
                            TopicProgress.status == "completed",
                        )
                        .group_by(TopicProgress.roadmap_id)
                    )
                    completed_counts = dict((await session.execute(comp_stmt)).all())

                for r_id in roadmap_ids:
                    tot = total_counts.get(r_id, 0)
                    comp = completed_counts.get(r_id, 0)
                    pct = round((comp / tot * 100.0), 1) if tot > 0 else 0.0
                    progress_by_roadmap[r_id] = (tot, comp, pct)

        responses = []
        for ws in workspaces:
            curriculum_summary = None
            if ws.id in roadmaps_by_ws:
                rm, rev = roadmaps_by_ws[ws.id]
                tot, comp, pct = progress_by_roadmap.get(rm.id, (0, 0, 0.0))
                source_ref = (rm.profile or {}).get("sourceSnapshotRef") or (rm.profile or {}).get("sampleTemplateRef")
                curriculum_summary = WorkspaceCurriculumSummary(
                    roadmap_id=rm.id,
                    revision_id=rm.current_revision_id,
                    title=rev.title if rev else (ws.name or "Curriculum"),
                    status=rev.status if rev else "active",
                    total_topics=tot,
                    completed_topics=comp,
                    progress_percent=pct,
                    source_snapshot_ref=source_ref,
                    origin_job_id=rm.origin_job_id,
                    updated_at=rev.updated_at if rev else rm.updated_at,
                )

            responses.append(
                WorkspaceResponse(
                    id=ws.id,
                    name=ws.name,
                    description=ws.description,
                    viewport_x=ws.viewport_x,
                    viewport_y=ws.viewport_y,
                    zoom=ws.zoom,
                    created_at=ws.created_at,
                    updated_at=ws.updated_at,
                    node_count=len(ws.nodes),
                    curriculum=curriculum_summary,
                )
            )
        return responses, total

    @staticmethod
    async def get_workspace_curricula(
        session: AsyncSession,
        workspace_id: str,
        user_id: Optional[str] = None,
    ) -> List[WorkspaceCurriculumSummary]:
        """
        Return authorized curriculum summary list for a single workspace.
        """
        rm_stmt = (
            select(Roadmap, CurriculumRevision)
            .outerjoin(CurriculumRevision, Roadmap.current_revision_id == CurriculumRevision.id)
            .where(Roadmap.workspace_id == workspace_id)
        )
        rm_res = await session.execute(rm_stmt)
        row = rm_res.first()
        if not row:
            return []
        rm, rev = row[0], row[1]

        tot_stmt = select(func.count(RevisionItem.item_id)).where(
            RevisionItem.roadmap_id == rm.id,
            RevisionItem.kind == "topic",
            RevisionItem.participation == "active",
        )
        tot = (await session.execute(tot_stmt)).scalar() or 0

        comp = 0
        if user_id:
            comp_stmt = select(func.count(TopicProgress.topic_id)).where(
                TopicProgress.roadmap_id == rm.id,
                TopicProgress.owner_id == user_id,
                TopicProgress.status == "completed",
            )
            comp = (await session.execute(comp_stmt)).scalar() or 0

        pct = round((comp / tot * 100.0), 1) if tot > 0 else 0.0
        source_ref = (rm.profile or {}).get("sourceSnapshotRef") or (rm.profile or {}).get("sampleTemplateRef")

        return [
            WorkspaceCurriculumSummary(
                roadmap_id=rm.id,
                revision_id=rm.current_revision_id,
                title=rev.title if rev else "Curriculum",
                status=rev.status if rev else "active",
                total_topics=tot,
                completed_topics=comp,
                progress_percent=pct,
                source_snapshot_ref=source_ref,
                origin_job_id=rm.origin_job_id,
                updated_at=rev.updated_at if rev else rm.updated_at,
            )
        ]

    @staticmethod
    async def create_workspace(
        session: AsyncSession,
        data: WorkspaceCreate,
        owner_id: str = "usr_default_admin",
    ) -> WorkspaceResponse:
        """
        Create a new workspace and establish owner membership invariant.
        """
        from models.user import WorkspaceMember

        ws = Workspace(
            name=data.name,
            description=data.description,
            owner_id=owner_id,
        )
        session.add(ws)
        await session.flush()

        member = WorkspaceMember(workspace_id=ws.id, user_id=owner_id, role="owner")
        session.add(member)
        await session.flush()

        await session.refresh(ws)
        logger.info("Workspace created", workspace_id=ws.id, name=ws.name, owner_id=owner_id)
        return WorkspaceResponse.model_validate(ws)

    @staticmethod
    async def get_workspace(
        session: AsyncSession, workspace_id: str
    ) -> Optional[WorkspaceResponse]:
        """
        Get workspace metadata by ID.
        """
        stmt = (
            select(Workspace)
            .options(selectinload(Workspace.nodes))
            .where(Workspace.id == workspace_id)
        )
        result = await session.execute(stmt)
        ws = result.scalar_one_or_none()
        if not ws:
            return None
        return WorkspaceResponse(
            id=ws.id,
            name=ws.name,
            description=ws.description,
            viewport_x=ws.viewport_x,
            viewport_y=ws.viewport_y,
            zoom=ws.zoom,
            created_at=ws.created_at,
            updated_at=ws.updated_at,
            node_count=len(ws.nodes),
        )

    @staticmethod
    async def update_workspace(
        session: AsyncSession, workspace_id: str, data: WorkspaceUpdate
    ) -> Optional[WorkspaceResponse]:
        """
        Update workspace properties or viewport coordinates.
        """
        stmt = select(Workspace).where(Workspace.id == workspace_id)
        result = await session.execute(stmt)
        ws = result.scalar_one_or_none()
        if not ws:
            return None

        if data.name is not None:
            ws.name = data.name
        if data.description is not None:
            ws.description = data.description
        if data.viewport_x is not None:
            ws.viewport_x = data.viewport_x
        if data.viewport_y is not None:
            ws.viewport_y = data.viewport_y
        if data.zoom is not None:
            ws.zoom = data.zoom

        await session.flush()
        await session.refresh(ws)
        return WorkspaceResponse.model_validate(ws)

    @staticmethod
    async def delete_workspace(session: AsyncSession, workspace_id: str) -> bool:
        """
        Delete a workspace and cascade-delete all child nodes, edges, and physical storage.
        """
        stmt = select(Workspace).where(Workspace.id == workspace_id)
        result = await session.execute(stmt)
        ws = result.scalar_one_or_none()
        if not ws:
            return False
        await session.delete(ws)
        await session.flush()

        # Clean up physical storage directory if exists
        try:
            import os
            import shutil
            from pathlib import Path

            ws_storage_dir = (
                Path(os.getenv("STORAGE_DIR", "data/storage")) / "workspaces" / workspace_id
            )
            if ws_storage_dir.exists():
                shutil.rmtree(ws_storage_dir, ignore_errors=True)
        except Exception as err:
            logger.warning(
                "Failed to clean up workspace disk directory",
                workspace_id=workspace_id,
                error=str(err),
            )

        logger.info("Workspace deleted", workspace_id=workspace_id)
        return True

    @staticmethod
    async def get_graph_snapshot(
        session: AsyncSession, workspace_id: str, root_id: Optional[str] = None
    ) -> Optional[GraphSnapshotResponse]:
        """
        Retrieve complete graph topology for a workspace, optionally filtered to a single chat tree (root_id).
        """
        stmt = (
            select(Workspace)
            .options(selectinload(Workspace.nodes), selectinload(Workspace.edges))
            .where(Workspace.id == workspace_id)
        )
        result = await session.execute(stmt)
        ws = result.scalar_one_or_none()
        if not ws:
            return None

        nodes = ws.nodes
        edges = ws.edges

        node_map = {n.id: n for n in ws.nodes}
        tree_children_map: dict[str, list[str]] = {}
        for n in ws.nodes:
            if n.parent_id:
                tree_children_map.setdefault(n.parent_id, []).append(n.id)

        if root_id:
            # Filter to only the nodes and edges in the specified chat tree
            subtree_ids = set()
            if root_id in node_map:
                queue = deque([root_id])
                while queue:
                    curr_id = queue.popleft()
                    subtree_ids.add(curr_id)
                    for child_id in tree_children_map.get(curr_id, []):
                        queue.append(child_id)

            nodes = [n for n in ws.nodes if n.id in subtree_ids]
            edges = [
                e for e in ws.edges if e.source_id in subtree_ids and e.target_id in subtree_ids
            ]

        node_responses = [
            NodeResponse(
                id=n.id,
                workspace_id=n.workspace_id,
                parent_id=n.parent_id,
                role=n.role,
                content=n.content,
                highlighted_context=n.highlighted_context,
                provider=n.provider,
                model=n.model,
                position_x=n.position_x,
                position_y=n.position_y,
                metadata=n.metadata_payload or {},
                created_at=n.created_at,
                updated_at=n.updated_at,
            )
            for n in nodes
        ]

        edge_responses = [
            EdgeResponse(
                id=e.id,
                workspace_id=e.workspace_id,
                source_id=e.source_id,
                target_id=e.target_id,
                relation_type=e.relation_type,
                highlighted_context=e.highlighted_context,
                created_at=e.created_at,
            )
            for e in edges
        ]

        filtered_node_map = {n.id: n for n in nodes}
        filtered_children_map: dict[str, list[str]] = {}
        for n in nodes:
            if n.parent_id:
                filtered_children_map.setdefault(n.parent_id, []).append(n.id)

        target_root_id = root_id or (nodes[0].id if nodes else None)
        active_id = None
        if target_root_id and target_root_id in filtered_node_map:
            curr_id = target_root_id
            while curr_id in filtered_children_map and filtered_children_map[curr_id]:
                c_ids = filtered_children_map[curr_id]
                mainline_c = next(
                    (
                        cid
                        for cid in reversed(c_ids)
                        if not getattr(filtered_node_map.get(cid), "highlighted_context", None)
                    ),
                    None,
                )
                if not mainline_c:
                    break
                curr_id = mainline_c
            active_id = curr_id
        elif nodes:
            active_id = nodes[-1].id

        ws_response = WorkspaceResponse(
            id=ws.id,
            name=ws.name,
            description=ws.description,
            viewport_x=ws.viewport_x,
            viewport_y=ws.viewport_y,
            zoom=ws.zoom,
            created_at=ws.created_at,
            updated_at=ws.updated_at,
            node_count=len(ws.nodes),
        )

        return GraphSnapshotResponse(
            workspace=ws_response,
            nodes=node_responses,
            edges=edge_responses,
            root_node_id=target_root_id,
            active_node_id=active_id,
        )

    @staticmethod
    async def list_workspace_chats(
        session: AsyncSession, workspace_id: str, owner_id: str | None = None
    ) -> List[ChatSummary]:
        """
        List all distinct conversation trees (chats) in a workspace.
        Each chat corresponds to a root node with parent_id is None.
        """
        stmt = (
            select(Workspace)
            .options(selectinload(Workspace.nodes))
            .where(Workspace.id == workspace_id)
        )
        result = await session.execute(stmt)
        ws = result.scalar_one_or_none()
        if not ws:
            return []

        # Find all root nodes (parent_id is None)
        anchor_ids = set(
            (
                await session.scalars(
                    select(Roadmap.canvas_anchor_chat_id).where(
                        Roadmap.workspace_id == workspace_id
                    )
                )
            ).all()
        )
        root_nodes = [n for n in ws.nodes if n.parent_id is None and n.id not in anchor_ids]
        if not root_nodes:
            return []

        topic_associations: dict[str, ChatTopicAssociation] = {}
        if owner_id:
            topic_owners = (
                await session.execute(
                    select(TopicChat.chat_id, TopicChat.owner_id)
                    .join(Roadmap, Roadmap.id == TopicChat.roadmap_id)
                    .where(
                        TopicChat.chat_id.in_([node.id for node in root_nodes]),
                        Roadmap.workspace_id == workspace_id,
                    )
                )
            ).all()
            private_lesson_roots = {
                chat_id for chat_id, lesson_owner_id in topic_owners if lesson_owner_id != owner_id
            }
            root_nodes = [node for node in root_nodes if node.id not in private_lesson_roots]
            if not root_nodes:
                return []
            topic_rows = (
                await session.execute(
                    select(TopicChat, Roadmap.current_revision_id)
                    .join(Roadmap, Roadmap.id == TopicChat.roadmap_id)
                    .where(
                        TopicChat.chat_id.in_([node.id for node in root_nodes]),
                        TopicChat.owner_id == owner_id,
                        Roadmap.workspace_id == workspace_id,
                    )
                )
            ).all()
            revision_ids = {
                revision_id
                for topic_chat, active_revision_id in topic_rows
                for revision_id in (topic_chat.revision_id, active_revision_id)
                if revision_id
            }
            topic_ids = {topic_chat.topic_id for topic_chat, _ in topic_rows}
            item_rows = (
                await session.execute(
                    select(RevisionItem).where(
                        RevisionItem.revision_id.in_(revision_ids),
                        RevisionItem.item_id.in_(topic_ids),
                    )
                )
            ).scalars().all() if revision_ids and topic_ids else []
            item_by_identity = {(item.revision_id, item.item_id): item for item in item_rows}
            for topic_chat, active_revision_id in topic_rows:
                current_item = item_by_identity.get((active_revision_id, topic_chat.topic_id))
                archived = current_item is None or current_item.participation != "active"
                title_item = (
                    item_by_identity.get((topic_chat.revision_id, topic_chat.topic_id))
                    if archived
                    else current_item
                )
                title = str(
                    (title_item.payload or {}).get("title")
                    if title_item is not None
                    else "Archived topic"
                )
                topic_associations[topic_chat.chat_id] = ChatTopicAssociation(
                    session_id=topic_chat.id,
                    topic_id=topic_chat.topic_id,
                    title=title,
                    archived=archived,
                )

        # Map parent -> children for fast subtree traversal
        node_map = {n.id: n for n in ws.nodes}
        children_map: dict[str, list[str]] = {}
        for n in ws.nodes:
            if n.parent_id:
                children_map.setdefault(n.parent_id, []).append(n.id)

        chats: List[ChatSummary] = []
        for root in root_nodes:
            subtree_nodes: List[NodeModel] = [root]
            queue = [root.id]
            while queue:
                curr_id = queue.pop(0)
                for child_id in children_map.get(curr_id, []):
                    if child_id in node_map:
                        subtree_nodes.append(node_map[child_id])
                        queue.append(child_id)

            latest_updated = max(n.updated_at for n in subtree_nodes)

            # Resolve mainline leaf node
            curr_id = root.id
            while curr_id in children_map and children_map[curr_id]:
                c_ids = children_map[curr_id]
                mainline_c = next(
                    (
                        cid
                        for cid in reversed(c_ids)
                        if not getattr(node_map.get(cid), "highlighted_context", None)
                    ),
                    None,
                )
                if not mainline_c:
                    break
                curr_id = mainline_c
            active_node_id = curr_id

            chat_title = root.metadata_payload.get("title") if root.metadata_payload else None
            if not chat_title:
                chat_title = root.content[:40].strip() + ("..." if len(root.content) > 40 else "")
            if not chat_title:
                chat_title = "Untitled Chat"
            is_pinned = (
                bool(root.metadata_payload.get("pinned", False)) if root.metadata_payload else False
            )

            chats.append(
                ChatSummary(
                    id=root.id,
                    workspace_id=workspace_id,
                    title=str(chat_title),
                    node_count=len(subtree_nodes),
                    created_at=root.created_at,
                    updated_at=latest_updated,
                    active_node_id=active_node_id,
                    pinned=is_pinned,
                    topic_association=topic_associations.get(root.id),
                )
            )

        # Sort pinned chats to the top, then by updated_at descending
        chats.sort(key=lambda c: (1 if c.pinned else 0, c.updated_at), reverse=True)
        return chats

    @staticmethod
    async def protect_roadmap_anchor(
        session: AsyncSession, workspace_id: str, node_id: str
    ) -> None:
        anchor = await session.scalar(
            select(Roadmap.id).where(
                Roadmap.workspace_id == workspace_id, Roadmap.canvas_anchor_chat_id == node_id
            )
        )
        if anchor:
            raise RoadmapHTTPError(
                409,
                JobError(
                    code="ROADMAP_ANCHOR_PROTECTED",
                    message="This chat anchors your roadmap canvas. Delete the workspace to remove the roadmap.",
                    recoverable=False,
                    next_action="new_run",
                ),
            )

    @staticmethod
    async def delete_branch(session: AsyncSession, workspace_id: str, node_id: str) -> bool:
        """
        Delete a node and all its recursive descendants efficiently using a CTE.
        """
        await WorkspaceService.protect_roadmap_anchor(session, workspace_id, node_id)
        stmt = text("""
            WITH RECURSIVE descendants AS (
                SELECT id FROM nodes
                WHERE id = :node_id AND workspace_id = :workspace_id

                UNION ALL

                SELECT n.id FROM nodes n
                INNER JOIN descendants d ON n.parent_id = d.id
            )
            DELETE FROM nodes
            WHERE id IN (SELECT id FROM descendants)
            RETURNING id;
        """)
        result = await session.execute(stmt, {"node_id": node_id, "workspace_id": workspace_id})
        deleted_ids = result.fetchall()
        if not deleted_ids:
            return False

        await session.flush()
        logger.info(
            "Branch deleted",
            workspace_id=workspace_id,
            node_id=node_id,
            deleted_count=len(deleted_ids),
        )
        return True

    @staticmethod
    async def delete_chat(session: AsyncSession, workspace_id: str, chat_root_id: str) -> bool:
        """
        Delete a conversation tree (chat) by deleting its root node and cascading to all descendants.
        """
        await WorkspaceService.protect_roadmap_anchor(session, workspace_id, chat_root_id)
        stmt = select(NodeModel).where(
            NodeModel.id == chat_root_id, NodeModel.workspace_id == workspace_id
        )
        result = await session.execute(stmt)
        root = result.scalar_one_or_none()
        if not root:
            return False

        await session.delete(root)
        await session.flush()
        logger.info("Chat tree deleted", workspace_id=workspace_id, chat_root_id=chat_root_id)
        return True

    @staticmethod
    async def update_chat_metadata(
        session: AsyncSession,
        workspace_id: str,
        chat_root_id: str,
        title: Optional[str] = None,
        pinned: Optional[bool] = None,
    ) -> bool:
        """
        Update a conversation tree's metadata (title and/or pinned state).
        """
        stmt = select(NodeModel).where(
            NodeModel.id == chat_root_id, NodeModel.workspace_id == workspace_id
        )
        result = await session.execute(stmt)
        root = result.scalar_one_or_none()
        if not root:
            return False

        payload = dict(root.metadata_payload or {})
        if title is not None:
            payload["title"] = title.strip()
        if pinned is not None:
            payload["pinned"] = pinned
        root.metadata_payload = payload
        await session.flush()
        logger.info(
            "Chat metadata updated",
            workspace_id=workspace_id,
            chat_root_id=chat_root_id,
            title=title,
            pinned=pinned,
        )
        return True

    @staticmethod
    async def rename_chat(
        session: AsyncSession, workspace_id: str, chat_root_id: str, new_title: str
    ) -> bool:
        """
        Rename a conversation tree by updating the title in the root node's metadata_payload.
        """
        return await WorkspaceService.update_chat_metadata(
            session, workspace_id, chat_root_id, title=new_title
        )

    @staticmethod
    async def update_node(
        session: AsyncSession,
        workspace_id: str,
        node_id: str,
        updates: Dict[str, Any],
    ) -> Optional[NodeResponse]:
        """
        Update a conversation node's content and/or metadata.
        """
        stmt = select(NodeModel).where(
            NodeModel.id == node_id, NodeModel.workspace_id == workspace_id
        )
        res = await session.execute(stmt)
        node = res.scalar_one_or_none()
        if not node:
            return None

        if "content" in updates and isinstance(updates["content"], str):
            node.content = updates["content"]
        if "metadata" in updates and isinstance(updates["metadata"], dict):
            current_meta = dict(node.metadata_payload or {})
            current_meta.update(updates["metadata"])
            node.metadata_payload = current_meta
        if "title" in updates:
            current_meta = dict(node.metadata_payload or {})
            current_meta["title"] = updates["title"]
            node.metadata_payload = current_meta
        if "pinned" in updates:
            current_meta = dict(node.metadata_payload or {})
            current_meta["pinned"] = updates["pinned"]
            node.metadata_payload = current_meta

        await session.flush()
        logger.info(
            "Node updated",
            workspace_id=workspace_id,
            node_id=node_id,
            updates=updates,
        )
        return NodeResponse(
            id=node.id,
            workspace_id=node.workspace_id,
            parent_id=node.parent_id,
            role=node.role,
            content=node.content,
            highlighted_context=node.highlighted_context,
            provider=node.provider,
            model=node.model,
            position_x=node.position_x,
            position_y=node.position_y,
            metadata=node.metadata_payload or {},
            created_at=node.created_at,
            updated_at=node.updated_at,
        )

    @staticmethod
    async def add_node_and_edge(
        session: AsyncSession,
        workspace_id: str,
        data: NodeCreate,
        *,
        compute_embedding: bool = True,
    ) -> NodeResponse:
        """
        Add or update a conversation node in a workspace and ensure the directed edge from parent exists.
        """
        existing_node = None
        if data.id:
            stmt = select(NodeModel).where(
                NodeModel.id == data.id, NodeModel.workspace_id == workspace_id
            )
            res = await session.execute(stmt)
            existing_node = res.scalar_one_or_none()

        effective_parent_id = data.parent_id
        if effective_parent_id:
            parent_exists = await session.get(NodeModel, effective_parent_id)
            if not parent_exists or parent_exists.workspace_id != workspace_id:
                logger.warning(
                    "Invalid parent_id provided for node creation; falling back to None",
                    provided_parent_id=effective_parent_id,
                    workspace_id=workspace_id,
                )
                effective_parent_id = None

        if existing_node:
            existing_node.content = data.content
            if data.provider:
                existing_node.provider = data.provider
            if data.model:
                existing_node.model = data.model
            if data.position_x != 0.0:
                existing_node.position_x = data.position_x
            if data.position_y != 0.0:
                existing_node.position_y = data.position_y
            if data.metadata:
                existing_node.metadata_payload = data.metadata
            node = existing_node
        else:
            node = NodeModel(
                id=data.id,
                workspace_id=workspace_id,
                parent_id=effective_parent_id,
                role=data.role,
                content=data.content,
                highlighted_context=data.highlighted_context,
                provider=data.provider,
                model=data.model,
                position_x=data.position_x,
                position_y=data.position_y,
                metadata_payload=data.metadata,
            )
            session.add(node)
        await session.flush()

        # Compute and persist vector embedding for semantic search
        try:
            from services.semantic_service import SemanticService

            if compute_embedding:
                semantic_service = SemanticService()
                await semantic_service.compute_and_save_node_embedding(session, node)
        except Exception as e:
            logger.warning("Embedding generation deferred on node creation", error=str(e))

        if effective_parent_id and not existing_node:
            edge_id = f"{effective_parent_id}->{node.id}"
            edge = EdgeModel(
                id=edge_id,
                workspace_id=workspace_id,
                source_id=effective_parent_id,
                target_id=node.id,
                highlighted_context=data.highlighted_context,
            )
            session.add(edge)

        await session.flush()
        await session.refresh(node)
        return NodeResponse(
            id=node.id,
            workspace_id=node.workspace_id,
            parent_id=node.parent_id,
            role=node.role,
            content=node.content,
            highlighted_context=node.highlighted_context,
            provider=node.provider,
            model=node.model,
            position_x=node.position_x,
            position_y=node.position_y,
            metadata=node.metadata_payload or {},
            created_at=node.created_at,
            updated_at=node.updated_at,
        )

    @staticmethod
    async def apply_graph_delta(
        session: AsyncSession, workspace_id: str, delta: GraphDeltaUpdateRequest
    ) -> bool:
        """
        Apply batch delta updates (e.g. moved node coordinates or viewport camera pan).
        """
        if delta.workspace_update:
            await WorkspaceService.update_workspace(session, workspace_id, delta.workspace_update)

        if delta.moved_nodes:
            for moved in delta.moved_nodes:
                stmt = select(NodeModel).where(
                    NodeModel.id == moved.id, NodeModel.workspace_id == workspace_id
                )
                res = await session.execute(stmt)
                n = res.scalar_one_or_none()
                if n:
                    n.position_x = moved.position_x
                    n.position_y = moved.position_y

        await session.flush()
        return True
