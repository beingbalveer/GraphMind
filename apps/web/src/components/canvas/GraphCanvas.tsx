"use client";

import React, { useMemo, useEffect, useState, useCallback, useRef } from "react";
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
import {
  Maximize2,
  Crosshair,
  Map,
  RotateCcw,
  Rows3,
  Columns3,
  Sparkles,
} from "lucide-react";
import { ConversationTree } from "@graphmind/shared";
import { treeToGraph, CustomNodeData } from "@/lib/treeToGraph";
import { getLayoutedElements, LayoutDirection } from "@/lib/layoutEngine";
import { CustomMessageNode } from "./CustomMessageNode";
import { CustomBranchEdge } from "./CustomBranchEdge";
import { Button } from "@/components/ui/button";

interface GraphCanvasProps {
  tree: ConversationTree | null;
  isStreaming?: boolean;
  onSelectNode: (nodeId: string) => void;
  onExploreBranch?: (nodeId: string, contextText?: string) => void;
  onSwitchToChat?: (nodeId: string) => void;
  onRetry?: () => void;
  onFitViewRef?: React.MutableRefObject<(() => void) | null>;
  onCenterActiveRef?: React.MutableRefObject<(() => void) | null>;
}

const nodeTypes = {
  customMessageNode: CustomMessageNode,
};

const edgeTypes = {
  customBranchEdge: CustomBranchEdge,
};

