from ai_core.base import ChatMessage, ChatRole
from ai_core.lineage import (
    budget_lineage_messages,
    estimate_tokens,
    get_ancestor_nodes,
    resolve_conversation_lineage,
)
from ai_core.tree import ConversationTree, TreeNode


def test_get_ancestor_nodes_deep_chain():
    root = TreeNode.create_root(content="Root question")
    resp1 = TreeNode.create_child(parent=root, content="Root response", role=ChatRole.ASSISTANT)
    branch1 = TreeNode.create_child(parent=resp1, content="Branch 1 question", role=ChatRole.USER)
    branch1_resp = TreeNode.create_child(
        parent=branch1, content="Branch 1 response", role=ChatRole.ASSISTANT
    )

    tree = ConversationTree(
        root_node_id=root.id,
        active_node_id=branch1_resp.id,
        nodes={
            root.id: root,
            resp1.id: resp1,
            branch1.id: branch1,
            branch1_resp.id: branch1_resp,
        },
    )

    ancestors = get_ancestor_nodes(tree, branch1_resp.id)
    assert len(ancestors) == 4
    assert [n.id for n in ancestors] == [root.id, resp1.id, branch1.id, branch1_resp.id]


def test_resolve_conversation_lineage_isolates_sibling_branches():
    root = TreeNode.create_root(content="Python Data Structures")
    resp = TreeNode.create_child(
        parent=root, content="Lists, Tuples, Dicts, Sets", role=ChatRole.ASSISTANT
    )

    # Branch A
    branch_a = TreeNode.create_child(
        parent=resp, content="How do lists work?", role=ChatRole.USER
    )
    branch_a_resp = TreeNode.create_child(
        parent=branch_a, content="Lists are dynamic arrays.", role=ChatRole.ASSISTANT
    )

    # Branch B (we branch from resp directly, not Branch A)
    tree = ConversationTree(
        root_node_id=root.id,
        active_node_id=resp.id,
        nodes={
            root.id: root,
            resp.id: resp,
            branch_a.id: branch_a,
            branch_a_resp.id: branch_a_resp,
        },
    )

    messages = resolve_conversation_lineage(
        tree=tree,
        target_node_id=resp.id,
        new_prompt="How do Dicts work?",
        highlighted_context="Dicts",
    )

    # Must contain root (user), resp (assistant), and new prompt (user)
    # Must NOT contain branch_a or branch_a_resp!
    assert len(messages) == 3
    assert messages[0].role == ChatRole.USER
    assert messages[0].content == "Python Data Structures"
    assert messages[1].role == ChatRole.ASSISTANT
    assert messages[1].content == "Lists, Tuples, Dicts, Sets"
    assert messages[2].role == ChatRole.USER
    assert '[Focusing on excerpt: "Dicts"]' in messages[2].content
    assert "How do Dicts work?" in messages[2].content


def test_budget_lineage_preserves_essential_anchors():
    messages = [
        ChatMessage.user("Root initial prompt"),  # Root (must be kept)
        ChatMessage.assistant("Intermediate response 1 " * 50),
        ChatMessage.user("Intermediate question 2 " * 50),
        ChatMessage.assistant("Intermediate response 2 " * 50),
        ChatMessage.assistant("Direct parent message"),  # Direct parent (must be kept)
        ChatMessage.user("New prompt"),  # New prompt (must be kept)
    ]

    # Set a tight budget that only fits anchors + latest intermediate
    budgeted = budget_lineage_messages(messages, max_tokens=100)

    assert len(budgeted) < len(messages)
    assert budgeted[0].content == "Root initial prompt"
    assert budgeted[-2].content == "Direct parent message"
    assert budgeted[-1].content == "New prompt"


def test_deep_15_level_branching_chain():
    root = TreeNode.create_root(content="Root topic: System Architecture")
    nodes = {root.id: root}
    current = root

    # Build a 15-level sequential lineage
    for i in range(1, 15):
        role = ChatRole.ASSISTANT if i % 2 == 1 else ChatRole.USER
        child = TreeNode.create_child(
            parent=current,
            content=f"Level {i} discussion point about architecture",
            role=role,
        )
        nodes[child.id] = child
        current = child

    tree = ConversationTree(
        root_node_id=root.id,
        active_node_id=current.id,
        nodes=nodes,
    )

    ancestors = get_ancestor_nodes(tree, current.id)
    assert len(ancestors) == 15

    messages = resolve_conversation_lineage(
        tree=tree,
        target_node_id=current.id,
        new_prompt="Explain sub-component scaling",
        highlighted_context="architecture",
        max_tokens=2000,
    )

    # All 15 messages + new prompt fit within 2000 tokens
    assert len(messages) == 16
    assert messages[0].content == "Root topic: System Architecture"
    assert "Explain sub-component scaling" in messages[-1].content
    assert estimate_tokens(messages[-1].content) > 0
