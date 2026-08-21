import dagre from "@dagrejs/dagre";
import { Node, Edge, Position } from "@xyflow/react";
import { CustomNodeData } from "./treeToGraph";

export type LayoutDirection = "TB" | "LR";

const NODE_WIDTH = 320;
const NODE_HEIGHT = 160;

/**
 * Computes deterministic, collision-free hierarchical coordinates for nodes and edges
 * using the Dagre directed graph layout engine.
 */
export function getLayoutedElements(
  nodes: Node<CustomNodeData>[],
  edges: Edge[],
  direction: LayoutDirection = "TB"
): { nodes: Node<CustomNodeData>[]; edges: Edge[] } {
  if (nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const isHorizontal = direction === "LR";
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: isHorizontal ? 120 : 90,
    nodesep: isHorizontal ? 70 : 80,
    marginx: 40,
    marginy: 40,
  });

  // Register nodes with dimensions
  for (const node of nodes) {
    dagreGraph.setNode(node.id, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
  }

  // Register edges
  for (const edge of edges) {
    dagreGraph.setEdge(edge.source, edge.target);
  }

  dagre.layout(dagreGraph);

  // Apply computed coordinates to nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const targetPosition = isHorizontal ? Position.Left : Position.Top;
    const sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

    return {
      ...node,
      targetPosition,
      sourcePosition,
      position: {
        // Dagre uses center point, convert to top-left corner for React Flow
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}
