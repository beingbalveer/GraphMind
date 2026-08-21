import {
  ConversationTree,
  TreeNode,
  getNodeChildren,
  getAncestorPath,
} from "@graphmind/shared";
import { Node, Edge, MarkerType } from "@xyflow/react";

export interface CustomNodeData {
  node: TreeNode;
  isRoot: boolean;
  isActive: boolean;
  isStreaming?: boolean;
  totalSiblings?: number;
  siblingIndex?: number;
  childCount?: number;
  onExploreBranch?: (nodeId: string, contextText?: string) => void;
  onSwitchToChat?: (nodeId: string) => void;
  onRetry?: () => void;
  [key: string]: unknown;
}

export interface TreeToGraphOptions {
  activeNodeId?: string;
  isStreaming?: boolean;
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
): { nodes: Node<CustomNodeData>[]; edges: Edge[] } {
  if (!tree || !tree.rootNodeId || !tree.nodes[tree.rootNodeId]) {
    return { nodes: [], edges: [] };
  }

  const {
    activeNodeId = tree.activeNodeId,
    isStreaming = false,
    onExploreBranch,
    onSwitchToChat,
    onRetry,
  } = options || {};

  const nodes: Node<CustomNodeData>[] = [];
  const edges: Edge[] = [];
  const rootNode = tree.nodes[tree.rootNodeId];

  // Active lineage path nodes set
  const activePath = getAncestorPath(tree, activeNodeId);
  const activePathIds = new Set(activePath.map((n) => n.id));

  // Map to track the horizontal offset allocated for subtrees at each level
  let leafCounter = 0;
  const positions = new Map<string, { x: number; y: number }>();

  // Helper function to assign hierarchical coordinates
  function calculatePositions(node: TreeNode, depth: number) {
    const children = getNodeChildren(tree!, node.id);

    if (children.length === 0) {
      const x = leafCounter * 380;
      const y = depth * 220;
      positions.set(node.id, { x, y });
      leafCounter += 1;
      return x;
    }

    const childXCoords: number[] = [];
    for (const child of children) {
      const childX = calculatePositions(child, depth + 1);
      childXCoords.push(childX);
    }

    // Center parent above its children
    const midX = (childXCoords[0] + childXCoords[childXCoords.length - 1]) / 2;
    const y = depth * 220;
    positions.set(node.id, { x: midX, y });
    return midX;
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
      type: "customMessageNode",
      position: pos,
      data: {
        node,
        isRoot,
        isActive,
        isStreaming: isNodeStreaming,
        totalSiblings,
        siblingIndex,
        childCount: children.length,
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
        type: "customBranchEdge",
        animated: isTargetStreaming,
        data: {
          isActive: isEdgeInActiveLineage,
          isStreaming: isTargetStreaming,
          highlightedContext: node.highlightedContext,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: isEdgeInActiveLineage ? "#18181b" : "#a1a1aa",
        },
      });
    }
  }

  return { nodes, edges };
}
