import dagre from "@dagrejs/dagre";
import { Node, Edge, Position } from "@xyflow/react";
import { ThreadNodeData } from "@/components/canvas/ThreadGraphNode";

export type LayoutDirection = "TB" | "LR";

const NODE_WIDTH = 230;
const NODE_HEIGHT = 52;

/**
 * Computes deterministic, collision-free hierarchical coordinates for Thread nodes and edges
 * using the Dagre directed graph layout engine.
 */
export function getLayoutedElements(
  nodes: Node<ThreadNodeData>[],
  edges: Edge[],
  direction: LayoutDirection = "LR"
): { nodes: Node<ThreadNodeData>[]; edges: Edge[] } {
  if (nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const isHorizontal = direction === "LR";
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: isHorizontal ? 90 : 70,
    nodesep: isHorizontal ? 35 : 60,
    marginx: 40,
    marginy: 40,
  });

  // Register nodes with compact note dimensions
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
