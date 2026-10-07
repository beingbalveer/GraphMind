import type { CanvasBounds, CanvasGraph, CanvasItem, CanvasLayout, CanvasPoint } from "./types";

const ROW_GAP = 40;
const LANE_GAP = 72;
const CARD_GAP = 16;
const ordered = (a: CanvasItem, b: CanvasItem) => a.order - b.order || a.id.localeCompare(b.id);

export function canvasTopologyKey(graph: CanvasGraph): string {
  return JSON.stringify({
    items: [...graph.items].sort((a, b) => a.id.localeCompare(b.id))
      .map(({ id, kind, lane, parentId, originId, order }) => [id, kind, lane, parentId, originId, order]),
    links: [...graph.links].sort((a, b) => a.id.localeCompare(b.id))
      .map(({ id, source, target, kind }) => [id, source, target, kind]),
  });
}

/** Reserve complete subtree bands; card size is measured, never inferred from text. */
export function layoutSpine(graph: CanvasGraph, measured: Record<string, CanvasBounds>): CanvasLayout {
  const children = new Map<string, CanvasItem[]>();
  const sequence = new Set(graph.links.filter(link => link.kind === "sequence").map(link => `${link.source}->${link.target}`));
  const widths: number[] = [];
  const positions: Record<string, CanvasPoint> = {};
  const heights = new Map<string, number>();
  const size = (item: CanvasItem): CanvasBounds => {
    const supplied = measured[item.id];
    return {
      width: supplied && Number.isFinite(supplied.width) && supplied.width > 0 ? supplied.width : item.lane === "spine" ? 260 : 300,
      height: supplied && Number.isFinite(supplied.height) && supplied.height > 0 ? supplied.height : 128,
    };
  };
  for (const item of graph.items) {
    if (item.parentId && item.lane === "side") children.set(item.parentId, [...(children.get(item.parentId) ?? []), item]);
  }
  for (const list of children.values()) list.sort(ordered);
  const partitions = (item: CanvasItem) => {
    const list = children.get(item.id) ?? [];
    return {
      branches: list.filter(child => !sequence.has(`${item.id}->${child.id}`)),
      continuations: list.filter(child => sequence.has(`${item.id}->${child.id}`)),
    };
  };
  const depthVisited = new Set<string>();
  function measureLanes(item: CanvasItem, depth: number) {
    if (depthVisited.has(item.id)) return;
    depthVisited.add(item.id);
    widths[depth] = Math.max(widths[depth] ?? 0, size(item).width);
    const { branches, continuations } = partitions(item);
    branches.forEach(child => measureLanes(child, depth + 1));
    continuations.forEach(child => measureLanes(child, depth));
  }
  const spine = graph.items.filter(item => item.lane === "spine").sort(ordered);
  spine.forEach(item => measureLanes(item, 0));
  graph.items.forEach(item => measureLanes(item, 1));
  const visiting = new Set<string>();
  function subtreeHeight(item: CanvasItem): number {
    if (visiting.has(item.id)) return size(item).height;
    const cached = heights.get(item.id);
    if (cached !== undefined) return cached;
    visiting.add(item.id);
    const { branches, continuations } = partitions(item);
    const sideHeight = branches.reduce((total, child) => total + subtreeHeight(child), 0) + Math.max(0, branches.length - 1) * CARD_GAP;
    const band = Math.max(size(item).height, sideHeight);
    const height = band + continuations.reduce((total, child) => total + CARD_GAP + subtreeHeight(child), 0);
    visiting.delete(item.id);
    heights.set(item.id, height);
    return height;
  }
  function place(item: CanvasItem, depth: number, y: number) {
    if (positions[item.id]) return;
    const x = 40 + widths.slice(0, depth).reduce((total, width) => total + width + LANE_GAP, 0);
    positions[item.id] = { x, y };
    const { branches, continuations } = partitions(item);
    let sideY = y;
    for (const child of branches) { place(child, depth + 1, sideY); sideY += subtreeHeight(child) + CARD_GAP; }
    let nextY = y + Math.max(size(item).height, sideY - y - (branches.length ? CARD_GAP : 0));
    for (const child of continuations) { nextY += CARD_GAP; place(child, depth, nextY); nextY += subtreeHeight(child); }
  }
  let y = 40;
  for (const item of spine) { place(item, 0, y); y += subtreeHeight(item) + ROW_GAP; }
  for (const item of [...graph.items].sort(ordered)) {
    if (positions[item.id]) continue;
    place(item, 1, y);
    y += subtreeHeight(item) + ROW_GAP;
  }
  return { version: "spine-v1", positions, viewport: null, topologyKey: canvasTopologyKey(graph) };
}
