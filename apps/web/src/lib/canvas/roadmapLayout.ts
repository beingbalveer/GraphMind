import { canvasTopologyKey } from "./spineLayout";
import type {
  CanvasBounds,
  CanvasGraph,
  CanvasItem,
  CanvasLayout,
  CanvasPoint,
} from "./types";

const PREFIX = "roadmap-v2:";
const GAP = 12;

/** Compact three-column curriculum: a centered path and paired topic rows. */
export function layoutRoadmap(
  graph: CanvasGraph,
  measured: Record<string, CanvasBounds>,
): CanvasLayout {
  const ordered = [...graph.items].sort(
    (a, b) => a.order - b.order || a.id.localeCompare(b.id),
  );
  const size = (item: CanvasItem) =>
    measured[item.id] ?? {
      width: item.lane === "spine" ? 220 : 240,
      height: 64,
    };
  const spineWidth = Math.max(
    220,
    ...ordered.filter((i) => i.lane === "spine").map((i) => size(i).width),
  );
  const sideWidth = Math.max(
    240,
    ...ordered.filter((i) => i.lane === "side").map((i) => size(i).width),
  );
  const center = 40 + sideWidth + 64 + spineWidth / 2;
  const positions: Record<string, CanvasPoint> = {};
  let top = 40;
  for (const node of ordered.filter((i) => i.lane === "spine")) {
    const topics = ordered.filter(
      (i) => i.lane === "side" && i.parentId === node.id,
    );
    const rows: { left: CanvasItem; right?: CanvasItem; height: number }[] = [];
    for (let i = 0; i < topics.length; i += 2)
      rows.push({
        left: topics[i],
        right: topics[i + 1],
        height: Math.max(
          size(topics[i]).height,
          topics[i + 1] ? size(topics[i + 1]).height : 0,
        ),
      });
    const band = Math.max(
      size(node).height,
      rows.reduce((sum, r) => sum + r.height, 0) +
        Math.max(0, rows.length - 1) * GAP,
    );
    positions[node.id] = {
      x: center - size(node).width / 2,
      y: top + (band - size(node).height) / 2,
    };
    let y = top;
    for (const row of rows) {
      positions[row.left.id] = {
        x: center - spineWidth / 2 - 64 - size(row.left).width,
        y,
      };
      if (row.right)
        positions[row.right.id] = { x: center + spineWidth / 2 + 64, y };
      y += row.height + GAP;
    }
    top += band + 40;
  }
  // Defensive fallback for an incomplete projection; never lose a topic or recurse cycles.
  for (const item of ordered)
    if (!positions[item.id]) {
      positions[item.id] = { x: center - size(item).width / 2, y: top };
      top += size(item).height + 40;
    }
  return {
    version: "spine-v1",
    positions,
    viewport: null,
    topologyKey: PREFIX + canvasTopologyKey(graph),
  };
}

/** Reflow automatic placement on expansion; carry explicit drags as offsets. */
export function reconcileRoadmapPositions(
  current: CanvasLayout,
  generated: CanvasLayout,
): CanvasLayout {
  if (!current.topologyKey.startsWith(PREFIX)) return generated;
  try {
    const previous = JSON.parse(current.topologyKey.slice(PREFIX.length)) as {
      items: [
        string,
        CanvasItem["kind"],
        CanvasItem["lane"],
        string | null,
        string | null,
        number,
      ][];
      links: [string, string, string, CanvasGraph["links"][number]["kind"]][];
      manualOffsets?: Record<string, CanvasPoint>;
    };
    const priorGraph: CanvasGraph = {
      items: previous.items.map(
        ([id, kind, lane, parentId, originId, order]) => ({
          id,
          kind,
          lane,
          parentId,
          originId,
          order,
          title: id,
          itemIds: [id],
          selectionId: id,
        }),
      ),
      links: previous.links.map(([id, source, target, kind]) => ({
        id,
        source,
        target,
        kind,
      })),
    };
    const prior = layoutRoadmap(priorGraph, {}).positions;
    const offsets = { ...previous.manualOffsets };
    for (const [id, point] of Object.entries(prior)) {
      const saved = current.positions[id];
      if (!saved) continue;
      const delta = { x: saved.x - point.x, y: saved.y - point.y };
      if (Math.abs(delta.x) + Math.abs(delta.y) > 0.01) offsets[id] = delta;
      else delete offsets[id];
    }
    const positions = { ...current.positions, ...generated.positions };
    for (const [id, offset] of Object.entries(offsets)) {
      if (!Number.isFinite(offset.x) || !Number.isFinite(offset.y)) {
        delete offsets[id];
        continue;
      }
      const point = generated.positions[id];
      if (point)
        positions[id] = { x: point.x + offset.x, y: point.y + offset.y };
    }
    const topology = JSON.parse(generated.topologyKey.slice(PREFIX.length));
    if (Object.keys(offsets).length) topology.manualOffsets = offsets;
    return {
      ...generated,
      positions,
      viewport: current.viewport,
      topologyKey: PREFIX + JSON.stringify(topology),
    };
  } catch {
    return generated;
  }
}
