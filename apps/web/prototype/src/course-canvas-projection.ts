import type { CanvasGraph, CanvasItem, CanvasLayout } from "@/lib/canvas/types";
import { layoutRoadmap, reconcileRoadmapPositions } from "@/lib/canvas/roadmapLayout";
import type { Roadmap } from "./catalog";

export type { CanvasLayout } from "@/lib/canvas/types";

/** Projects the complete sample roadmap into the same phase/topic hierarchy as List view. */
export function projectCourseRoadmap(roadmap: Roadmap): CanvasGraph {
  const items: CanvasItem[] = [];
  const links: CanvasGraph["links"] = [];
  let order = 0;

  roadmap.phases.forEach((phase, phaseIndex) => {
    const phaseId = `course-phase-${phaseIndex + 1}`;
    items.push({
      id: phaseId,
      kind: "milestone",
      title: phase.title,
      summary: `${phase.lessons.length} ${phase.lessons.length === 1 ? "lesson" : "lessons"}`,
      metaLabel: "Phase",
      itemIds: [phaseId],
      selectionId: phaseId,
      lane: "spine",
      parentId: null,
      originId: null,
      order: order++,
    });

    if (phaseIndex > 0) {
      const previousId = `course-phase-${phaseIndex}`;
      links.push({
        id: `phase-sequence:${previousId}:${phaseId}`,
        source: previousId,
        target: phaseId,
        kind: "sequence",
      });
    }

    phase.lessons.forEach((lesson) => {
      items.push({
        id: lesson.id,
        kind: "topic",
        title: lesson.title,
        summary: lesson.objective,
        metaLabel: `${lesson.duration} min`,
        itemIds: [lesson.id],
        selectionId: lesson.id,
        lane: "side",
        parentId: phaseId,
        originId: phaseId,
        order: order++,
      });
      links.push({
        id: `phase-contains:${phaseId}:${lesson.id}`,
        source: phaseId,
        target: lesson.id,
        kind: "containment",
      });
    });
  });

  return { items, links };
}

export function createCourseCanvasLayout(graph: CanvasGraph): CanvasLayout {
  return layoutRoadmap(graph, {});
}

/** Preserve saved drags for surviving IDs, while removing positions from another course. */
export function reconcileCourseCanvasLayout(
  current: CanvasLayout | undefined,
  generated: CanvasLayout,
): CanvasLayout {
  if (
    !current ||
    current.version !== "spine-v1" ||
    typeof current.topologyKey !== "string" ||
    !current.positions ||
    typeof current.positions !== "object"
  )
    return generated;
  const reconciled = reconcileRoadmapPositions(current, generated);
  const validIds = new Set(Object.keys(generated.positions));
  const positions = Object.fromEntries(
    Object.entries(reconciled.positions).filter(
      ([id, point]) =>
        validIds.has(id) &&
        Number.isFinite(point?.x) &&
        Number.isFinite(point?.y) &&
        Math.abs(point.x) <= 1_000_000 &&
        Math.abs(point.y) <= 1_000_000,
    ),
  );
  for (const [id, point] of Object.entries(generated.positions))
    positions[id] ??= point;
  return {
    ...reconciled,
    positions,
    viewport:
      current.viewport &&
      Number.isFinite(current.viewport.x) &&
      Number.isFinite(current.viewport.y) &&
      Number.isFinite(current.viewport.zoom) &&
      Math.abs(current.viewport.x) <= 1_000_000 &&
      Math.abs(current.viewport.y) <= 1_000_000 &&
      current.viewport.zoom >= 0.15 &&
      current.viewport.zoom <= 1.8
        ? current.viewport
        : null,
  };
}
