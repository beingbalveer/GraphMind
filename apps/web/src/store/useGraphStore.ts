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
  isStreaming: boolean;

  // React Flow Handlers
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  // Actions
  setSelectedNodeId: (id: string | null) => void;
  addNode: (node: Node) => void;
  addEdge: (edge: Edge) => void;
  sendPrompt: (promptText: string, provider?: string, model?: string) => Promise<void>;
  resetLayout: () => void;
}

const initialNodes: Node[] = [
  {
    id: "node-root-1",
    type: "promptNode",
    position: { x: 250, y: 50 },
    data: {
      label: "Initial Prompt",
      prompt: "What is GraphMind and how does graph-native AI work?",
      createdAt: new Date().toISOString(),
    },
  },
  {
    id: "node-response-1",
    type: "responseNode",
    position: { x: 250, y: 220 },
    data: {
      label: "AI Response",
      title: "Graph-Native Knowledge Representation",
      content:
        "GraphMind is an open-source, AI-native knowledge workspace where conversations branch into interactive knowledge maps rather than remaining linear streams.\n\nKey Concepts:\n• Knowledge is the primary product; chat is just the interface.\n• Every response becomes an interactive node.\n• Highlight text to branch off into focused sub-explorations.",
      model: "gemini-2.5-flash",
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
];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  selectedNodeId: null,
  isStreaming: false,

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

  sendPrompt: async (promptText: string, provider = "gemini", model = "gemini-2.5-flash") => {
    const timestamp = Date.now();
    const promptNodeId = `prompt-${timestamp}`;
    const responseNodeId = `response-${timestamp}`;
    const edgeId = `edge-${promptNodeId}-${responseNodeId}`;

    const existingCount = get().nodes.length;
    const yOffset = 400 + Math.floor(existingCount / 2) * 220;
    const xOffset = existingCount % 2 === 0 ? 250 : 550;

    const newPromptNode: Node = {
      id: promptNodeId,
      type: "promptNode",
      position: { x: xOffset, y: yOffset },
      data: {
        label: "User Query",
        prompt: promptText,
        createdAt: new Date().toISOString(),
      },
    };

    const newResponseNode: Node = {
      id: responseNodeId,
      type: "responseNode",
      position: { x: xOffset, y: yOffset + 180 },
      data: {
        label: "AI Stream",
        title: "AI Response",
        content: "Thinking...",
        model: model,
        createdAt: new Date().toISOString(),
      },
    };

    const newEdge: Edge = {
      id: edgeId,
      source: promptNodeId,
      target: responseNodeId,
      type: "smoothstep",
      animated: true,
      style: { stroke: "#10b981", strokeWidth: 2 },
    };

    set((state) => ({
      nodes: [...state.nodes, newPromptNode, newResponseNode],
      edges: [...state.edges, newEdge],
      isStreaming: true,
      selectedNodeId: responseNodeId,
    }));

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText,
          provider: provider,
          model: model,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamedContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        const lines = chunkText.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const rawData = line.slice(6).trim();
            if (rawData === "[DONE]") break;

            try {
              const parsed = JSON.parse(rawData);
              if (parsed.content) {
                streamedContent += parsed.content;
                set((state) => ({
                  nodes: state.nodes.map((node) =>
                    node.id === responseNodeId
                      ? {
                          ...node,
                          data: {
                            ...node.data,
                            content: streamedContent,
                          },
                        }
                      : node
                  ),
                }));
              }
            } catch (e) {
              // Ignore non-JSON line chunks
            }
          }
        }
      }
    } catch (err: any) {
      console.error("Streaming error:", err);
      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === responseNodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  content: `⚠️ Error streaming response: ${err.message || "Failed to connect to backend API."}\n\nMake sure the FastAPI backend is running at ${API_BASE_URL}.`,
                },
              }
            : node
        ),
      }));
    } finally {
      set({ isStreaming: false });
    }
  },

  resetLayout: () => {
    set({
      nodes: initialNodes,
      edges: initialEdges,
      selectedNodeId: null,
      isStreaming: false,
    });
  },
}));
