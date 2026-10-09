"use client";

import React, { useCallback, useEffect, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  MiniMap,
  useNodesState,
  useNodesInitialized,
  useReactFlow,
  useViewport,
  type Node,
  type NodeProps,
  type Edge,
} from "@xyflow/react";
import { CanvasControls } from "./CanvasControls";
import { MindMapEdge } from "./MindMapEdge";
import type { DropdownMenuItemProps } from "@/components/ui/dropdown-menu";
import type {
  CanvasGraph,
  CanvasItem,
  CanvasLayout,
  CanvasBounds,
} from "@/lib/canvas/types";
import { layoutSpine } from "@/lib/canvas/spineLayout";
import { reconcilePositions } from "@/lib/canvas/layoutState";
import {
  layoutRoadmap,
  reconcileRoadmapPositions,
} from "@/lib/canvas/roadmapLayout";

interface ItemData extends Record<string, unknown> {
  rendered: React.ReactNode;
  item: CanvasItem;
}
const ItemNode = ({ data }: NodeProps<Node<ItemData>>) => (
  <div className="relative">
    <Handle
      type="target"
      id="sequence"
      position={Position.Top}
      className="!size-1 !border-0 !bg-canvas-connector"
    />
    <Handle
      type="target"
      id="branch"
      position={Position.Left}
      className="!size-1 !border-0 !bg-canvas-connector"
    />
    {data.rendered}
    <Handle
      type="source"
      id="sequence"
      position={Position.Bottom}
      className="!size-1 !border-0 !bg-canvas-connector"
    />
    <Handle
      type="source"
      id="branch"
      position={Position.Right}
      className="!size-1 !border-0 !bg-canvas-connector"
    />
    <Handle
      type="source"
      id="branch-left"
      position={Position.Left}
      className="!size-1 !border-0 !bg-canvas-connector"
    />
    <Handle
      type="target"
      id="branch-right"
      position={Position.Right}
      className="!size-1 !border-0 !bg-canvas-connector"
    />
  </div>
);
const nodeTypes = { canvasItem: ItemNode };
const edgeTypes = { mindMapEdge: MindMapEdge };

export interface CanvasSurfaceProps {
  graph: CanvasGraph;
  renderItem: (item: CanvasItem) => React.ReactNode;
  layout: CanvasLayout;
  onLayoutChange: (layout: CanvasLayout) => void;
  onSelect: (selectionId: string) => void;
  onPaneClick?: () => void;
  sidePanelWidth: number;
  advancedControls?: React.ReactNode;
  advancedItems?: DropdownMenuItemProps[];
  activeSelectionId?: string;
  activeItemIds?: Set<string>;
  showMinimap?: boolean;
  onToggleMinimap?: () => void;
  onFitViewRef?: React.MutableRefObject<(() => void) | null>;
  onCenterActiveRef?: React.MutableRefObject<(() => void) | null>;
  onAutoLayoutRef?: React.MutableRefObject<(() => void) | null>;
  readOnly?: boolean;
  ready?: boolean;
  layoutMode?: "spine" | "roadmap";
  showDependencies?: boolean;
  initialFitIds?: string[];
}

