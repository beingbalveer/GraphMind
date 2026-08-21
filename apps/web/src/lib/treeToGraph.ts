import { ConversationTree, TreeNode, getNodeChildren } from "@graphmind/shared";
import { Node, Edge, MarkerType } from "@xyflow/react";

export interface CustomNodeData {
  node: TreeNode;
  isRoot: boolean;
  isActive: boolean;
  onSelectNode?: (nodeId: string) => void;
  [key: string]: unknown;
}

/**
 * Transform a ConversationTree into positioned React Flow nodes and directed edges.
 */
export function treeToGraph(
  tree: ConversationTree | null,
  activeNodeId?: string
): { nodes: Node<CustomNodeData>[]; edges: Edge[] } {
  if (!tree || !tree.rootNodeId || !tree.nodes[tree.rootNodeId]) {
    return { nodes: [], edges: [] };
  }

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
      const x = leafCounter * 360;
      const y = depth * 180;
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
    const y = depth * 180;
    positions.set(node.id, { x: midX, y });
    return midX;
  }

  calculatePositions(rootNode, 0);

  // Build React Flow nodes and edges
  for (const node of Object.values(tree.nodes)) {
    const pos = positions.get(node.id) || { x: 0, y: 0 };
    const isActive = node.id === activeNodeId;
    const isRoot = node.id === tree.rootNodeId;

    nodes.push({
      id: node.id,
      type: "customMessageNode",
      position: pos,
      data: {
        node,
        isRoot,
        isActive,
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
