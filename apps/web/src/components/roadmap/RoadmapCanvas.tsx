"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CanvasSurface } from "@/components/canvas/CanvasSurface";
import { CanvasCard } from "@/components/canvas/CanvasCard";
import { Button } from "@/components/ui/button";
import { useCanvasLayout } from "@/hooks/useCanvasLayout";
import {
  projectCurriculum,
  initialCurriculumExpansion,
  selectedCoreTopics,
} from "@/lib/canvas/curriculumProjection";
import {
  layoutRoadmap,
  reconcileRoadmapPositions,
} from "@/lib/canvas/roadmapLayout";
import type { CurriculumView } from "@/lib/roadmapTypes";
import type { CanvasItem } from "@/lib/canvas/types";
export function RoadmapCanvas({
  view,
  onOpenTopic,
}: {
  view: CurriculumView;
  onOpenTopic?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(() =>
    initialCurriculumExpansion(view),
  );
  const [selected, setSelected] = useState<string>();
  const [minimap, setMinimap] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [showDependencies, setShowDependencies] = useState(false);
  const graph = useMemo(
    () => projectCurriculum(view, expanded, showAlternatives),
    [view, expanded, showAlternatives],
  );
  const generated = useMemo(() => layoutRoadmap(graph, {}), [graph]);
  const initialFitIds = useMemo(() => {
    const next = selectedCoreTopics(view).find(
      (i) => view.progress[i.id]?.status !== "completed",
    );
    const parent = graph.items.find((i) => i.id === next?.id)?.parentId;
    return graph.items
      .filter(
        (i) => i.id === parent || i.parentId === parent || i.id === next?.id,
      )
      .map((i) => i.id);
  }, [view, graph]);
  const stored = useCanvasLayout(
    view.workspaceId,
    view.canvasAnchorChatId,
    "curriculum",
  );
  const { ready, setLayout } = stored;
  const visibleLayout = useMemo(
    () =>
      stored.layout
        ? reconcileRoadmapPositions(stored.layout, generated)
        : generated,
    [stored.layout, generated],
  );
  useEffect(() => {
    if (ready)
      setLayout((current) =>
        current ? reconcileRoadmapPositions(current, generated) : generated,
      );
  }, [ready, setLayout, generated]);
  const select = useCallback(
    (id: string) => {
      setSelected(id);
      const item = view.candidate.items.find((i) => i.id === id);
      if (item?.kind === "topic") onOpenTopic?.(id);
      else
        setExpanded((old) => {
          const next = new Set(old);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
    },
    [view, onOpenTopic],
  );
  const render = useCallback(
    (item: CanvasItem) => (
      <CanvasCard
        item={{
          ...item,
          summary:
            view.progress[item.id]?.status === "completed"
              ? `Completed · ${item.summary ?? ""}`
              : item.summary,
        }}
        selected={selected === item.id}
        streaming={false}
        onSelect={select}
        compact
        expanded={item.kind !== "topic" ? expanded.has(item.id) : undefined}
        completed={view.progress[item.id]?.status === "completed"}
      />
    ),
    [view.progress, selected, select, expanded],
  );
  return (
    <div className="relative h-full min-h-0 w-full">
      <CanvasSurface
        graph={graph}
        renderItem={render}
        layout={visibleLayout}
        layoutMode="roadmap"
        showDependencies={showDependencies}
        initialFitIds={initialFitIds}
        advancedItems={[
          {
            label: showDependencies ? "Hide dependencies" : "Show dependencies",
            onClick: () => setShowDependencies((value) => !value),
          },
        ]}
        onLayoutChange={stored.setLayout}
        onSelect={select}
        sidePanelWidth={0}
        activeSelectionId={selected}
        ready={stored.ready}
        readOnly={!stored.ready}
        showMinimap={minimap}
        onToggleMinimap={() => setMinimap((old) => !old)}
      />
      {view.candidate.choices.some(
        (choice) =>
          expanded.has(choice.choiceId) &&
          graph.items.some((item) => item.id === choice.choiceId),
      ) && (
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={showAlternatives}
          className="absolute right-3 top-3 border border-border bg-surface"
          onClick={() => setShowAlternatives((value) => !value)}
        >
          {showAlternatives ? "Hide alternatives" : "Show alternatives"}
        </Button>
      )}
      {(stored.loadError || stored.saveState === "error") && (
        <div
          role="alert"
          className="absolute bottom-4 right-4 rounded-xl border border-border bg-surface p-3 text-xs"
        >
          {stored.loadError ??
            (stored.conflict
              ? "Canvas changed in another tab."
              : "Canvas changes haven’t been saved.")}
          <Button
            size="sm"
            variant="ghost"
            onClick={
              stored.loadError || stored.conflict
                ? () => void stored.reload()
                : stored.retrySave
            }
          >
            {stored.conflict ? "Reload latest" : "Retry"}
          </Button>
        </div>
      )}
    </div>
  );
}
