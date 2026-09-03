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
import { ThreadGraphNode, ThreadNodeData, ZoomMode } from "./ThreadGraphNode";
import { MindMapEdge } from "./MindMapEdge";
import { Button } from "@/components/ui/button";

interface GraphCanvasProps {
  tree: ConversationTree | null;
  isStreaming?: boolean;
  onSelectNode: (nodeId: string) => void;
  onExploreBranch?: (nodeId: string, contextText?: string) => void;
  onSwitchToChat?: (nodeId: string) => void;
  onDeleteBranch?: (nodeId: string) => void;
  onRetry?: () => void;
  onFitViewRef?: React.MutableRefObject<(() => void) | null>;
  onCenterActiveRef?: React.MutableRefObject<(() => void) | null>;
  onAutoLayoutRef?: React.MutableRefObject<(() => void) | null>;
  onPaneClick?: () => void;
  isSidePeekOpen?: boolean;
}

const nodeTypes = {
  threadGraphNode: ThreadGraphNode,
};

const edgeTypes = {
  mindMapEdge: MindMapEdge,
};

function FlowCanvas({
  tree,
  isStreaming = false,
  onSelectNode,
  onDeleteBranch,
  onFitViewRef,
  onCenterActiveRef,
  onAutoLayoutRef,
  onPaneClick,
  isSidePeekOpen = false,
}: GraphCanvasProps) {
  const [zoomMode, setZoomMode] = useState<ZoomMode>("capsule");
  const [direction, setDirection] = useState<LayoutDirection>("LR");
  const { fitView, setCenter, getNodes, getZoom, zoomTo } = useReactFlow();
  const { zoom } = useViewport();
  const [showMinimap, setShowMinimap] = useState(true);
  const isFirstRender = useRef(true);

  // Update zoomMode based on zoom
  useEffect(() => {
    if (zoom < 0.6) setZoomMode("orb");
    else if (zoom >= 1.25) setZoomMode("detailed");
    else setZoomMode("capsule");
  }, [zoom]);

  // Compute Thread Nodes & Branch Edges
  const { initialNodes, initialEdges } = useMemo(() => {
    const raw = treeToGraph(tree, {
      activeNodeId: tree?.activeNodeId,
      isStreaming,
      zoomMode,
      onDeleteThread: onDeleteBranch,
    });
    const layouted = getLayoutedElements(raw.nodes, raw.edges, direction);
    return { initialNodes: layouted.nodes, initialEdges: layouted.edges };
  }, [tree, isStreaming, zoomMode, direction, onDeleteBranch]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ThreadNodeData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Synchronize graph nodes and edges whenever tree, zoomMode, or direction updates
  useEffect(() => {
    const raw = treeToGraph(tree, {
      activeNodeId: tree?.activeNodeId,
      isStreaming,
      zoomMode,
      onDeleteThread: onDeleteBranch,
    });
    const layouted = getLayoutedElements(raw.nodes, raw.edges, direction);
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
  }, [tree, isStreaming, zoomMode, direction, onDeleteBranch, setNodes, setEdges]);

  // Center camera on a specific thread node
  const centerOnNode = useCallback(
    (threadId?: string) => {
      const targetId = threadId || tree?.activeNodeId;
      if (!targetId) return;

      const targetNode = getNodes().find((n) => n.id === targetId);
      if (targetNode) {
        const x = targetNode.position.x + (targetNode.measured?.width || 200) / 2;
        const y = targetNode.position.y + (targetNode.measured?.height || 80) / 2;
        setCenter(x, y, { duration: 800, zoom: Math.max(getZoom(), 0.8) });
      }
    },
    [tree?.activeNodeId, getNodes, setCenter, getZoom]
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
      onDeleteThread: onDeleteBranch,
    });
    const layouted = getLayoutedElements(raw.nodes, raw.edges, direction);
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
    handleFitView();
  }, [tree, isStreaming, zoomMode, direction, onDeleteBranch, handleFitView, setNodes, setEdges]);

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

  // Fit view on initial load or smooth pan
  useEffect(() => {
    if (nodes.length === 0) return;

    if (isFirstRender.current) {
      isFirstRender.current = false;
      const timer = setTimeout(() => {
        handleFitView();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [nodes.length, handleFitView]);

  const handleNodeClick = (_: React.MouseEvent, node: Node) => {
    const nodeData = node.data as ThreadNodeData;
    if (nodeData?.thread) {
      // Select the deepest leaf node of this thread to open full thread in Focus Drawer
      onSelectNode(nodeData.thread.leafNodeId);
    }
  };

  return (
    <div className="w-full h-full bg-white relative animate-in fade-in duration-200">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={onPaneClick}
        onEdgeClick={onPaneClick}
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
              const data = node.data as ThreadNodeData;
              return data?.thread?.isActive ? "#18181b" : "#e4e4e7";
            }}
            className="bg-white/95 border border-zinc-200/90 shadow-md rounded-xl overflow-hidden hidden sm:block"
          />
        )}
      </ReactFlow>

      {/* Floating Canvas Camera & Layout Toolbar */}
      <div
        className={`absolute top-4 z-20 flex items-center space-x-1.5 p-1 bg-white/90 backdrop-blur-md border border-zinc-200/90 rounded-xl shadow-md select-none transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isSidePeekOpen
            ? "right-4 sm:right-[496px] md:right-[556px] lg:right-[596px]"
            : "right-4"
        }`}
      >
        {/* LOD Mode Indicator Badge */}
        <div className="px-2 py-0.5 rounded-lg bg-zinc-100 border border-zinc-200 text-[10px] font-semibold text-zinc-700 capitalize">
          {zoomMode === "orb" ? "🌌 Galaxy View" : zoomMode === "detailed" ? "🔍 Focus View" : "📄 Thread Tree"}
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
