import json

from ai_core.base import ChatRole
from ai_core.tree import ConversationTree, TreeNode


def test_create_root_node():
    root = TreeNode.create_root(content="What is GraphMind?")
    assert root.parent_id is None
    assert root.children_ids == []
    assert root.role == ChatRole.USER
    assert root.content == "What is GraphMind?"
    assert root.id.startswith("node_")
    assert root.highlighted_context is None


def test_create_child_node():
    root = TreeNode.create_root(content="Explain quantum computing.")
    child = TreeNode.create_child(
        parent=root,
        content="Quantum computing uses qubits...",
        role=ChatRole.ASSISTANT,
        provider="gemini",
        model="gemini-2.5-flash",
    )

    assert child.parent_id == root.id
    assert child.id in root.children_ids
    assert child.role == ChatRole.ASSISTANT
    assert child.provider == "gemini"
    assert child.model == "gemini-2.5-flash"


def test_node_branching_with_highlighted_context():
    root = TreeNode.create_root(content="Explain machine learning.")
    resp = TreeNode.create_child(
        parent=root,
        content="Supervised learning uses labeled datasets to train models.",
        role=ChatRole.ASSISTANT,
    )
    branch = TreeNode.create_child(
        parent=resp,
        content="How do loss functions work in supervised learning?",
        role=ChatRole.USER,
        highlighted_context="Supervised learning uses labeled datasets",
    )

    assert branch.parent_id == resp.id
    assert branch.highlighted_context == "Supervised learning uses labeled datasets"
    assert branch.id in resp.children_ids


def test_tree_serialization():
    root = TreeNode.create_root(content="Root prompt", metadata={"tag": "start"})
    resp = TreeNode.create_child(parent=root, content="Root response", role=ChatRole.ASSISTANT)

    tree = ConversationTree(
        root_node_id=root.id,
        active_node_id=resp.id,
        nodes={root.id: root, resp.id: resp},
    )

    json_str = tree.model_dump_json()
    data = json.loads(json_str)

    assert data["root_node_id"] == root.id
    assert data["active_node_id"] == resp.id
    assert root.id in data["nodes"]
    assert resp.id in data["nodes"]
    assert data["nodes"][root.id]["metadata"]["tag"] == "start"


def test_conversation_tree_add_node():
    root = TreeNode.create_root(content="Initial question")
    tree = ConversationTree(
        root_node_id=root.id,
        active_node_id=root.id,
        nodes={root.id: root},
    )

    child = TreeNode(
        parent_id=root.id,
        role=ChatRole.ASSISTANT,
        content="Initial answer",
    )
    tree.add_node(child)

    assert child.id in tree.nodes
    assert child.id in tree.nodes[root.id].children_ids
    assert tree.get_node(child.id) is not None
    assert tree.get_node("non_existent") is None
