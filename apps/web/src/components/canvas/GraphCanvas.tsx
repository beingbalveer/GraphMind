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
  useViewport,
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
import { treeToGraph } from "@/lib/treeToGraph";
import { getLayoutedElements, LayoutDirection } from "@/lib/layoutEngine";
import { MindMapNode, MindMapNodeData, ZoomMode } from "./MindMapNode";
import { MindMapEdge } from "./MindMapEdge";
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
  onAutoLayoutRef?: React.MutableRefObject<(() => void) | null>;
}

const nodeTypes = {
  mindMapNode: MindMapNode,
};

const edgeTypes = {
  mindMapEdge: MindMapEdge,
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
  onAutoLayoutRef,
}: GraphCanvasProps) {
  const { fitView, setCenter, zoomTo } = useReactFlow();
  const { zoom } = useViewport();
  const [showMinimap, setShowMinimap] = useState(true);
  const [direction, setDirection] = useState<LayoutDirection>("LR");
  const isFirstRender = useRef(true);

  // Compute adaptive LOD Zoom Mode
  const zoomMode: ZoomMode = useMemo(() => {
    if (zoom < 0.6) return "orb";
    if (zoom >= 1.25) return "detailed";
    return "capsule";
  }, [zoom]);

  // Compute raw nodes & edges then layout with Dagre
  const { initialNodes, initialEdges } = useMemo(() => {
    const raw = treeToGraph(tree, {
      activeNodeId: tree?.activeNodeId,
      isStreaming,
      zoomMode,
      onExploreBranch,
      onSwitchToChat,
      onRetry,
    });
    const layouted = getLayoutedElements(raw.nodes, raw.edges, direction);
    return { initialNodes: layouted.nodes, initialEdges: layouted.edges };
  }, [tree, isStreaming, zoomMode, onExploreBranch, onSwitchToChat, onRetry, direction]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<MindMapNodeData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Synchronize graph nodes and edges whenever the tree state, zoomMode, or layout direction updates
  useEffect(() => {
    const raw = treeToGraph(tree, {
      activeNodeId: tree?.activeNodeId,
      isStreaming,
      zoomMode,
      onExploreBranch,
      onSwitchToChat,
      onRetry,
    });
    const layouted = getLayoutedElements(raw.nodes, raw.edges, direction);
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
  }, [tree, isStreaming, zoomMode, onExploreBranch, onSwitchToChat, onRetry, direction, setNodes, setEdges]);

  // Center camera smoothly on a specific node card
  const centerOnNode = useCallback(
    (nodeId?: string) => {
      const targetId = nodeId || tree?.activeNodeId;
      if (!targetId) return;

      const targetNode = nodes.find((n) => n.id === targetId);
      if (targetNode) {
        const centerX = targetNode.position.x + 110;
        const centerY = targetNode.position.y + 22;
        setCenter(centerX, centerY, { zoom: 1.0, duration: 400 });
      }
    },
    [nodes, tree?.activeNodeId, setCenter]
  );

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.25, maxZoom: 1.1, duration: 400 });
  }, [fitView]);

  const handleResetZoom = useCallback(() => {
    zoomTo(1.0, { duration: 300 });
  }, [zoomTo]);

  const handleAutoLayout = useCallback(() => {
    const raw = treeToGraph(tree, {
      activeNodeId: tree?.activeNodeId,
      isStreaming,
      zoomMode,
      onExploreBranch,
      onSwitchToChat,
      onRetry,
    });
    const layouted = getLayoutedElements(raw.nodes, raw.edges, direction);
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
    handleFitView();
  }, [tree, isStreaming, zoomMode, onExploreBranch, onSwitchToChat, onRetry, direction, handleFitView, setNodes, setEdges]);

  const handleToggleDirection = useCallback(() => {
    const newDir = direction === "LR" ? "TB" : "LR";
    setDirection(newDir);
    setTimeout(() => {
      handleFitView();
    }, 50);
  }, [direction, handleFitView]);

  // Expose callbacks to parent for keyboard shortcuts
  useEffect(() => {
    if (onFitViewRef) onFitViewRef.current = handleFitView;
    if (onCenterActiveRef) onCenterActiveRef.current = () => centerOnNode();
    if (onAutoLayoutRef) onAutoLayoutRef.current = handleAutoLayout;
  }, [onFitViewRef, onCenterActiveRef, onAutoLayoutRef, handleFitView, centerOnNode, handleAutoLayout]);

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
        defaultViewport={{ x: 0, y: 0, zoom: 0.9 }}
        className="touch-none"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={18}
          size={1.2}
          color="#d4d4d8"
        />
        <Controls
          showInteractive={false}
          className="bg-white border border-zinc-200 shadow-md rounded-xl overflow-hidden p-0.5 text-zinc-700"
        />
        {showMinimap && (
          <MiniMap
            nodeStrokeWidth={2}
            nodeColor={(node) => {
              const data = node.data as MindMapNodeData;
              return data?.isActive ? "#18181b" : "#e4e4e7";
            }}
            className="bg-white/95 border border-zinc-200/90 shadow-md rounded-xl overflow-hidden hidden sm:block"
          />
        )}
      </ReactFlow>

      {/* Floating Canvas Camera & Layout Toolbar */}
      <div className="absolute top-4 right-4 z-20 flex items-center space-x-1.5 p-1 bg-white/90 backdrop-blur-md border border-zinc-200/90 rounded-xl shadow-md select-none">
        {/* LOD Mode Indicator Badge */}
        <div className="px-2 py-0.5 rounded-lg bg-zinc-100 border border-zinc-200 text-[10px] font-semibold text-zinc-700 capitalize">
          {zoomMode === "orb" ? "🌌 Galaxy View" : zoomMode === "detailed" ? "🔍 Focus View" : "🌿 Mind Map"}
        </div>
        <div className="w-px h-4 bg-zinc-200 mx-0.5" />

        <Button
          variant="ghost"
          size="iconSm"
          onClick={handleToggleDirection}
          className="h-7 w-7 text-zinc-600 hover:text-zinc-950 cursor-pointer"
          title={`Switch Layout: ${direction === "LR" ? "Horizontal (Left-to-Right)" : "Vertical (Top-to-Bottom)"}`}
        >
          {direction === "LR" ? (
            <Rows3 className="w-3.5 h-3.5" />
          ) : (
            <Columns3 className="w-3.5 h-3.5" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="iconSm"
          onClick={handleAutoLayout}
          className="h-7 w-7 text-zinc-600 hover:text-zinc-950 cursor-pointer"
          title="Recompute Clean Auto-Layout (⌘L)"
        >
          <Sparkles className="w-3.5 h-3.5" />
        </Button>
        <div className="w-px h-4 bg-zinc-200 mx-0.5" />
        <Button
          variant="ghost"
          size="iconSm"
          onClick={() => centerOnNode()}
          className="h-7 w-7 text-zinc-600 hover:text-zinc-950 cursor-pointer"
          title="Center on Active Node (⌘.)"
        >
          <Crosshair className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="iconSm"
          onClick={handleFitView}
          className="h-7 w-7 text-zinc-600 hover:text-zinc-950 cursor-pointer"
          title="Fit All Nodes in View (⌘0)"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="iconSm"
          onClick={handleResetZoom}
          className="h-7 w-7 text-zinc-600 hover:text-zinc-950 cursor-pointer"
          title="Reset Zoom to 100%"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </Button>
        <div className="w-px h-4 bg-zinc-200 mx-0.5" />
        <Button
          variant="ghost"
          size="iconSm"
          onClick={() => setShowMinimap((prev) => !prev)}
          className={`h-7 w-7 text-zinc-600 hover:text-zinc-950 cursor-pointer ${
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
