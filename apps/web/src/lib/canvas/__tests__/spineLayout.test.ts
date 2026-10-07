import { describe, expect, it } from "vitest";
import { layoutSpine } from "../spineLayout";
import type { CanvasBounds, CanvasGraph, CanvasItem } from "../types";

const item = (id: string, lane: "spine" | "side", parentId: string | null, order: number): CanvasItem =>
  ({ id, kind: "group", title: id, itemIds: [id], selectionId: id, lane, parentId, originId: parentId, order });

describe("measured spine layout", () => {
  it("reserves the whole measured side subtree", () => {
    const graph: CanvasGraph = { items: [item("a", "spine", null, 0), item("b", "spine", "a", 1),
      item("x", "side", "a", 0), item("y", "side", "b", 0)], links: [] };
    const bounds = { a: { width: 260, height: 80 }, b: { width: 260, height: 80 },
      x: { width: 300, height: 400 }, y: { width: 300, height: 150 } };
    const layout = layoutSpine(graph, bounds);
    expect(layout.positions.y.y).toBeGreaterThanOrEqual(layout.positions.x.y + 416);
    expect(layout.positions.a.x).toBe(layout.positions.b.x);
    expect(layoutSpine(graph, bounds)).toEqual(layout);
  });

  it("does not overlap wide nested or sibling groups", () => {
    const graph: CanvasGraph = { items: [item("a", "spine", null, 0), item("x", "side", "a", 0),
      item("y", "side", "a", 1), item("z", "side", "x", 0)], links: [] };
    const bounds: Record<string, CanvasBounds> = { a: { width: 260, height: 90 },
      x: { width: 550, height: 100 }, y: { width: 300, height: 100 }, z: { width: 450, height: 400 } };
    const { positions } = layoutSpine(graph, bounds);
    for (const [id, a] of Object.entries(positions)) {
      for (const [other, b] of Object.entries(positions)) {
        if (id === other) continue;
        expect(a.x + bounds[id].width <= b.x || b.x + bounds[other].width <= a.x ||
          a.y + bounds[id].height <= b.y || b.y + bounds[other].height <= a.y).toBe(true);
      }
    }
    expect(positions.z.x).toBeGreaterThanOrEqual(positions.x.x + 622);
  });

  it("keeps topology stable across text/selection updates", () => {
    const graph: CanvasGraph = { items: [item("a", "spine", null, 0)], links: [] };
    const original = layoutSpine(graph, {});
    graph.items[0].summary = "A longer streaming answer";
    graph.items[0].selectionId = "another-message";
    expect(layoutSpine(graph, {})).toEqual(original);
  });

  it("handles empty and malformed cyclic layouts finitely", () => {
    expect(layoutSpine({ items: [], links: [] }, {}).positions).toEqual({});
    const graph: CanvasGraph = { items: [item("x", "side", "y", 0), item("y", "side", "x", 0)], links: [] };
    expect(Object.keys(layoutSpine(graph, {}).positions).sort()).toEqual(["x", "y"]);
  });
});
