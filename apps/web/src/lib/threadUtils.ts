import {
  ConversationTree,
  TreeNode,
  getNodeChildren,
} from "@graphmind/shared";

export interface ConversationThread {
  id: string; // ID of the thread's root node
  title: string;
  highlightedContext?: string;
  messages: TreeNode[];
  parentThreadId?: string;
  sourceMessageId?: string; // ID of the message in parent thread where this branched
  leafNodeId: string; // Deepest node ID in this thread
  isActive: boolean;
  isStreaming?: boolean;
}

export interface ThreadEdge {
  id: string;
  sourceThreadId: string;
  targetThreadId: string;
  highlightedContext?: string;
  isActive: boolean;
  isStreaming?: boolean;
}

/**
 * Groups a ConversationTree of micro-messages into high-level Thread Nodes (Obsidian Note-style),
 * where each linear continuous sequence of messages is 1 Node, and branching creates connected Sub-Thread Nodes.
 */
export function extractConversationThreads(
  tree: ConversationTree | null,
  activeNodeId?: string,
  isStreaming = false
): { threads: ConversationThread[]; edges: ThreadEdge[] } {
  if (!tree || !tree.rootNodeId || !tree.nodes[tree.rootNodeId]) {
    return { threads: [], edges: [] };
  }

  const threadsMap = new Map<string, ConversationThread>();
  const edges: ThreadEdge[] = [];
  const visitedNodes = new Set<string>();

  // Helper to get a clean, contextual title from a thread's initial message
  function getThreadTitle(node: TreeNode, isRoot: boolean): string {
    if (!node) return isRoot ? "Main Conversation" : "Branch";

    // 1. User custom rename or metadata title
    if (typeof node.metadata?.title === "string" && node.metadata.title.trim()) {
      return node.metadata.title.trim();
    }

    if (isRoot) return "Main Conversation";

    // Check siblings sharing this highlighted context to detect collisions
    let hasSameContextSiblings = false;
    if (node.parentId && node.highlightedContext) {
      const siblings = getNodeChildren(tree!, node.parentId);
      const sameCtx = siblings.filter((s) => s.highlightedContext === node.highlightedContext);
      if (sameCtx.length > 1) {
        hasSameContextSiblings = true;
      }
    }

    // If unique highlightedContext with no sibling collisions, use highlightedContext
    if (!hasSameContextSiblings && node.highlightedContext?.trim()) {
      return node.highlightedContext.trim();
    }

    // Derive intent from user prompt
    const content = node.content?.trim() || "";
    if (content) {
      // "Explain ..." pattern
      if (/^Explain\s+"[^"]+"\s+in\s+concise/i.test(content) || /^explain\b/i.test(content)) {
        return "Explain";
      }
      // "Code ..." pattern
      if (/^(show\s+)?code\b/i.test(content) || /^write\s+(the\s+)?code\b/i.test(content)) {
        return "Code";
      }
      // "Compare ..." pattern
      if (/^(compare|comparison)\b/i.test(content)) {
        return "Compare";
      }
      // "Benchmark / Performance" pattern
      if (/^(benchmark|benchmarks|performance)\b/i.test(content)) {
        return "Benchmarks";
      }
      // "Summary" pattern
      if (/^(summarize|summary)\b/i.test(content)) {
        return "Summary";
      }

      // Direct short prompt or first key phrase
      const firstLine = content.split("\n")[0].replace(/^[#>\s*-]+/, "").trim();
      const clean = firstLine.replace(/^["'`]+|["'`]+$/g, "").trim();

      if (clean.length <= 18) {
        return clean.charAt(0).toUpperCase() + clean.slice(1);
      }

      const words = clean.split(/\s+/);
      let title = "";
      for (const w of words) {
        if ((title + " " + w).trim().length > 18) break;
        title = (title + " " + w).trim();
      }
      if (title) {
        return title.charAt(0).toUpperCase() + title.slice(1);
      }
    }

    if (node.highlightedContext?.trim()) {
      return node.highlightedContext.trim();
    }

    return node.role === "user" ? "User Question" : "Branch Exploration";
  }

  // Recursive walker that groups continuous chains into threads
  function buildThread(
    startNodeId: string,
    parentThreadId?: string,
    sourceMessageId?: string
  ): string {
    const startNode = tree!.nodes[startNodeId];
    if (!startNode) return startNodeId;

    const threadId = startNodeId;
    const isRoot = startNodeId === tree!.rootNodeId;
    const title = getThreadTitle(startNode, isRoot);

    const threadMessages: TreeNode[] = [];
    let currentNode: TreeNode | null = startNode;
    let leafNodeId = startNodeId;

    // Follow the linear chain downwards until we hit branches or end of chain
    while (currentNode) {
      visitedNodes.add(currentNode.id);
      threadMessages.push(currentNode);
      leafNodeId = currentNode.id;

      const children = getNodeChildren(tree!, currentNode.id);

      if (children.length === 0) {
        break;
      } else if (children.length === 1 && !children[0].highlightedContext) {
        // Continuous linear turn without a new branch excerpt
        currentNode = children[0];
      } else {
        // One or more branch points created from this message!
        // The first child without highlightedContext (if any) continues this linear thread,
        // while children WITH highlightedContext (or secondary siblings) spawn new child threads.
        let continuedInCurrentThread = false;

        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (!child.highlightedContext && !continuedInCurrentThread && i === 0) {
            // Main continuation of this thread
            currentNode = child;
            continuedInCurrentThread = true;
          } else {
            // Child Thread branch!
            const childThreadId = buildThread(child.id, threadId, currentNode.id);

            const isEdgeActive = Boolean(
              activeNodeId &&
              (activeNodeId === child.id ||
                tree!.nodes[activeNodeId]?.parentId === currentNode.id)
            );

            edges.push({
              id: `${threadId}->${childThreadId}`,
              sourceThreadId: threadId,
              targetThreadId: childThreadId,
              highlightedContext: child.highlightedContext || undefined,
              isActive: isEdgeActive,
              isStreaming: isStreaming && childThreadId === activeNodeId,
            });
          }
        }

        if (!continuedInCurrentThread) {
          currentNode = null;
        }
      }
    }

    // Determine if this thread contains the currently active node
    const isThreadActive = Boolean(
      activeNodeId && threadMessages.some((m) => m.id === activeNodeId)
    );

    const isThreadStreaming = Boolean(
      isStreaming && isThreadActive && threadMessages[threadMessages.length - 1]?.role === "assistant"
    );

    threadsMap.set(threadId, {
      id: threadId,
      title,
      highlightedContext: startNode.highlightedContext || undefined,
      messages: threadMessages,
      parentThreadId,
      sourceMessageId,
      leafNodeId,
      isActive: isThreadActive,
      isStreaming: isThreadStreaming,
    });

    return threadId;
  }

  // Build threads starting from root
  buildThread(tree.rootNodeId);

  return {
    threads: Array.from(threadsMap.values()),
    edges,
  };
}
