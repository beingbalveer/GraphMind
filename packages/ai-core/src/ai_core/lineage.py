from typing import List, Optional

from ai_core.base import ChatMessage
from ai_core.tree import ConversationTree, TreeNode


def get_ancestor_nodes(tree: ConversationTree, node_id: str) -> List[TreeNode]:
    """
    Traverse from target node_id back to root, returning ordered list [Root, ..., TargetNode].
    """
    path: List[TreeNode] = []
    current: Optional[TreeNode] = tree.get_node(node_id)

    while current is not None:
        path.insert(0, current)
        if current.parent_id is None:
            break
        current = tree.get_node(current.parent_id)

    return path


def resolve_conversation_lineage(
    tree: ConversationTree,
    target_node_id: Optional[str],
    new_prompt: str,
    highlighted_context: Optional[str] = None,
) -> List[ChatMessage]:
    """
    Construct a coherent List[ChatMessage] representing the linear conversation
    ancestry from root down to the target branch point, appending the new user prompt.
    """
    messages: List[ChatMessage] = []

    # If target_node_id is provided and exists in tree, build ancestor history
    if target_node_id and target_node_id in tree.nodes:
        ancestors = get_ancestor_nodes(tree, target_node_id)
        for node in ancestors:
            messages.append(
                ChatMessage(
                    role=node.role,
                    content=node.content,
                    metadata=node.metadata,
                )
            )

    # Format the new prompt with highlighted context if present
    if highlighted_context and highlighted_context.strip():
        formatted_content = (
            f"[Focusing on excerpt: \"{highlighted_context.strip()}\"]\n\n{new_prompt.strip()}"
        )
    else:
        formatted_content = new_prompt.strip()

    messages.append(ChatMessage.user(formatted_content))
    return messages
