import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { roadmaps } from "./catalog";
import { CourseCanvas } from "./course-canvas";
import {
  createCourseCanvasLayout,
  projectCourseRoadmap,
  reconcileCourseCanvasLayout,
} from "./course-canvas-projection";

vi.mock("@/components/canvas/CanvasSurface", () => ({
  CanvasSurface: ({ graph, renderItem, onSelect, layout, onLayoutChange, ready, readOnly }: any) => (
    <div data-testid="canvas-surface" data-ready={String(ready)} data-read-only={String(readOnly)}>
      <output>{Object.keys(layout.positions).length}</output>
      {graph.items.map((item: any) => (
        <div key={item.id}>
          {renderItem(item)}
          <button onClick={() => onSelect(item.selectionId)}>{`select ${item.id}`}</button>
        </div>
      ))}
      <button onClick={() => onLayoutChange(layout)}>save layout</button>
      <button
        onClick={() =>
          onLayoutChange({ ...layout, viewport: { x: 0, y: 0, zoom: 1 } })
        }
      >
        emit initial viewport
      </button>
    </div>
  ),
}));

afterEach(cleanup);

const roadmap = roadmaps[0];

describe("course roadmap canvas projection", () => {
  it("projects every listed lesson and only real phase containment and sequence links", () => {
    const graph = projectCourseRoadmap(roadmap);
    const lessonIds = roadmap.phases.flatMap((phase) =>
      phase.lessons.map((lesson) => lesson.id),
    );
    const projectedLessonIds = graph.items
      .filter((item) => item.kind === "topic")
      .map((item) => item.id);

    expect(projectedLessonIds).toEqual(lessonIds);
    expect(graph.items.filter((item) => item.kind === "milestone")).toHaveLength(
      roadmap.phases.length,
    );
    expect(graph.links.every((link) =>
      graph.items.some((item) => item.id === link.source) &&
      graph.items.some((item) => item.id === link.target),
    )).toBe(true);
    expect(graph.links.filter((link) => link.kind === "containment")).toHaveLength(
      lessonIds.length,
    );
    expect(graph.links.some((link) => link.kind === "prerequisite")).toBe(false);
  });

  it("creates a complete layout, drops stale IDs, and rejects invalid saved coordinates", () => {
    const graph = projectCourseRoadmap(roadmap);
    const generated = createCourseCanvasLayout(graph);
    expect(Object.keys(generated.positions).sort()).toEqual(
      graph.items.map((item) => item.id).sort(),
    );

    const firstId = graph.items[0].id;
    const restored = reconcileCourseCanvasLayout(
      {
        ...generated,
        positions: {
          ...generated.positions,
          [firstId]: { x: 140, y: 260 },
          "unrelated-course-topic": { x: 12, y: 12 },
          [graph.items[1].id]: { x: Number.NaN, y: 3 },
        },
        viewport: { x: 0, y: 0, zoom: 99 },
      },
      generated,
    );

    expect(Object.keys(restored.positions).sort()).toEqual(
      graph.items.map((item) => item.id).sort(),
    );
    expect(restored.positions[firstId]).toEqual({ x: 140, y: 260 });
    expect(restored.positions[graph.items[1].id]).toEqual(
      generated.positions[graph.items[1].id],
    );
    expect(restored.viewport).toBeNull();
  });

  it("reports only lesson IDs to the topic callback and renders completion state", () => {
    const onTopic = vi.fn();
    const onLayoutChange = vi.fn();
    render(
      <CourseCanvas
        roadmap={roadmap}
        completedIds={["py-01"]}
        selectedTopicId="py-01"
        scopeId="public::roadmap-python-backend"
        onLayoutChange={onLayoutChange}
        onTopic={onTopic}
      />,
    );

    const canvasSurface = screen.getByTestId("canvas-surface");
    expect(canvasSurface.getAttribute("data-ready")).toBe("false");
    expect(canvasSurface.getAttribute("data-read-only")).toBe("true");
    const topicCard = screen.getByRole("button", {
      name: "Python foundations for backend work",
    });
    expect(topicCard.getAttribute("aria-pressed")).toBe("true");
    expect(topicCard.getAttribute("aria-description")).toContain("Completed");
    screen.getByRole("button", { name: "select course-phase-1" }).click();
    expect(onTopic).not.toHaveBeenCalled();
    screen.getByRole("button", { name: "select py-01" }).click();
    expect(onTopic).toHaveBeenCalledTimes(1);
    expect(onTopic).toHaveBeenCalledWith("py-01");
    expect(onLayoutChange).toHaveBeenCalledWith(
      expect.objectContaining({ version: "spine-v1" }),
    );
  });

  it("preserves a saved viewport when the renderer reports its mount-time origin", () => {
    const onLayoutChange = vi.fn();
    const graph = projectCourseRoadmap(roadmap);
    const savedViewport = { x: -340, y: 210, zoom: 0.82 };
    render(
      <CourseCanvas
        roadmap={roadmap}
        completedIds={[]}
        scopeId="enrollment-1"
        layout={{ ...createCourseCanvasLayout(graph), viewport: savedViewport }}
        onLayoutChange={onLayoutChange}
        onTopic={vi.fn()}
      />,
    );

    screen.getByRole("button", { name: "emit initial viewport" }).click();
    expect(onLayoutChange).toHaveBeenCalledTimes(1);
    expect(onLayoutChange.mock.calls[0][0].viewport).toEqual(savedViewport);
  });
});
