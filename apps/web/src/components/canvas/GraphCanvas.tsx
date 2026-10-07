"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAncestorPath, type ConversationTree, type WorkspaceMasterySummary, type WorkspaceTimelineResponse } from "@graphmind/shared";
import { projectConversation, filterConversationByTime } from "@/lib/canvas/conversationProjection";
import { canvasTopologyKey, layoutSpine } from "@/lib/canvas/spineLayout";
import { reconcilePositions } from "@/lib/canvas/layoutState";
import { getWorkspaceMastery, getWorkspaceTimeline } from "@/lib/workspaceApi";
import type { CanvasItem } from "@/lib/canvas/types";
import { CanvasSurface } from "./CanvasSurface";
import { ConversationCanvasCard, type ThreadMasteryInfo } from "./ThreadGraphNode";
import { TimelineReplayBar } from "./TimelineReplayBar";
import { Button } from "@/components/ui/button";
import { useCanvasLayout } from "@/hooks/useCanvasLayout";

export interface GraphCanvasProps {
  tree: ConversationTree | null; workspaceId?: string; chatId?: string; isStreaming?: boolean;
  onSelectNode: (nodeId: string) => void;
  onExploreBranch?: (nodeId: string, contextText?: string) => void;
  onSwitchToChat?: (nodeId: string) => void;
  onDeleteBranch?: (nodeId: string) => void;
  onRetry?: () => void;
  onFitViewRef?: React.MutableRefObject<(() => void) | null>;
  onCenterActiveRef?: React.MutableRefObject<(() => void) | null>;
  onAutoLayoutRef?: React.MutableRefObject<(() => void) | null>;
  onPaneClick?: () => void; isSidePeekOpen?: boolean;
}

