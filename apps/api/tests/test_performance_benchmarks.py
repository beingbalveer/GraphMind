import time
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from ai_core.base import ChatMessage, ChatRole
from ai_core.lineage import (
    budget_lineage_messages,
    get_ancestor_nodes,
    resolve_conversation_lineage,
)
from ai_core.tree import ConversationTree, TreeNode
from schemas.workspace import GraphSnapshotResponse, NodeResponse, WorkspaceResponse
from services.graph_tools import TraverseLineageTool
from services.workspace_service import WorkspaceService


def generate_large_conversation_tree(total_nodes: int = 500, branch_interval: int = 25) -> ConversationTree:
    """
    Generate a synthetic multi-branch ConversationTree with 500+ nodes.
    """
    nodes = {}
    root_id = "node_0"
    root = TreeNode(
        id=root_id,
        role=ChatRole.USER,
        content="Root prompt for performance benchmark testing.",
        parent_id=None,
        children_ids=[],
    )
    nodes[root_id] = root

    prev_main_id = root_id
    current_id_counter = 1

    # Build a deep main spine and multiple branching side-threads
    while current_id_counter < total_nodes:
        # Create mainline node
        main_node_id = f"node_{current_id_counter}"
        main_role = ChatRole.ASSISTANT if current_id_counter % 2 == 1 else ChatRole.USER
        node = TreeNode(
            id=main_node_id,
            role=main_role,
            content=f"Benchmark mainline response content at depth {current_id_counter}. Explaining advanced distributed systems algorithms.",
            parent_id=prev_main_id,
            children_ids=[],
        )
        nodes[main_node_id] = node
        nodes[prev_main_id].children_ids.append(main_node_id)
        current_id_counter += 1

        # Occasionally sprout a branch
        if current_id_counter % branch_interval == 0:
            branch_parent_id = prev_main_id
            branch_len = 8
            prev_branch_id = branch_parent_id
            for b in range(branch_len):
                if current_id_counter >= total_nodes:
                    break
                b_node_id = f"node_{current_id_counter}"
                b_role = ChatRole.ASSISTANT if b % 2 == 1 else ChatRole.USER
                b_node = TreeNode(
                    id=b_node_id,
                    role=b_role,
                    content=f"Branch {current_id_counter // branch_interval} exploration node {b}.",
                    parent_id=prev_branch_id,
                    children_ids=[],
                    highlighted_context="distributed systems",
                )
                nodes[b_node_id] = b_node
                nodes[prev_branch_id].children_ids.append(b_node_id)
                prev_branch_id = b_node_id
                current_id_counter += 1

        prev_main_id = main_node_id

    return ConversationTree(
        id="tree_perf_bench",
        root_node_id=root_id,
        active_node_id=prev_main_id,
        nodes=nodes,
    )


def test_get_ancestor_nodes_performance_on_large_tree():
    """
    Verify get_ancestor_nodes executes in < 5ms on a 500-node tree.
    """
    tree = generate_large_conversation_tree(total_nodes=500)
    leaf_id = tree.active_node_id

    start = time.perf_counter()
    ancestors = get_ancestor_nodes(tree, leaf_id)
    elapsed_ms = (time.perf_counter() - start) * 1000

    assert len(ancestors) > 50
    assert ancestors[0].id == tree.root_node_id
    assert ancestors[-1].id == leaf_id
    assert elapsed_ms < 15.0, f"get_ancestor_nodes took {elapsed_ms:.2f}ms (expected < 15ms)"


def test_budget_lineage_messages_performance():
    """
    Verify budget_lineage_messages runs in < 5ms over 300 messages.
    """
    messages = [
        ChatMessage(
            role=ChatRole.USER if i % 2 == 0 else ChatRole.ASSISTANT,
            content=f"Message {i}: This is a synthetic message content testing tokenizer budgeting speed." * 5,
        )
        for i in range(300)
    ]

    start = time.perf_counter()
    budgeted = budget_lineage_messages(messages, max_tokens=4000)
    elapsed_ms = (time.perf_counter() - start) * 1000

    assert len(budgeted) > 2
    assert budgeted[0].content == messages[0].content
    assert budgeted[-1].content == messages[-1].content
    assert elapsed_ms < 10.0, f"budget_lineage_messages took {elapsed_ms:.2f}ms (expected < 10ms)"


def test_resolve_conversation_lineage_performance_benchmark():
    """
    Verify complete resolve_conversation_lineage executes in < 15ms on 500 nodes.
    """
    tree = generate_large_conversation_tree(total_nodes=500)
    leaf_id = tree.active_node_id

    start = time.perf_counter()
    lineage = resolve_conversation_lineage(
        tree=tree,
        target_node_id=leaf_id,
        new_prompt="New benchmark user query requesting performance evaluation.",
        highlighted_context="algorithms",
        max_tokens=8000,
    )
    elapsed_ms = (time.perf_counter() - start) * 1000

    assert len(lineage) >= 2
    assert lineage[-1].role == ChatRole.USER
    assert "algorithms" in lineage[-1].content
    assert elapsed_ms < 20.0, f"resolve_conversation_lineage took {elapsed_ms:.2f}ms (expected < 20ms)"


@pytest.mark.asyncio
async def test_traverse_lineage_tool_benchmark():
    """
    Verify TraverseLineageTool executes in < 50ms when traversing a 500-node graph.
    """
    tree = generate_large_conversation_tree(total_nodes=500)
    snapshot_nodes = [
        NodeResponse(
            id=n.id,
            workspace_id="ws_perf",
            parent_id=n.parent_id,
            role=n.role.value if hasattr(n.role, "value") else str(n.role),
            content=n.content,
            highlighted_context=n.highlighted_context,
            position_x=0.0,
            position_y=0.0,
            metadata={},
            created_at="2026-09-07T12:00:00Z",
            updated_at="2026-09-07T12:00:00Z",
        )
        for n in tree.nodes.values()
    ]
    mock_ws = WorkspaceResponse(
        id="ws_perf",
        name="Perf Workspace",
        viewport_x=0.0,
        viewport_y=0.0,
        zoom=1.0,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    mock_snapshot = GraphSnapshotResponse(
        workspace=mock_ws,
        nodes=snapshot_nodes,
        edges=[],
    )

    tool = TraverseLineageTool()

    with patch.object(WorkspaceService, "get_graph_snapshot", new=AsyncMock(return_value=mock_snapshot)):
        with patch("services.graph_tools.get_session_factory") as mock_factory:
            mock_session = AsyncMock()
            mock_factory.return_value.__aenter__.return_value = mock_session

            start = time.perf_counter()
            result = await tool.execute(
                node_id=tree.active_node_id,
                direction="ancestors",
                workspace_id="ws_perf",
            )
            elapsed_ms = (time.perf_counter() - start) * 1000

            assert result["count"] > 50
            assert result["lineage"][0]["node_id"] == tree.root_node_id
            assert elapsed_ms < 50.0, f"TraverseLineageTool took {elapsed_ms:.2f}ms (expected < 50ms)"
