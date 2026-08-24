import { ConversationTree } from "@graphmind/shared";
import { Node, Edge, MarkerType } from "@xyflow/react";
import { extractConversationThreads, ConversationThread } from "./threadUtils";
import { ThreadNodeData, ZoomMode } from "@/components/canvas/ThreadGraphNode";

export interface TreeToGraphOptions {
  activeNodeId?: string;
  isStreaming?: boolean;
  zoomMode?: ZoomMode;
  onSelectThread?: (threadId: string) => void;
  onDeleteThread?: (threadId: string) => void;
}

/**
 * Transform a ConversationTree into high-level Thread Nodes (Obsidian Note style) and directed branch edges.
 */
export function treeToGraph(
  tree: ConversationTree | null,
  options?: TreeToGraphOptions
): { nodes: Node<ThreadNodeData>[]; edges: Edge[]; threads: ConversationThread[] } {
  if (!tree || !tree.rootNodeId || !tree.nodes[tree.rootNodeId]) {
    return { nodes: [], edges: [], threads: [] };
  }

  const {
    activeNodeId = tree.activeNodeId,
    isStreaming = false,
    zoomMode = "capsule",
    onSelectThread,
    onDeleteThread,
  } = options || {};

  const { threads, edges: rawEdges } = extractConversationThreads(
    tree,
    activeNodeId,
    isStreaming
  );

  const nodes: Node<ThreadNodeData>[] = [];
  const edges: Edge[] = [];

  // Build tree hierarchy layout mapping
  const threadMap = new Map<string, ConversationThread>();
  threads.forEach((t) => threadMap.set(t.id, t));

  let leafCounter = 0;
  const positions = new Map<string, { x: number; y: number }>();

  function calculatePositions(threadId: string, depth: number) {
    const thread = threadMap.get(threadId);
    if (!thread) return 0;

    const childThreads = threads.filter((t) => t.parentThreadId === threadId);

    if (childThreads.length === 0) {
      const x = depth * 320;
      const y = leafCounter * 80;
      positions.set(threadId, { x, y });
      leafCounter += 1;
      return y;
    }

    const childYCoords: number[] = [];
    for (const child of childThreads) {
      const childY = calculatePositions(child.id, depth + 1);
      childYCoords.push(childY);
    }

    const midY = (childYCoords[0] + childYCoords[childYCoords.length - 1]) / 2;
    const x = depth * 320;
    positions.set(threadId, { x, y: midY });
    return midY;
  }

  const rootThread = threads.find((t) => !t.parentThreadId);
  if (rootThread) {
    calculatePositions(rootThread.id, 0);
  }

  for (const thread of threads) {
    const pos = positions.get(thread.id) || { x: 0, y: 0 };

    nodes.push({
      id: thread.id,
      type: "threadGraphNode",
      position: pos,
      data: {
        thread,
        zoomMode,
        onSelectThread,
        onDeleteThread,
      },
    });
  }

  for (const edge of rawEdges) {
    edges.push({
      id: edge.id,
      source: edge.sourceThreadId,
      target: edge.targetThreadId,
      type: "mindMapEdge",
      animated: edge.isStreaming,
      data: {
        isActiveLineage: edge.isActive,
        isStreaming: edge.isStreaming,
        highlightedContext: edge.highlightedContext,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 14,
        height: 14,
        color: edge.isActive ? "#18181b" : "#d4d4d8",
      },
    });
  }

  return { nodes, edges, threads };
}