export function GraphCanvas({ tree, workspaceId, chatId, isStreaming = false, onSelectNode, onDeleteBranch,
  onFitViewRef, onCenterActiveRef, onAutoLayoutRef, onPaneClick, isSidePeekOpen = false }: GraphCanvasProps) {
  const [showMinimap, setShowMinimap] = useState(false);
  const [showMastery, setShowMastery] = useState(false);
  const [replay, setReplay] = useState(false);
  const [mastery, setMastery] = useState<WorkspaceMasterySummary | null>(null);
  const [timeline, setTimeline] = useState<WorkspaceTimelineResponse | null>(null);
  const [eventIndex, setEventIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const loadMastery = useCallback(async () => {
    if (!workspaceId) return;
    const id = ++request.current;
    try { const data = await getWorkspaceMastery(workspaceId); if (!data) throw new Error("Mastery unavailable"); if (id === request.current) { setMastery(data); setError(null); } }
    catch { if (id === request.current) setError("Could not load mastery. Try opening it again."); }
  }, [workspaceId]);
  const loadTimeline = useCallback(async () => {
    if (!workspaceId) return;
    try { const data = await getWorkspaceTimeline(workspaceId); if (!data) throw new Error("Timeline unavailable"); setTimeline(data); setEventIndex(Math.max(0, data.events.length - 1)); setError(null); }
    catch { setError("Could not load timeline. Try opening it again."); }
  }, [workspaceId]);
  useEffect(() => {
    if (!showMastery) return;
    void loadMastery();
    const updated = () => { void loadMastery(); };
    window.addEventListener("concept-mastery-updated", updated);
    return () => { request.current++; window.removeEventListener("concept-mastery-updated", updated); };
  }, [showMastery, loadMastery]);
  useEffect(() => { if (replay) void loadTimeline(); else setPlaying(false); }, [replay, loadTimeline]);
  useEffect(() => {
    if (!playing || !timeline?.events.length) return;
    const timer = setInterval(() => setEventIndex(index => {
      if (index >= timeline.events.length - 1) { setPlaying(false); return index; }
      return index + 1;
    }), Math.max(250, 1200 / speed));
    return () => clearInterval(timer);
  }, [playing, timeline, speed]);
  const visibleTree = useMemo(() => tree && replay && timeline?.events[eventIndex]
    ? filterConversationByTime(tree, timeline.events[eventIndex].timestamp) : tree, [tree, replay, timeline, eventIndex]);
  const liveGraph = useMemo(() => tree ? projectConversation(tree) : { items: [], links: [] }, [tree]);
  const graph = useMemo(() => visibleTree ? projectConversation(visibleTree) : { items: [], links: [] }, [visibleTree]);
  const topology = canvasTopologyKey(liveGraph);
  const replayTopology = canvasTopologyKey(graph);
  const stored = useCanvasLayout(workspaceId, chatId ?? tree?.rootNodeId, "conversation");
  const generated = useMemo(() => layoutSpine(liveGraph, {}), [topology]);
  const liveLayout = stored.layout ?? generated;
  const graphReady = Boolean(liveGraph.items.length && tree?.rootNodeId === (chatId ?? tree?.rootNodeId));
  const [replayLayout, setReplayLayout] = useState(() => layoutSpine(graph, {}));
  useEffect(() => {
    if (stored.ready && graphReady) stored.setLayout(current => current ? reconcilePositions(current, generated) : generated);
  }, [stored.ready, graphReady, generated, stored.setLayout]);
  useEffect(() => { if (replay) setReplayLayout(reconcilePositions(liveLayout, layoutSpine(graph, {}))); }, [replay, replayTopology]);
  const layout = replay ? replayLayout : liveLayout;
  const setLayout = replay ? setReplayLayout : stored.setLayout;
  const lineage = useMemo(() => new Set(tree ? getAncestorPath(tree, tree.activeNodeId).map(node => node.id) : []), [tree]);
  const activeItems = useMemo(() => new Set(graph.items.filter(item => item.itemIds.some(id => lineage.has(id))).map(item => item.id)), [graph, lineage]);
  const renderItem = useCallback((item: CanvasItem) => {
    const concepts = showMastery ? mastery?.concepts.filter(concept => concept.nodeIds?.some(id => item.itemIds.includes(id))) ?? [] : [];
    const evidence: ThreadMasteryInfo | undefined = concepts.length ? {
      level: concepts[0].masteryLevel, score: concepts.reduce((sum, concept) => sum + concept.confidenceScore, 0) / concepts.length,
      primaryConcept: concepts[0].name, totalConcepts: concepts.length,
    } : undefined;
    return <ConversationCanvasCard item={item} selected={activeItems.has(item.id)}
      streaming={isStreaming && item.itemIds.includes(tree?.activeNodeId ?? "")} onSelect={onSelectNode}
      onDelete={replay ? undefined : onDeleteBranch} mastery={evidence} />;
  }, [showMastery, mastery, activeItems, isStreaming, tree?.activeNodeId, onSelectNode, onDeleteBranch, replay]);
  if (!graph.items.length) return <div className="flex h-full items-center justify-center bg-canvas-background p-6 text-sm text-foreground-muted">
    {replay ? "No conversation at this point in the timeline." : "Your conversation will appear here."}
  </div>;
  return <div className="relative h-full w-full">
    <CanvasSurface graph={graph} renderItem={renderItem} layout={layout} onLayoutChange={setLayout}
      onSelect={onSelectNode} onPaneClick={onPaneClick} activeSelectionId={tree?.activeNodeId}
      activeItemIds={activeItems} sidePanelWidth={isSidePeekOpen ? 540 : 0} readOnly={replay || !stored.ready}
      ready={stored.ready && graphReady}
      showMinimap={showMinimap} onToggleMinimap={() => setShowMinimap(value => !value)}
      onFitViewRef={onFitViewRef} onCenterActiveRef={onCenterActiveRef} onAutoLayoutRef={onAutoLayoutRef}
      advancedItems={workspaceId ? [
        { label: showMastery ? "Hide mastery" : "Show mastery", onClick: () => setShowMastery(value => !value) },
        { label: replay ? "Exit timeline" : "Open timeline", onClick: () => setReplay(value => !value) },
      ] : []} />
    {!replay && (stored.loadError || stored.saveState === "error") && <div role="alert" className="absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-xl border border-border bg-surface p-3 text-xs text-foreground-muted">
      {stored.loadError ?? (stored.conflict ? "This canvas changed in another tab." : "Your canvas changes haven’t been saved.")}
      <Button size="sm" variant="ghost" onClick={stored.loadError || stored.conflict ? () => { void stored.reload(); } : stored.retrySave}>
        {stored.loadError ? "Retry load" : stored.conflict ? "Reload latest" : "Retry save"}
      </Button>
    </div>}
    {error && <div role="alert" className="absolute bottom-4 left-4 flex items-center gap-2 rounded-xl border border-border bg-surface p-3 text-xs text-foreground-muted">
      {error}<Button size="sm" variant="ghost" onClick={() => setError(null)}>Dismiss</Button>
    </div>}
    {replay && <TimelineReplayBar timeline={timeline} currentEventIndex={eventIndex} onSelectEventIndex={setEventIndex}
      isPlaying={playing} onTogglePlay={() => setPlaying(value => !value)} playbackSpeed={speed} onSpeedChange={setSpeed}
      onClose={() => { setReplay(false); setPlaying(false); }} visibleNodeCount={graph.items.length}
      totalNodeCount={Object.keys(tree?.nodes ?? {}).length} masteredConceptCount={mastery?.concepts.filter(concept => concept.masteryLevel === "mastered").length ?? 0}
      totalConceptCount={mastery?.totalConcepts ?? 0} />}
  </div>;
}
