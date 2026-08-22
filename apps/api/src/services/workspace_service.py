from typing import List, Optional, Tuple

import structlog
from models.workspace import EdgeModel, NodeModel, Workspace
from schemas.workspace import (
    ChatSummary,
    EdgeResponse,
    GraphDeltaUpdateRequest,
    GraphSnapshotResponse,
    NodeCreate,
    NodeResponse,
    WorkspaceCreate,
    WorkspaceResponse,
    WorkspaceUpdate,
)
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

logger = structlog.get_logger()


class WorkspaceService:
    @staticmethod
    async def list_workspaces(
        session: AsyncSession, limit: int = 50, offset: int = 0
    ) -> Tuple[List[WorkspaceResponse], int]:
        """
        List all workspaces ordered by most recently updated.
        """
        total_stmt = select(func.count(Workspace.id))
        total_res = await session.execute(total_stmt)
        total = total_res.scalar_one()

        stmt = (
            select(Workspace)
            .options(selectinload(Workspace.nodes))
            .order_by(Workspace.updated_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await session.execute(stmt)
        workspaces = result.scalars().all()

        responses = [
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
            )
            for ws in workspaces
        ]
        return responses, total

    @staticmethod
    async def create_workspace(session: AsyncSession, data: WorkspaceCreate) -> WorkspaceResponse:
        """
        Create a new workspace.
        """
        ws = Workspace(
            name=data.name,
            description=data.description,
        )
        session.add(ws)
        await session.flush()
        await session.refresh(ws)
        logger.info("Workspace created", workspace_id=ws.id, name=ws.name)
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
        Delete a workspace and cascade-delete all child nodes and edges.
        """
        stmt = select(Workspace).where(Workspace.id == workspace_id)
        result = await session.execute(stmt)
        ws = result.scalar_one_or_none()
        if not ws:
            return False
        await session.delete(ws)
        await session.flush()
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
                queue = [root_id]
                while queue:
                    curr_id = queue.pop(0)
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
                        for cid in c_ids
                        if not getattr(filtered_node_map.get(cid), "highlighted_context", None)
                    ),
                    c_ids[0],
                )
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
    async def list_workspace_chats(session: AsyncSession, workspace_id: str) -> List[ChatSummary]:
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
        root_nodes = [n for n in ws.nodes if n.parent_id is None]
        if not root_nodes:
            return []

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
            active_node = subtree_nodes[-1]
            title = root.metadata_payload.get("title") if root.metadata_payload else None
            if not title:
                title = root.content[:40].strip() + ("..." if len(root.content) > 40 else "")
            if not title:
                title = "Untitled Chat"

            chats.append(
                ChatSummary(
                    id=root.id,
                    workspace_id=workspace_id,
                    title=title,
                    node_count=len(subtree_nodes),
                    created_at=root.created_at,
                    updated_at=latest_updated,
                    active_node_id=active_node.id,
                )
            )

        # Sort by updated_at descending
        chats.sort(key=lambda c: c.updated_at, reverse=True)
        return chats

    @staticmethod
    async def delete_chat(session: AsyncSession, workspace_id: str, chat_root_id: str) -> bool:
        """
        Delete a conversation tree (chat) by deleting its root node and cascading to all descendants.
        """
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
    async def add_node_and_edge(
        session: AsyncSession, workspace_id: str, data: NodeCreate
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
                parent_id=data.parent_id,
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

            semantic_service = SemanticService()
            await semantic_service.compute_and_save_node_embedding(session, node)
        except Exception as e:
            logger.warning("Embedding generation deferred on node creation", error=str(e))

        if data.parent_id and not existing_node:
            edge_id = f"{data.parent_id}->{node.id}"
            edge = EdgeModel(
                id=edge_id,
                workspace_id=workspace_id,
                source_id=data.parent_id,
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
