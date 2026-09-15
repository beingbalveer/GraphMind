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
  Map as MapIcon,
  RotateCcw,
  Rows3,
  Columns3,
  Sparkles,
  Flame,
  History,
} from "lucide-react";
import {
  ConceptMasteryLevel,
  ConversationTree,
  WorkspaceMasterySummary,
  WorkspaceTimelineResponse,
} from "@graphmind/shared";
import { treeToGraph } from "@/lib/treeToGraph";
import { getLayoutedElements, LayoutDirection } from "@/lib/layoutEngine";
import { extractConversationThreads } from "@/lib/threadUtils";
import { getWorkspaceMastery, getWorkspaceTimeline } from "@/lib/workspaceApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThreadGraphNode, ThreadNodeData, ThreadMasteryInfo, ZoomMode } from "./ThreadGraphNode";
import { MindMapEdge } from "./MindMapEdge";
import { TimelineReplayBar } from "./TimelineReplayBar";

interface GraphCanvasProps {
  tree: ConversationTree | null;
  workspaceId?: string;
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
  workspaceId,
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
  const [isHeatmapMode, setIsHeatmapMode] = useState(false);
  const [masterySummary, setMasterySummary] = useState<WorkspaceMasterySummary | null>(null);
  const { fitView, setCenter, getNodes, getZoom, zoomTo } = useReactFlow();
  const { zoom } = useViewport();
  const [showMinimap, setShowMinimap] = useState(true);
  const isFirstRender = useRef(true);

