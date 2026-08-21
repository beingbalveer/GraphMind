"use client";

import React, { useMemo, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  BackgroundVariant,
  Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ConversationTree } from "@graphmind/shared";
import { treeToGraph, CustomNodeData } from "@/lib/treeToGraph";
import { CustomMessageNode } from "./CustomMessageNode";

interface GraphCanvasProps {
  tree: ConversationTree | null;
  onSelectNode: (nodeId: string) => void;
}

const nodeTypes = {
  customMessageNode: CustomMessageNode,
};

function FlowCanvas({ tree, onSelectNode }: GraphCanvasProps) {
  const { fitView } = useReactFlow();

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    return treeToGraph(tree, tree?.activeNodeId);
  }, [tree]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<CustomNodeData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Synchronize graph nodes and edges whenever the tree state updates
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = treeToGraph(
      tree,
      tree?.activeNodeId
    );
    setNodes(newNodes);
    setEdges(newEdges);
  }, [tree, setNodes, setEdges]);

  // Fit view on initial load
  useEffect(() => {
    if (nodes.length > 0) {
      const timer = setTimeout(() => {
        fitView({ padding: 0.25, duration: 400 });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [nodes.length, fitView]);

  const handleNodeClick = (_: React.MouseEvent, node: Node) => {
    onSelectNode(node.id);
  };

  return (
    <div className="w-full h-full bg-[#fafafa] relative animate-in fade-in duration-200">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        minZoom={0.2}
        maxZoom={1.8}
        defaultViewport={{ x: 0, y: 0, zoom: 0.85 }}
        className="touch-none"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.2}
          color="#d4d4d8"
        />
        <Controls
          showInteractive={false}
          className="bg-white border border-zinc-200 shadow-md rounded-xl overflow-hidden p-0.5 text-zinc-700"
        />
        <MiniMap
          nodeStrokeWidth={3}
          nodeColor={(node) => {
            const data = node.data as CustomNodeData;
            return data?.isActive ? "#18181b" : "#e4e4e7";
          }}
          className="bg-white/90 border border-zinc-200/90 shadow-md rounded-xl overflow-hidden hidden sm:block"
        />
      </ReactFlow>
    </div>
  );
}

export function GraphCanvas(props: GraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvas {...props} />
    </ReactFlowProvider>
  );
}
