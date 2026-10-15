import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@xyflow/react/dist/style.css";
import { CanvasCard } from "@/components/canvas/CanvasCard";
import { CanvasSurface } from "@/components/canvas/CanvasSurface";
import type { CanvasItem } from "@/lib/canvas/types";
import type { Roadmap } from "./catalog";
import {
  createCourseCanvasLayout,
  projectCourseRoadmap,
  reconcileCourseCanvasLayout,
  type CanvasLayout,
} from "./course-canvas-projection";

export type { CanvasLayout } from "./course-canvas-projection";

export interface CourseCanvasProps {
  roadmap: Roadmap;
  completedIds: string[];
  selectedTopicId?: string;
  scopeId: string;
  layout?: CanvasLayout;
  onLayoutChange: (layout: CanvasLayout) => void;
  onTopic: (topicId: string) => void;
}

export function CourseCanvas(props: CourseCanvasProps) {
  return (
    <CourseCanvasView
      key={`${props.scopeId}:${props.roadmap.id}`}
      {...props}
    />
  );
}

function CourseCanvasView({
  roadmap,
  completedIds,
  selectedTopicId,
  layout,
  onLayoutChange,
  onTopic,
}: CourseCanvasProps) {
  const graph = useMemo(() => projectCourseRoadmap(roadmap), [roadmap]);
  const generated = useMemo(() => createCourseCanvasLayout(graph), [graph]);
  const visibleLayout = useMemo(
    () => reconcileCourseCanvasLayout(layout, generated),
    [layout, generated],
  );
  const completed = useMemo(() => new Set(completedIds), [completedIds]);
  const lessonIds = useMemo(
    () => new Set(roadmap.phases.flatMap((phase) => phase.lessons.map(({ id }) => id))),
    [roadmap],
  );
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>();
  const [showMinimap, setShowMinimap] = useState(false);
  const initializedLayout = useRef(false);
  const initialViewportGuard = useRef(true);
  const [rendererMounted, setRendererMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setRendererMounted(true));
    const guardTimer = window.setTimeout(() => {
      initialViewportGuard.current = false;
    }, 1200);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(guardTimer);
    };
  }, []);

  useEffect(() => {
    if (layout || initializedLayout.current) return;
    initializedLayout.current = true;
    onLayoutChange(generated);
  }, [layout, generated, onLayoutChange]);

  const select = useCallback(
    (id: string) => {
      if (lessonIds.has(id)) {
        onTopic(id);
        return;
      }
      if (graph.items.some((item) => item.id === id && item.kind === "milestone"))
        setSelectedPhaseId(id);
    },
    [graph.items, lessonIds, onTopic],
  );
  const persistLayout = useCallback(
    (next: CanvasLayout) => {
      if (initialViewportGuard.current) {
        const expected = visibleLayout.viewport;
        const received = next.viewport;
        if (expected) {
          const restored =
            received &&
            Math.abs(received.x - expected.x) < 0.01 &&
            Math.abs(received.y - expected.y) < 0.01 &&
            Math.abs(received.zoom - expected.zoom) < 0.001;
          if (!restored) {
            // React Flow can report its mount-time origin before the saved viewport applies.
            onLayoutChange({ ...next, viewport: { ...expected } });
            return;
          }
          initialViewportGuard.current = false;
        } else if (received) {
          if (
            Math.abs(received.x) < 0.01 &&
            Math.abs(received.y) < 0.01 &&
            Math.abs(received.zoom - 1) < 0.001
          ) {
            // Keep the viewport empty so CanvasSurface can complete its initial fit.
            onLayoutChange({ ...next, viewport: null });
            return;
          }
          initialViewportGuard.current = false;
        }
      }
      onLayoutChange(next);
    },
    [onLayoutChange, visibleLayout.viewport],
  );
  const renderItem = useCallback(
    (item: CanvasItem) => (
      <CanvasCard
        item={{
          ...item,
          summary: completed.has(item.id)
            ? `Completed · ${item.summary ?? ""}`
            : item.summary,
        }}
        selected={
          item.kind === "topic"
            ? selectedTopicId === item.id
            : selectedPhaseId === item.id
        }
        streaming={false}
        onSelect={select}
        compact
        completed={completed.has(item.id)}
      />
    ),
    [completed, selectedTopicId, selectedPhaseId, select],
  );

  return (
    <div className="h-full min-h-0 min-w-0 w-full overflow-hidden">
      <CanvasSurface
        graph={graph}
        renderItem={renderItem}
        layout={visibleLayout}
        layoutMode="roadmap"
        showDependencies={false}
        onLayoutChange={persistLayout}
        onSelect={select}
        sidePanelWidth={0}
        ready={Boolean(layout) && rendererMounted}
        readOnly={!layout || !rendererMounted}
        activeSelectionId={selectedTopicId ?? selectedPhaseId}
        showMinimap={showMinimap}
        onToggleMinimap={() => setShowMinimap((value) => !value)}
      />
    </div>
  );
}