  // Load workspace mastery for the visual heatmap overlay
  const fetchMastery = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const data = await getWorkspaceMastery(workspaceId);
      setMasterySummary(data);
    } catch (err) {
      console.warn("Error fetching mastery for canvas heatmap:", err);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchMastery();

    const handleUpdate = () => {
      fetchMastery();
    };

    window.addEventListener("concept-mastery-updated", handleUpdate);
    return () => {
      window.removeEventListener("concept-mastery-updated", handleUpdate);
    };
  }, [fetchMastery]);

  // Timeline Replay State
  const [isReplayMode, setIsReplayMode] = useState(false);
  const [timeline, setTimeline] = useState<WorkspaceTimelineResponse | null>(null);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const fetchTimeline = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const tl = await getWorkspaceTimeline(workspaceId);
      setTimeline(tl);
      if (tl && tl.events.length > 0) {
        setCurrentEventIndex(tl.events.length - 1);
      }
    } catch (err) {
      console.warn("Error fetching workspace timeline:", err);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (isReplayMode) {
      fetchTimeline();
    } else {
      setIsPlaying(false);
    }
  }, [isReplayMode, fetchTimeline]);

  // Automated playback ticker
  useEffect(() => {
    if (!isPlaying || !timeline || timeline.events.length === 0) return;
    const intervalMs = Math.max(250, Math.floor(1200 / playbackSpeed));
    const timer = setInterval(() => {
      setCurrentEventIndex((prev) => {
        if (prev >= timeline.events.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [isPlaying, timeline, playbackSpeed]);

  const cutoffTimestamp = useMemo(() => {
    if (!isReplayMode || !timeline || !timeline.events[currentEventIndex]) return null;
    return timeline.events[currentEventIndex].timestamp;
  }, [isReplayMode, timeline, currentEventIndex]);

  // Compute Thread to Concept Mastery map
  const masteryMap = useMemo(() => {
    if (!masterySummary || !tree) return {};

    const nodeToConcepts = new Map<string, typeof masterySummary.concepts>();
    for (const c of masterySummary.concepts) {
      if (c.nodeIds) {
        for (const nid of c.nodeIds) {
          const list = nodeToConcepts.get(nid) || [];
          list.push(c);
          nodeToConcepts.set(nid, list);
        }
      }
    }

    const { threads } = extractConversationThreads(tree, tree.activeNodeId, isStreaming);
    const map: Record<string, ThreadMasteryInfo> = {};

    for (const thread of threads) {
      const matchedConcepts: typeof masterySummary.concepts = [];
      const seenConceptIds = new Set<string>();

      for (const msg of thread.messages) {
        const concepts = nodeToConcepts.get(msg.id);
        if (concepts) {
          for (const c of concepts) {
            if (!seenConceptIds.has(c.id)) {
              seenConceptIds.add(c.id);
              matchedConcepts.push(c);
            }
          }
        }
      }

      if (matchedConcepts.length === 0) {
        for (const c of masterySummary.concepts) {
          const cName = c.name.toLowerCase();
          if (
            (thread.highlightedContext && thread.highlightedContext.toLowerCase().includes(cName)) ||
            thread.title.toLowerCase().includes(cName)
          ) {
            if (!seenConceptIds.has(c.id)) {
              seenConceptIds.add(c.id);
              matchedConcepts.push(c);
            }
          }
        }
      }

      if (matchedConcepts.length > 0) {
        const avgScore =
          matchedConcepts.reduce((acc, c) => acc + c.confidenceScore, 0) /
          matchedConcepts.length;

        let level: ConceptMasteryLevel = "unexplored";
        if (matchedConcepts.some((c) => c.masteryLevel === "mastered" || c.confidenceScore >= 0.8)) {
          level = "mastered";
        } else if (matchedConcepts.some((c) => c.masteryLevel === "quizzed" || c.confidenceScore >= 0.5)) {
          level = "quizzed";
        } else if (matchedConcepts.some((c) => c.masteryLevel === "stale")) {
          level = "stale";
        } else if (matchedConcepts.some((c) => c.masteryLevel === "explored" || c.confidenceScore > 0.0)) {
          level = "explored";
        }

        map[thread.id] = {
          level,
          score: avgScore,
          primaryConcept: matchedConcepts[0].name,
          totalConcepts: matchedConcepts.length,
        };
      }
    }

    return map;
  }, [masterySummary, tree, isStreaming]);

  // Update zoomMode based on zoom
  useEffect(() => {
    if (zoom < 0.6) setZoomMode("orb");
    else if (zoom >= 1.25) setZoomMode("detailed");
    else setZoomMode("capsule");
  }, [zoom]);

  // Compute Thread Nodes & Branch Edges (Optimized single-pass memoization)
  const { currentNodes, currentEdges } = useMemo(() => {
    const raw = treeToGraph(tree, {
      activeNodeId: tree?.activeNodeId,
      isStreaming,
      zoomMode,
      onDeleteThread: onDeleteBranch,
      masteryMap,
      isHeatmapMode,
      cutoffTimestamp,
    });
    const layouted = getLayoutedElements(raw.nodes, raw.edges, direction);
    return { currentNodes: layouted.nodes, currentEdges: layouted.edges };
  }, [tree, isStreaming, zoomMode, direction, onDeleteBranch, masteryMap, isHeatmapMode, cutoffTimestamp]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ThreadNodeData>>(currentNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(currentEdges);

  // Synchronize graph nodes and edges whenever memoized elements change
  useEffect(() => {
    setNodes(currentNodes);
    setEdges(currentEdges);
  }, [currentNodes, currentEdges, setNodes, setEdges]);

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
      masteryMap,
      isHeatmapMode,
    });
    const layouted = getLayoutedElements(raw.nodes, raw.edges, direction);
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
    handleFitView();
  }, [tree, isStreaming, zoomMode, direction, onDeleteBranch, masteryMap, isHeatmapMode, handleFitView, setNodes, setEdges]);

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
          color="var(--canvas-edge, #d4d4d8)"
        />
        <Controls
          showInteractive={false}
          className="bg-surface border border-border shadow-xs rounded-xl overflow-hidden p-0.5 text-foreground-muted"
        />
        {showMinimap && (
          <MiniMap
            nodeStrokeWidth={2}
            nodeColor={(node) => {
              const data = node.data as ThreadNodeData;
              return data?.thread?.isActive
                ? "var(--canvas-edge-active, #18181b)"
                : "var(--border, #e4e4e7)";
            }}
            className="bg-surface/95 border border-border shadow-xs rounded-xl overflow-hidden hidden sm:block"
          />
        )}
      </ReactFlow>

      {/* Floating Canvas Camera & Layout Toolbar */}
      <div
        className={`absolute top-4 z-20 flex items-center gap-1 p-1 bg-surface border border-border rounded-2xl select-none shadow-xs transition-all duration-200 ${
          isSidePeekOpen
            ? "right-4 sm:right-[496px] md:right-[556px] lg:right-[596px]"
            : "right-4"
        }`}
      >
        {/* LOD Mode Indicator Badge */}
        <Badge variant="secondary" className="text-xs font-medium capitalize">
          {zoomMode === "orb" ? "🌌 Galaxy View" : zoomMode === "detailed" ? "🔍 Focus View" : "📄 Thread Tree"}
        </Badge>
        <div className="w-px h-4 bg-border-subtle mx-0.5" />

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleToggleDirection}
          className="text-foreground-muted hover:text-foreground hover:bg-surface-hover"
          title={`Switch Layout: ${direction === "LR" ? "Horizontal (Left-to-Right)" : "Vertical (Top-to-Bottom)"}`}
          aria-label="Switch Layout Direction"
        >
          {direction === "LR" ? (
            <Rows3 className="w-3.5 h-3.5 stroke-[1.75]" />
          ) : (
            <Columns3 className="w-3.5 h-3.5 stroke-[1.75]" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleAutoLayout}
          className="text-foreground-muted hover:text-foreground hover:bg-surface-hover"
          title="Recompute Clean Auto-Layout (⌘L)"
          aria-label="Recompute Auto Layout"
        >
          <Sparkles className="w-3.5 h-3.5 stroke-[1.75]" />
        </Button>
        <div className="w-px h-4 bg-border-subtle mx-0.5" />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => centerOnNode()}
          className="text-foreground-muted hover:text-foreground hover:bg-surface-hover"
          title="Center on Active Node (⌘.)"
          aria-label="Center on Active Node"
        >
          <Crosshair className="w-3.5 h-3.5 stroke-[1.75]" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleFitView}
          className="text-foreground-muted hover:text-foreground hover:bg-surface-hover"
          title="Fit All Nodes in View (⌘0)"
          aria-label="Fit All Nodes in View"
        >
          <Maximize2 className="w-3.5 h-3.5 stroke-[1.75]" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleResetZoom}
          className="text-foreground-muted hover:text-foreground hover:bg-surface-hover"
          title="Reset Zoom to 100%"
          aria-label="Reset Zoom"
        >
          <RotateCcw className="w-3.5 h-3.5 stroke-[1.75]" />
        </Button>
        <div className="w-px h-4 bg-border-subtle mx-0.5" />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setShowMinimap((prev) => !prev)}
          className={`text-foreground-muted hover:text-foreground hover:bg-surface-hover ${
            showMinimap ? "bg-surface-hover text-foreground font-medium" : ""
          }`}
          title="Toggle Radar Minimap"
          aria-label="Toggle Radar Minimap"
        >
          <MapIcon className="w-3.5 h-3.5 stroke-[1.75]" />
        </Button>
        <div className="w-px h-4 bg-border-subtle mx-0.5" />
        <Button
          variant={isHeatmapMode ? "default" : "ghost"}
          size="sm"
          onClick={() => setIsHeatmapMode((prev) => !prev)}
          className="h-7 px-2.5 text-xs font-medium gap-1.5"
          title="Toggle Concept Mastery Heatmap"
          aria-label="Toggle Concept Mastery Heatmap"
        >
          <Flame className="w-3.5 h-3.5 stroke-[2]" />
          <span>Heatmap</span>
        </Button>
        <div className="w-px h-4 bg-border-subtle mx-0.5" />
        <Button
          variant={isReplayMode ? "default" : "ghost"}
          size="sm"
          onClick={() => setIsReplayMode((prev) => !prev)}
          className="h-7 px-2.5 text-xs font-medium gap-1.5"
          title="Replay Knowledge Graph Evolution"
          aria-label="Replay Knowledge Graph Evolution"
        >
          <History className="w-3.5 h-3.5 stroke-[2]" />
          <span>Replay</span>
        </Button>
      </div>

      {/* Floating Heatmap Legend */}
      {isHeatmapMode && (
        <div className="absolute bottom-4 left-4 z-20 bg-surface/95 backdrop-blur-xs border border-border rounded-2xl p-3 shadow-md select-none text-xs animate-in fade-in slide-in-from-bottom-2 duration-150 space-y-2 max-w-[220px]">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground pb-1 border-b border-border-subtle">
            <span className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-foreground" />
              <span>Mastery Heatmap</span>
            </span>
          </div>
          <div className="space-y-1.5 text-foreground-muted">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-success shrink-0" />
                <span>Mastered</span>
              </div>
              <span className="font-mono text-2xs text-foreground-subtle">≥80%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-foreground shrink-0" />
                <span>Quizzed</span>
              </div>
              <span className="font-mono text-2xs text-foreground-subtle">50-79%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-info shrink-0" />
                <span>Explored</span>
              </div>
              <span className="font-mono text-2xs text-foreground-subtle">&gt;0%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-warning shrink-0" />
                <span>Stale</span>
              </div>
              <span className="font-mono text-2xs text-foreground-subtle">Needs Review</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Timeline Replay Bar */}
      {isReplayMode && (
        <TimelineReplayBar
          timeline={timeline}
          currentEventIndex={currentEventIndex}
          onSelectEventIndex={setCurrentEventIndex}
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying((prev) => !prev)}
          playbackSpeed={playbackSpeed}
          onSpeedChange={setPlaybackSpeed}
          onClose={() => {
            setIsReplayMode(false);
            setIsPlaying(false);
          }}
          visibleNodeCount={nodes.length}
          totalNodeCount={Object.keys(tree?.nodes || {}).length}
          masteredConceptCount={
            masterySummary?.concepts.filter((c) => c.masteryLevel === "mastered").length || 0
          }
          totalConceptCount={masterySummary?.totalConcepts || 0}
        />
      )}
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
