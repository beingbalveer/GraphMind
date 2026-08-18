import { create } from "zustand";
import {
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  Connection,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge as addReactFlowEdge,
} from "@xyflow/react";

export interface GraphState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;

  // React Flow Handlers
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  // Actions
  setSelectedNodeId: (id: string | null) => void;
  addNode: (node: Node) => void;
  addEdge: (edge: Edge) => void;
  resetLayout: () => void;
}

const initialNodes: Node[] = [
  {
    id: "node-root-1",
    type: "promptNode",
    position: { x: 250, y: 100 },
    data: {
      label: "Initial Prompt",
      prompt: "What is GraphMind and how does graph-native AI work?",
      createdAt: new Date().toISOString(),
    },
  },
  {
    id: "node-response-1",
    type: "responseNode",
    position: { x: 250, y: 280 },
    data: {
      label: "AI Response",
      title: "Graph-Native Knowledge Representation",
      content:
        "GraphMind is an open-source, AI-native knowledge workspace where conversations branch into interactive knowledge maps rather than remaining linear streams.\n\nKey Concepts:\n• Knowledge is the primary product; chat is just the interface.\n• Every response becomes an interactive node.\n• Highlight text to branch off into focused sub-explorations.",
      model: "gpt-4o-mini",
      createdAt: new Date().toISOString(),
    },
  },
  {
    id: "node-branch-1",
    type: "promptNode",
    position: { x: -100, y: 520 },
    data: {
      label: "Sub-Branch Prompt",
      prompt: "Explain text-highlight branching in detail.",
      createdAt: new Date().toISOString(),
    },
  },
  {
    id: "node-branch-2",
    type: "promptNode",
    position: { x: 600, y: 520 },
    data: {
      label: "Sub-Branch Prompt",
      prompt: "How does provider abstraction work in ai-core?",
      createdAt: new Date().toISOString(),
    },
  },
];

const initialEdges: Edge[] = [
  {
    id: "edge-root-to-res",
    source: "node-root-1",
    target: "node-response-1",
    type: "smoothstep",
    animated: true,
    style: { stroke: "#0284c7", strokeWidth: 2 },
  },
  {
    id: "edge-res-to-b1",
    source: "node-response-1",
    target: "node-branch-1",
    type: "smoothstep",
    label: "Branch from: Highlight Branching",
    style: { stroke: "#10b981", strokeWidth: 2 },
  },
  {
    id: "edge-res-to-b2",
    source: "node-response-1",
    target: "node-branch-2",
    type: "smoothstep",
    label: "Branch from: Provider Abstraction",
    style: { stroke: "#a855f7", strokeWidth: 2 },
  },
];

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  selectedNodeId: null,

  onNodesChange: (changes: NodeChange[]) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },

  onEdgesChange: (changes: EdgeChange[]) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },

  onConnect: (connection: Connection) => {
    set({
      edges: addReactFlowEdge(connection, get().edges),
    });
  },

  setSelectedNodeId: (id: string | null) => {
    set({ selectedNodeId: id });
  },

  addNode: (node: Node) => {
    set((state) => ({ nodes: [...state.nodes, node] }));
  },

  addEdge: (edge: Edge) => {
    set((state) => ({ edges: [...state.edges, edge] }));
  },

  resetLayout: () => {
    set({
      nodes: initialNodes,
      edges: initialEdges,
      selectedNodeId: null,
    });
  },
}));
