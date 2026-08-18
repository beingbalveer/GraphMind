"use client";

import React, { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useGraphStore } from "@/store/useGraphStore";
import { PromptNode } from "./nodes/PromptNode";
import { ResponseNode } from "./nodes/ResponseNode";

export function GraphCanvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, setSelectedNodeId } =
    useGraphStore();

  const nodeTypes: NodeTypes = useMemo(
    () => ({
      promptNode: PromptNode,
      responseNode: ResponseNode,
    }),
    []
  );

  return (
    <div className="w-full h-full relative bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        onPaneClick={() => setSelectedNodeId(null)}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: "smoothstep",
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#cbd5e1" />
        <Controls
          className="!bg-white !border-slate-200 !shadow-md !rounded-lg overflow-hidden"
          showInteractive={false}
        />
        <MiniMap
          nodeColor={(node) => (node.type === "promptNode" ? "#0284c7" : "#10b981")}
          className="!bg-white !border-slate-200 !shadow-md !rounded-lg"
          zoomable
          pannable
        />
      </ReactFlow>
    </div>
  );
}