function FlowCanvas({
  tree,
  isStreaming = false,
  onSelectNode,
  onExploreBranch,
  onSwitchToChat,
  onRetry,
  onFitViewRef,
  onCenterActiveRef,
}: GraphCanvasProps) {
  const { fitView, setCenter, zoomTo } = useReactFlow();
  const [showMinimap, setShowMinimap] = useState(true);
  const [direction, setDirection] = useState<LayoutDirection>("TB");
  const isFirstRender = useRef(true);

  // Compute raw nodes & edges then layout with Dagre
  const { initialNodes, initialEdges } = useMemo(() => {
    const raw = treeToGraph(tree, {
      activeNodeId: tree?.activeNodeId,
      isStreaming,
      onExploreBranch,
      onSwitchToChat,
      onRetry,
    });
    const layouted = getLayoutedElements(raw.nodes, raw.edges, direction);
    return { initialNodes: layouted.nodes, initialEdges: layouted.edges };
  }, [tree, isStreaming, onExploreBranch, onSwitchToChat, onRetry, direction]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<CustomNodeData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Synchronize graph nodes and edges whenever the tree state or layout direction updates
  useEffect(() => {
    const raw = treeToGraph(tree, {
      activeNodeId: tree?.activeNodeId,
      isStreaming,
      onExploreBranch,
      onSwitchToChat,
      onRetry,
    });
    const layouted = getLayoutedElements(raw.nodes, raw.edges, direction);
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
  }, [tree, isStreaming, onExploreBranch, onSwitchToChat, onRetry, direction, setNodes, setEdges]);

  // Center camera smoothly on a specific node card
  const centerOnNode = useCallback(
    (nodeId?: string) => {
      const targetId = nodeId || tree?.activeNodeId;
      if (!targetId) return;

      const targetNode = nodes.find((n) => n.id === targetId);
      if (targetNode) {
        const centerX = targetNode.position.x + 160;
        const centerY = targetNode.position.y + 80;
        setCenter(centerX, centerY, { zoom: 0.95, duration: 450 });
      }
    },
    [nodes, tree?.activeNodeId, setCenter]
  );

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, maxZoom: 1.0, duration: 450 });
  }, [fitView]);

  const handleResetZoom = useCallback(() => {
    zoomTo(1.0, { duration: 350 });
  }, [zoomTo]);

  const handleToggleDirection = useCallback(() => {
    const newDir = direction === "TB" ? "LR" : "TB";
    setDirection(newDir);
    setTimeout(() => {
      handleFitView();
    }, 50);
  }, [direction, handleFitView]);

  // Expose callbacks to parent for keyboard shortcuts
  useEffect(() => {
    if (onFitViewRef) onFitViewRef.current = handleFitView;
    if (onCenterActiveRef) onCenterActiveRef.current = () => centerOnNode();
  }, [onFitViewRef, onCenterActiveRef, handleFitView, centerOnNode]);

  // Fit view on initial load or smooth pan on branch switch
  useEffect(() => {
    if (nodes.length === 0) return;

    if (isFirstRender.current) {
      isFirstRender.current = false;
      const timer = setTimeout(() => {
        handleFitView();
      }, 60);
      return () => clearTimeout(timer);
    } else if (tree?.activeNodeId) {
      centerOnNode(tree.activeNodeId);
    }
  }, [tree?.activeNodeId, nodes.length, handleFitView, centerOnNode]);

  const handleNodeClick = (_: React.MouseEvent, node: Node) => {
    onSelectNode(node.id);
  };

  return (
    <div className="w-full h-full bg-[#fafafa] relative animate-in fade-in duration-200">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onlyRenderVisibleElements={true}
        elevateNodesOnSelect={true}
        selectNodesOnDrag={false}
        minZoom={0.15}
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
        {showMinimap && (
          <MiniMap
            nodeStrokeWidth={3}
            nodeColor={(node) => {
              const data = node.data as CustomNodeData;
              return data?.isActive ? "#18181b" : "#e4e4e7";
            }}
            className="bg-white/95 border border-zinc-200/90 shadow-md rounded-xl overflow-hidden hidden sm:block"
          />
        )}
      </ReactFlow>

      {/* Floating Canvas Camera & Layout Toolbar */}
      <div className="absolute top-4 right-4 z-20 flex items-center space-x-1.5 p-1 bg-white/90 backdrop-blur-md border border-zinc-200/90 rounded-xl shadow-md select-none">
        <Button
          variant="ghost"
          size="iconSm"
          onClick={handleToggleDirection}
          className="h-7 w-7 text-zinc-600 hover:text-zinc-950"
          title={`Switch Layout: ${direction === "TB" ? "Vertical (Top-to-Bottom)" : "Horizontal (Left-to-Right)"}`}
        >
          {direction === "TB" ? (
            <Columns3 className="w-3.5 h-3.5" />
          ) : (
            <Rows3 className="w-3.5 h-3.5" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="iconSm"
          onClick={() => {
            const raw = treeToGraph(tree, {
              activeNodeId: tree?.activeNodeId,
              isStreaming,
              onExploreBranch,
              onSwitchToChat,
              onRetry,
            });
            const layouted = getLayoutedElements(raw.nodes, raw.edges, direction);
            setNodes(layouted.nodes);
            setEdges(layouted.edges);
            handleFitView();
          }}
          className="h-7 w-7 text-zinc-600 hover:text-zinc-950"
          title="Recompute Clean Auto-Layout (⌘L)"
        >
          <Sparkles className="w-3.5 h-3.5" />
        </Button>
        <div className="w-px h-4 bg-zinc-200 mx-0.5" />
        <Button
          variant="ghost"
          size="iconSm"
          onClick={() => centerOnNode()}
          className="h-7 w-7 text-zinc-600 hover:text-zinc-950"
          title="Center on Active Node (⌘.)"
        >
          <Crosshair className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="iconSm"
          onClick={handleFitView}
          className="h-7 w-7 text-zinc-600 hover:text-zinc-950"
          title="Fit All Nodes in View (⌘0)"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="iconSm"
          onClick={handleResetZoom}
          className="h-7 w-7 text-zinc-600 hover:text-zinc-950"
          title="Reset Zoom to 100%"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </Button>
        <div className="w-px h-4 bg-zinc-200 mx-0.5" />
        <Button
          variant="ghost"
          size="iconSm"
          onClick={() => setShowMinimap((prev) => !prev)}
          className={`h-7 w-7 text-zinc-600 hover:text-zinc-950 ${
            showMinimap ? "bg-zinc-100 text-zinc-900" : ""
          }`}
          title="Toggle Radar Minimap"
        >
          <Map className="w-3.5 h-3.5" />
        </Button>
      </div>
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
