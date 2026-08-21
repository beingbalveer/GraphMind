from ai_core.base import ChatRole
from ai_core.lineage import get_ancestor_nodes, resolve_conversation_lineage
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

    # Branch B (we will branch from resp directly, not Branch A)
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
