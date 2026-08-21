from typing import List, Optional

from ai_core.base import ChatMessage
from ai_core.tree import ConversationTree, TreeNode


def estimate_tokens(text: str) -> int:
    """
    Fast character-to-token heuristic (approx 4 chars per token).
    """
    if not text:
        return 0
    return max(1, len(text) // 4)


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


def budget_lineage_messages(
    messages: List[ChatMessage],
    max_tokens: int = 8000,
) -> List[ChatMessage]:
    """
    Budget a long conversation lineage into a maximum token allocation.
    Guarantees retention of:
      1. Top Priority: New Prompt (last message)
      2. High Priority: Direct Parent Response (second-to-last message)
      3. Anchor Priority: Root Prompt (first message)
    Fills remaining budget with intermediate messages in recency order.
    """
    if not messages:
        return []

    # If small enough, keep all messages
    total_tokens = sum(estimate_tokens(m.content) for m in messages)
    if total_tokens <= max_tokens or len(messages) <= 3:
        return messages

    # Essential anchors
    new_prompt = messages[-1]
    direct_parent = messages[-2]
    root_prompt = messages[0]

    budget_remaining = max_tokens - (
        estimate_tokens(new_prompt.content)
        + estimate_tokens(direct_parent.content)
        + estimate_tokens(root_prompt.content)
    )

    if budget_remaining <= 0:
        return [root_prompt, direct_parent, new_prompt]

    # Intermediate messages between root and direct_parent
    intermediates = messages[1:-2]
    selected_intermediates: List[ChatMessage] = []

    # Iterate backwards from most recent intermediate to oldest
    for msg in reversed(intermediates):
        cost = estimate_tokens(msg.content)
        if cost <= budget_remaining:
            selected_intermediates.insert(0, msg)
            budget_remaining -= cost
        else:
            break

    return [root_prompt] + selected_intermediates + [direct_parent, new_prompt]


def resolve_conversation_lineage(
    tree: ConversationTree,
    target_node_id: Optional[str],
    new_prompt: str,
    highlighted_context: Optional[str] = None,
    max_tokens: Optional[int] = 8000,
) -> List[ChatMessage]:
    """
    Construct a coherent List[ChatMessage] representing the linear conversation
    ancestry from root down to the target branch point, appending the new user prompt.
    Applies token budgeting if max_tokens is provided.
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

    if max_tokens is not None and max_tokens > 0:
        return budget_lineage_messages(messages, max_tokens=max_tokens)

    return messages
