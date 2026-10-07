import { it, expect } from "vitest";
import { reconcilePositions } from "../layoutState";
import type { CanvasLayout } from "../types";

it("retains dragged positions and camera while a new message or group arrives", () => {
  const current: CanvasLayout = { version: "spine-v1", topologyKey: "a", viewport: { x: 20, y: 30, zoom: 0.8 },
    positions: { a: { x: 600, y: 900 } } };
  const generated: CanvasLayout = { ...current, positions: { a: { x: 0, y: 0 }, b: { x: 0, y: 120 } } };
  expect(reconcilePositions(current, generated)).toEqual({ ...generated, viewport: current.viewport,
    positions: { a: { x: 600, y: 900 }, b: { x: 0, y: 120 } } });
});

it("places new groups below manually moved cards instead of overlapping", () => {
  const current: CanvasLayout = { version: "spine-v1", topologyKey: "a", viewport: null,
    positions: { a: { x: 0, y: 120 } } };
  const generated = { ...current, positions: { a: { x: 0, y: 0 }, b: { x: 0, y: 120 } } };
  const layout = reconcilePositions(current, generated, { a: { width: 300, height: 200 } });
  expect(layout.positions.a).toEqual(current.positions.a);
  expect(layout.positions.b.y).toBeGreaterThanOrEqual(336);
});