function Surface({
  graph,
  renderItem,
  layout,
  onLayoutChange,
  onSelect,
  onPaneClick,
  sidePanelWidth,
  advancedControls,
  advancedItems = [],
  activeSelectionId,
  activeItemIds,
  showMinimap = false,
  onToggleMinimap,
  onFitViewRef,
  onCenterActiveRef,
  onAutoLayoutRef,
  readOnly = false,
  ready = true,
  layoutMode = "spine",
  showDependencies = true,
  initialFitIds,
}: CanvasSurfaceProps) {
  const makeLayout = layoutMode === "roadmap" ? layoutRoadmap : layoutSpine;
  const flow = useReactFlow<Node<ItemData>>();
  const initialized = useNodesInitialized();
  const { zoom } = useViewport();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ItemData>>([]);
  const incomingPositions = useRef(layout.positions);
  const didInitialize = useRef(false);
  const appliedViewport = useRef<string | null>(null);
  const fitFrame = useRef<number | null>(null);
  const latest = useRef({ graph, layout, onLayoutChange });
  latest.current = { graph, layout, onLayoutChange };

  useEffect(() => {
    const changedPlacement = incomingPositions.current !== layout.positions;
    incomingPositions.current = layout.positions;
    setNodes((previous) => {
      const existing = new Map(previous.map((node) => [node.id, node]));
      return graph.items.map((item) => {
        const old = existing.get(item.id);
        return {
          ...old,
          id: item.id,
          type: "canvasItem",
          position:
            old && (!changedPlacement || old.dragging)
              ? old.position
              : (layout.positions[item.id] ?? { x: 40, y: 40 }),
          style: {
            width:
              layoutMode === "roadmap"
                ? item.lane === "spine"
                  ? 220
                  : 240
                : item.lane === "spine"
                  ? 260
                  : 300,
          },
          data: { item, rendered: renderItem(item) },
        };
      });
    });
  }, [graph, renderItem, layout.positions, setNodes, layoutMode]);

  const fit = useCallback(() => {
    const panelRatio = sidePanelWidth / Math.max(1, window.innerWidth);
    void flow.fitView({
      padding: Math.min(0.8, 0.2 + panelRatio),
      maxZoom: 1.05,
      duration: 250,
    });
  }, [flow, sidePanelWidth]);
  const measuredBounds = useCallback(
    () =>
      Object.fromEntries(
        flow.getNodes().map((node) => [
          node.id,
          {
            width: node.measured?.width ?? Number(node.style?.width ?? 300),
            height:
              node.measured?.height ?? (layoutMode === "roadmap" ? 64 : 128),
          },
        ]),
      ) as Record<string, CanvasBounds>,
    [flow, layoutMode],
  );
  const autoLayout = useCallback(() => {
    const state = latest.current;
    state.onLayoutChange({
      ...makeLayout(state.graph, measuredBounds()),
      viewport: state.layout.viewport,
    });
    requestAnimationFrame(fit);
  }, [fit, measuredBounds, makeLayout]);
  const center = useCallback(() => {
    const item = graph.items.find((candidate) =>
      candidate.itemIds.includes(activeSelectionId ?? ""),
    );
    const node =
      item && flow.getNodes().find((candidate) => candidate.id === item.id);
    if (node)
      void flow.setCenter(
        node.position.x + (node.measured?.width ?? 260) / 2,
        node.position.y + (node.measured?.height ?? 128) / 2,
        { zoom: Math.max(flow.getZoom(), 0.8), duration: 250 },
      );
  }, [graph.items, activeSelectionId, flow]);

  useEffect(() => {
    if (onFitViewRef) onFitViewRef.current = fit;
    if (onCenterActiveRef) onCenterActiveRef.current = center;
    if (onAutoLayoutRef) onAutoLayoutRef.current = autoLayout;
    return () => {
      if (onFitViewRef) onFitViewRef.current = null;
      if (onCenterActiveRef) onCenterActiveRef.current = null;
      if (onAutoLayoutRef) onAutoLayoutRef.current = null;
    };
  }, [
    fit,
    center,
    autoLayout,
    onFitViewRef,
    onCenterActiveRef,
    onAutoLayoutRef,
  ]);

  useEffect(() => {
    if (!ready || !initialized || !graph.items.length || didInitialize.current)
      return;
    didInitialize.current = true;
    if (layout.viewport) return;
    const generated = makeLayout(graph, measuredBounds());
    onLayoutChange(
      layoutMode === "roadmap"
        ? reconcileRoadmapPositions(layout, generated)
        : reconcilePositions(layout, generated, measuredBounds()),
    );
    fitFrame.current = requestAnimationFrame(() => {
      if (initialFitIds?.length)
        void flow.fitView({
          nodes: initialFitIds.map((id) => ({ id })),
          padding: 0.3,
          maxZoom: 1.05,
          duration: 250,
        });
      else fit();
    });
  }, [
    ready,
    initialized,
    graph,
    layout,
    onLayoutChange,
    measuredBounds,
    fit,
    makeLayout,
    layoutMode,
    initialFitIds,
    flow,
  ]);
  useEffect(
    () => () => {
      if (fitFrame.current !== null) cancelAnimationFrame(fitFrame.current);
    },
    [],
  );

  useEffect(() => {
    if (!ready || !layout.viewport) return;
    const key = JSON.stringify(layout.viewport);
    if (appliedViewport.current === key) return;
    appliedViewport.current = key;
    void flow.setViewport(layout.viewport);
  }, [ready, layout.viewport, flow]);

  const byId = new Map(graph.items.map((item) => [item.id, item]));
  const edges: Edge[] = graph.links
    .filter((link) => {
      if (layoutMode !== "roadmap") return true;
      const bothSpine =
        byId.get(link.source)?.lane === "spine" &&
        byId.get(link.target)?.lane === "spine";
      if (link.kind === "containment" && bothSpine) return false;
      return (
        link.kind === "containment" ||
        (link.kind === "sequence" && bothSpine) ||
        showDependencies
      );
    })
    .map((link) => {
      const source = layout.positions[link.source],
        target = layout.positions[link.target];
      const vertical =
        layoutMode === "roadmap"
          ? source?.x === target?.x
          : link.kind === "sequence";
      const left =
        layoutMode === "roadmap" && source && target && target.x < source.x;
      return {
        ...link,
        type: "mindMapEdge",
        sourceHandle: vertical ? "sequence" : left ? "branch-left" : "branch",
        targetHandle: vertical ? "sequence" : left ? "branch-right" : "branch",
        data: {
          isActiveLineage: Boolean(
            activeItemIds?.has(link.source) && activeItemIds?.has(link.target),
          ),
          relationKind: link.kind,
          simple: layoutMode === "roadmap",
        },
      };
    });
  return (
    <div
      className={`relative h-full w-full bg-canvas-background ${zoom < 0.6 ? "canvas-compact" : ""}`}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={(_, node) => onSelect(node.data.item.selectionId)}
        onPaneClick={onPaneClick}
        onEdgeClick={onPaneClick}
        nodesConnectable={false}
        nodesDraggable={!readOnly}
        selectNodesOnDrag={false}
        minZoom={0.15}
        maxZoom={1.8}
        onNodeDragStop={(_, node) => {
          if (readOnly) return;
          const state = latest.current;
          state.onLayoutChange({
            ...state.layout,
            positions: { ...state.layout.positions, [node.id]: node.position },
          });
        }}
        onMoveEnd={(_, viewport) => {
          appliedViewport.current = JSON.stringify(viewport);
          if (!ready || readOnly) return;
          const state = latest.current;
          state.onLayoutChange({ ...state.layout, viewport });
        }}
        onlyRenderVisibleElements
        className="touch-none"
      >
        {showMinimap && (
          <MiniMap
            nodeColor="var(--canvas-milestone)"
            className="rounded-xl border border-border !bg-surface"
          />
        )}
      </ReactFlow>
      <div className="absolute left-4 top-4 z-20 flex items-center gap-2">
        <CanvasControls
          onFit={fit}
          onZoomIn={() => {
            void flow.zoomIn();
          }}
          onZoomOut={() => {
            void flow.zoomOut();
          }}
          items={[
            { label: "Auto layout", onClick: autoLayout, disabled: readOnly },
            { label: "Center active topic", onClick: center },
            {
              label: "Reset zoom",
              onClick: () => {
                void flow.zoomTo(1);
              },
            },
            ...(onToggleMinimap
              ? [
                  {
                    label: showMinimap ? "Hide minimap" : "Show minimap",
                    onClick: onToggleMinimap,
                  },
                ]
              : []),
            ...advancedItems,
          ]}
        />
        {advancedControls}
      </div>
    </div>
  );
}

export function CanvasSurface(props: CanvasSurfaceProps) {
  return (
    <ReactFlowProvider>
      <Surface {...props} />
    </ReactFlowProvider>
  );
}
