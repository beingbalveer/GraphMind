"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CanvasSurface } from "@/components/canvas/CanvasSurface";
import { CanvasCard } from "@/components/canvas/CanvasCard";
import { Button } from "@/components/ui/button";
import { useCanvasLayout } from "@/hooks/useCanvasLayout";
import {
  projectCurriculum,
  initialCurriculumExpansion,
} from "@/lib/canvas/curriculumProjection";
import { layoutSpine } from "@/lib/canvas/spineLayout";
import { reconcilePositions } from "@/lib/canvas/layoutState";
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
  const graph = useMemo(
    () => projectCurriculum(view, expanded),
    [view, expanded],
  );
  const generated = useMemo(() => layoutSpine(graph, {}), [graph]);
  const stored = useCanvasLayout(
    view.workspaceId,
    view.canvasAnchorChatId,
    "curriculum",
  );
  const { ready, setLayout } = stored;
  useEffect(() => {
    if (ready)
      setLayout((current) =>
        current ? reconcilePositions(current, generated) : generated,
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
      />
    ),
    [view.progress, selected, select],
  );
  return (
    <div className="relative h-full min-h-0 w-full">
      <CanvasSurface
        graph={graph}
        renderItem={render}
        layout={stored.layout ?? generated}
        onLayoutChange={stored.setLayout}
        onSelect={select}
        sidePanelWidth={0}
        activeSelectionId={selected}
        ready={stored.ready}
        readOnly={!stored.ready}
        showMinimap={minimap}
        onToggleMinimap={() => setMinimap((old) => !old)}
      />
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
