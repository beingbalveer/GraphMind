from typing import List, Optional, Tuple

import structlog
from models.workspace import EdgeModel, NodeModel, Workspace
from schemas.workspace import (
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
        session: AsyncSession, workspace_id: str
    ) -> Optional[GraphSnapshotResponse]:
        """
        Retrieve complete graph topology (nodes, edges, root, active node) for a workspace.
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
            for n in ws.nodes
        ]

        root_node = next((n for n in ws.nodes if n.parent_id is None), None)
        root_id = root_node.id if root_node else (ws.nodes[0].id if ws.nodes else None)
        active_id = ws.nodes[-1].id if ws.nodes else None

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
            edges=[
                EdgeResponse(
                    id=e.id,
                    workspace_id=e.workspace_id,
                    source_id=e.source_id,
                    target_id=e.target_id,
                    relation_type=e.relation_type,
                    highlighted_context=e.highlighted_context,
                    created_at=e.created_at,
                )
                for e in ws.edges
            ],
            root_node_id=root_id,
            active_node_id=active_id,
        )

    @staticmethod
    async def add_node_and_edge(
        session: AsyncSession, workspace_id: str, data: NodeCreate
    ) -> NodeResponse:
        """
        Add a conversation node to a workspace and automatically create the directed edge from parent.
        """
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

        if data.parent_id:
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
