import { expect, it } from "vitest";
import { layoutRoadmap, reconcileRoadmapPositions } from "../roadmapLayout";
import type { CanvasGraph, CanvasItem } from "../types";

const item = (
  id: string,
  lane: CanvasItem["lane"],
  parentId: string | null,
  order: number,
): CanvasItem => ({
  id,
  kind: lane === "spine" ? "group" : "topic",
  title: id,
  itemIds: [id],
  selectionId: id,
  lane,
  parentId,
  originId: parentId,
  order,
});
const graph = (count: number): CanvasGraph => ({
  items: [
    item("phase", "spine", null, 0),
    ...Array.from({ length: count }, (_, i) =>
      item(`t${i}`, "side", "phase", i + 1),
    ),
    item("next", "spine", null, count + 1),
  ],
  links: [],
});

it("centers the path and balances topics on both sides without overlaps at 240 topics", () => {
  const g = graph(240);
  const layout = layoutRoadmap(g, {});
  const p = layout.positions;
  expect(p.phase.x).toBe(p.next.x);
  expect(p.phase.x - (p.t0.x + 240)).toBe(p.t1.x - (p.phase.x + 220));
  expect(p.t0.y).toBe(p.t1.y);
  expect(p.next.y).toBeGreaterThan(p.t239.y + 64);
  for (const a of g.items)
    for (const b of g.items) {
      if (a.id === b.id) continue;
      const x = p[a.id],
        y = p[b.id];
      const aw = a.lane === "spine" ? 220 : 240,
        bw = b.lane === "spine" ? 220 : 240;
      expect(
        x.x + aw <= y.x ||
          y.x + bw <= x.x ||
          x.y + 64 <= y.y ||
          y.y + 64 <= x.y,
      ).toBe(true);
    }
  expect(layoutRoadmap(g, {})).toEqual(layout);
});

it("reflows expansions while preserving explicit manual offsets and the viewport", () => {
  const small = layoutRoadmap(graph(2), {});
  const manuallyMoved = {
    ...small,
    viewport: { x: 3, y: 4, zoom: 1 },
    positions: {
      ...small.positions,
      t0: { x: small.positions.t0.x - 30, y: small.positions.t0.y + 10 },
    },
  };
  const expanded = layoutRoadmap(graph(8), {});
  const saved = reconcileRoadmapPositions(manuallyMoved, expanded);
  expect(saved.positions.next).toEqual(expanded.positions.next);
  expect(saved.positions.t0).toEqual({
    x: expanded.positions.t0.x - 30,
    y: expanded.positions.t0.y + 10,
  });
  expect(saved.viewport).toEqual(manuallyMoved.viewport);
  const collapsed = reconcileRoadmapPositions(
    saved,
    layoutRoadmap(graph(0), {}),
  );
  const restored = reconcileRoadmapPositions(collapsed, expanded);
  expect(restored.positions.t0).toEqual(saved.positions.t0);
});

it("migrates the old asymmetric placement and handles empty graphs", () => {
  const next = layoutRoadmap(graph(2), {});
  expect(
    reconcileRoadmapPositions(
      { ...next, topologyKey: "old", positions: { phase: { x: 40, y: 40 } } },
      next,
    ).positions,
  ).toEqual(next.positions);
  expect(layoutRoadmap({ items: [], links: [] }, {}).positions).toEqual({});
});
