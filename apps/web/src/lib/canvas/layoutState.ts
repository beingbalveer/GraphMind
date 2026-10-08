import type { CanvasBounds, CanvasLayout, CanvasPoint } from "./types";

/** Preserve manual placement, and find room for only newly introduced cards. */
export function reconcilePositions(
  current: CanvasLayout,
  generated: CanvasLayout,
  bounds: Record<string, CanvasBounds> = {},
): CanvasLayout {
  // Visibility changes (collapsed phases and timeline replay) are not deletions.
  // Retain hidden placement so expanding the same concept restores its position.
  const positions: Record<string, CanvasPoint> = { ...current.positions };
  const size = (id: string) => bounds[id] ?? { width: 300, height: 128 };
  for (const id of Object.keys(generated.positions)) {
    if (current.positions[id]) positions[id] = current.positions[id];
  }
  for (const [id, initial] of Object.entries(generated.positions)) {
    if (positions[id]) continue;
    const point = { ...initial };
    let overlapping: [string, CanvasPoint] | undefined;
    do {
      overlapping = Object.entries(positions).find(
        ([other, p]) =>
          other in generated.positions &&
          point.x < p.x + size(other).width + 16 &&
          point.x + size(id).width + 16 > p.x &&
          point.y < p.y + size(other).height + 16 &&
          point.y + size(id).height + 16 > p.y,
      );
      if (overlapping)
        point.y = overlapping[1].y + size(overlapping[0]).height + 16;
    } while (overlapping);
    positions[id] = point;
  }
  return { ...generated, viewport: current.viewport, positions };
}
