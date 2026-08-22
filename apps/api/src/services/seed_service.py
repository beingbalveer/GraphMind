import uuid
from typing import Tuple

import structlog
from schemas.workspace import NodeCreate, WorkspaceCreate
from services.workspace_service import WorkspaceService
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()


async def seed_demo_workspace(session: AsyncSession) -> Tuple[str, str]:
    """
    Creates the 'GraphMind Workspace' demo workspace with pre-populated chats and nodes.
    Returns (workspace_id, chat1_root_node_id).
    """
    logger.info("Seeding demo workspace...")

    # 1. Create the Workspace
    ws_data = WorkspaceCreate(
        name="GraphMind Workspace",
        description="A living tutorial on how to use GraphMind.",
    )
    workspace = await WorkspaceService.create_workspace(session, ws_data)
    ws_id = workspace.id

    # 2. Define Node Data Generator Helpers
    def gen_id() -> str:
        return str(uuid.uuid4())

    def create_node(id_val: str, parent_id: str | None, role: str, content: str) -> NodeCreate:
        return NodeCreate(
            id=id_val,
            parent_id=parent_id,
            role=role,
            content=content,
            provider="system" if role == "assistant" else None,
            model="demo" if role == "assistant" else None,
        )

    # ---------------------------------------------------------
    # CHAT 1: What is GraphMind? (Meta Layer)
    # ---------------------------------------------------------
    c1_n1_id = gen_id()
    c1_n2_id = gen_id()
    c1_n3_id = gen_id()
    c1_n4_id = gen_id()
    c1_n5_id = gen_id()
    c1_n6_id = gen_id()

    # Root user message
    await WorkspaceService.add_node_and_edge(
        session, ws_id, create_node(c1_n1_id, None, "user", "What is GraphMind?")
    )

    # Assistant reply
    await WorkspaceService.add_node_and_edge(
        session,
        ws_id,
        create_node(
            c1_n2_id,
            c1_n1_id,
            "assistant",
            "GraphMind is a knowledge workspace where your conversations branch out into a spatial graph. "
            "Instead of a single scrolling list, your ideas map out visually like a tree, "
            "letting you explore different tangents without losing your original context.",
        ),
    )

    # Branch A: Why graphs?
    await WorkspaceService.add_node_and_edge(
        session,
        ws_id,
        create_node(
            c1_n3_id, c1_n2_id, "user", "Why use a graph instead of standard chat history?"
        ),
    )
    await WorkspaceService.add_node_and_edge(
        session,
        ws_id,
        create_node(
            c1_n4_id,
            c1_n3_id,
            "assistant",
            "Because human thought isn't linear! When you're brainstorming or learning, "
            "one answer usually sparks multiple new questions. In a standard chat, exploring one question means abandoning the others. "
            "Here, you can just start a new branch. Try selecting text in a message to create a branch!",
        ),
    )

    # Branch B: Show me an example
    await WorkspaceService.add_node_and_edge(
        session, ws_id, create_node(c1_n5_id, c1_n2_id, "user", "Show me a real example.")
    )
    await WorkspaceService.add_node_and_edge(
        session,
        ws_id,
        create_node(
            c1_n6_id,
            c1_n5_id,
            "assistant",
            "Check out the other chat in the sidebar titled 'How does the human brain learn?' "
            "It demonstrates how you can break down a complex topic into connected concepts.",
        ),
    )

    # ---------------------------------------------------------
    # CHAT 2: How the brain learns (Topic Layer)
    # ---------------------------------------------------------
    c2_n1_id = gen_id()
    c2_n2_id = gen_id()
    c2_n3_id = gen_id()
    c2_n4_id = gen_id()
    c2_n5_id = gen_id()
    c2_n6_id = gen_id()

    # Root user message
    await WorkspaceService.add_node_and_edge(
        session, ws_id, create_node(c2_n1_id, None, "user", "How does the human brain learn?")
    )

    # Assistant reply
    await WorkspaceService.add_node_and_edge(
        session,
        ws_id,
        create_node(
            c2_n2_id,
            c2_n1_id,
            "assistant",
            "Learning is physically wiring the brain! When you learn something new, neurons fire together and form new synapses (connections). "
            "The more often you recall the information, the stronger those connections become. This relies heavily on spaced repetition.",
        ),
    )

    # Branch A: Spaced repetition
    await WorkspaceService.add_node_and_edge(
        session, ws_id, create_node(c2_n3_id, c2_n2_id, "user", "What is spaced repetition?")
    )
    await WorkspaceService.add_node_and_edge(
        session,
        ws_id,
        create_node(
            c2_n4_id,
            c2_n3_id,
            "assistant",
            "It's a learning technique where you review information at gradually increasing intervals. "
            "Instead of cramming, you review a concept after 1 day, then 3 days, then a week. "
            "This actively interrupts the 'forgetting curve' and builds long-term memory.",
        ),
    )

    # Branch B: Tying it back
    await WorkspaceService.add_node_and_edge(
        session,
        ws_id,
        create_node(
            c2_n5_id, c2_n2_id, "user", "How does this relate to how I should use GraphMind?"
        ),
    )
    await WorkspaceService.add_node_and_edge(
        session,
        ws_id,
        create_node(
            c2_n6_id,
            c2_n5_id,
            "assistant",
            "By mapping out ideas spatially, you are mirroring how neural networks form connections. "
            "When you revisit this graph later, seeing the visual layout of branches helps trigger your spatial memory, "
            "making it easier to recall the whole concept at once!",
        ),
    )

    # The transaction will be committed by the router dependency.
    logger.info(f"Demo workspace seeded successfully. ID: {ws_id}")
    return str(ws_id), str(c1_n1_id)
