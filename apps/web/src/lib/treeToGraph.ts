import {
  ConversationTree,
  TreeNode,
  getNodeChildren,
  getAncestorPath,
} from "@graphmind/shared";
import { Node, Edge, MarkerType } from "@xyflow/react";
import { MindMapNodeData, ZoomMode } from "@/components/canvas/MindMapNode";

export interface CustomNodeData {
  node: TreeNode;
  isRoot: boolean;
  isActive: boolean;
  isStreaming?: boolean;
  totalSiblings?: number;
  siblingIndex?: number;
  childCount?: number;
  zoomMode?: ZoomMode;
  onExploreBranch?: (nodeId: string, contextText?: string) => void;
  onSwitchToChat?: (nodeId: string) => void;
  onRetry?: () => void;
  [key: string]: unknown;
}

export interface TreeToGraphOptions {
  activeNodeId?: string;
  isStreaming?: boolean;
  zoomMode?: ZoomMode;
  onExploreBranch?: (nodeId: string, contextText?: string) => void;
  onSwitchToChat?: (nodeId: string) => void;
  onRetry?: () => void;
}

/**
 * Transform a ConversationTree into positioned React Flow nodes and custom directed edges.
 */
export function treeToGraph(
  tree: ConversationTree | null,
  options?: TreeToGraphOptions
): { nodes: Node<MindMapNodeData>[]; edges: Edge[] } {
  if (!tree || !tree.rootNodeId || !tree.nodes[tree.rootNodeId]) {
    return { nodes: [], edges: [] };
  }

  const {
    activeNodeId = tree.activeNodeId,
    isStreaming = false,
    zoomMode = "capsule",
    onExploreBranch,
    onSwitchToChat,
    onRetry,
  } = options || {};

  const nodes: Node<MindMapNodeData>[] = [];
  const edges: Edge[] = [];
  const rootNode = tree.nodes[tree.rootNodeId];

  // Active lineage path nodes set
  const activePath = getAncestorPath(tree, activeNodeId);
  const activePathIds = new Set(activePath.map((n) => n.id));

  // Map to track coordinates
  let leafCounter = 0;
  const positions = new Map<string, { x: number; y: number }>();

  // Helper function to assign hierarchical coordinates (horizontal layout: x is depth, y is sibling order)
  function calculatePositions(node: TreeNode, depth: number) {
    const children = getNodeChildren(tree!, node.id);

    if (children.length === 0) {
      const x = depth * 280;
      const y = leafCounter * 60;
      positions.set(node.id, { x, y });
      leafCounter += 1;
      return y;
    }

    const childYCoords: number[] = [];
    for (const child of children) {
      const childY = calculatePositions(child, depth + 1);
      childYCoords.push(childY);
    }

    // Center parent relative to children
    const midY = (childYCoords[0] + childYCoords[childYCoords.length - 1]) / 2;
    const x = depth * 280;
    positions.set(node.id, { x, y: midY });
    return midY;
  }

  calculatePositions(rootNode, 0);

  // Build React Flow nodes and edges
  for (const node of Object.values(tree.nodes)) {
    const pos = positions.get(node.id) || { x: 0, y: 0 };
    const isActive = node.id === activeNodeId;
    const isRoot = node.id === tree.rootNodeId;
    const isNodeStreaming = isActive && node.role === "assistant" && isStreaming;

    let totalSiblings = 1;
    let siblingIndex = 0;
    if (node.parentId && tree.nodes[node.parentId]) {
      const siblings = getNodeChildren(tree, node.parentId);
      totalSiblings = siblings.length;
      siblingIndex = siblings.findIndex((s) => s.id === node.id);
    }

    const children = getNodeChildren(tree, node.id);

    nodes.push({
      id: node.id,
      type: "mindMapNode",
      position: pos,
      data: {
        node,
        isRoot,
        isActive,
        isStreaming: isNodeStreaming,
        totalSiblings,
        siblingIndex,
        childCount: children.length,
        zoomMode,
        onExploreBranch,
        onSwitchToChat,
        onRetry,
      },
    });

    if (node.parentId && tree.nodes[node.parentId]) {
      const isEdgeInActiveLineage =
        activePathIds.has(node.parentId) && activePathIds.has(node.id);
      const isTargetStreaming = isStreaming && node.id === activeNodeId;

      edges.push({
        id: `${node.parentId}->${node.id}`,
        source: node.parentId,
        target: node.id,
        type: "mindMapEdge",
        animated: isTargetStreaming,
        data: {
          isActiveLineage: isEdgeInActiveLineage,
          isStreaming: isTargetStreaming,
          highlightedContext: node.highlightedContext,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 12,
          height: 12,
          color: isEdgeInActiveLineage ? "#18181b" : "#d4d4d8",
        },
      });
    }
  }

  return { nodes, edges };
}
