import { ConversationTree, TreeNode, getNodeChildren } from "@graphmind/shared";
import { Node, Edge, MarkerType } from "@xyflow/react";

export interface CustomNodeData {
  node: TreeNode;
  isRoot: boolean;
  isActive: boolean;
  totalSiblings?: number;
  siblingIndex?: number;
  onExploreBranch?: (nodeId: string, contextText?: string) => void;
  onSwitchToChat?: (nodeId: string) => void;
  [key: string]: unknown;
}

export interface TreeToGraphOptions {
  activeNodeId?: string;
  onExploreBranch?: (nodeId: string, contextText?: string) => void;
  onSwitchToChat?: (nodeId: string) => void;
}

/**
 * Transform a ConversationTree into positioned React Flow nodes and directed edges.
 */
export function treeToGraph(
  tree: ConversationTree | null,
  options?: TreeToGraphOptions
): { nodes: Node<CustomNodeData>[]; edges: Edge[] } {
  if (!tree || !tree.rootNodeId || !tree.nodes[tree.rootNodeId]) {
    return { nodes: [], edges: [] };
  }

  const { activeNodeId, onExploreBranch, onSwitchToChat } = options || {};
  const nodes: Node<CustomNodeData>[] = [];
  const edges: Edge[] = [];
  const rootNode = tree.nodes[tree.rootNodeId];

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

    let totalSiblings = 1;
    let siblingIndex = 0;
    if (node.parentId && tree.nodes[node.parentId]) {
      const siblings = getNodeChildren(tree, node.parentId);
      totalSiblings = siblings.length;
      siblingIndex = siblings.findIndex((s) => s.id === node.id);
    }

    nodes.push({
      id: node.id,
      type: "customMessageNode",
      position: pos,
      data: {
        node,
        isRoot,
        isActive,
        totalSiblings,
        siblingIndex,
        onExploreBranch,
        onSwitchToChat,
      },
    });

    if (node.parentId && tree.nodes[node.parentId]) {
      const isParentActive = node.parentId === activeNodeId || isActive;
      edges.push({
        id: `${node.parentId}->${node.id}`,
        source: node.parentId,
        target: node.id,
        type: "smoothstep",
        animated: isActive,
        style: {
          stroke: isParentActive ? "#18181b" : "#d4d4d8",
          strokeWidth: isParentActive ? 2 : 1.5,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: isParentActive ? "#18181b" : "#a1a1aa",
        },
      });
    }
  }

  return { nodes, edges };
}
