/** Domain-neutral visual contracts; source messages/curricula remain authoritative. */
export interface CanvasItem {
  id: string;
  kind: "milestone" | "group" | "topic" | "conversation";
  title: string;
  summary?: string;
  /** Adapter-owned presentation text; does not change selection or layout. */
  metaLabel?: string;
  itemIds: string[];
  selectionId: string;
  lane: "spine" | "side";
  parentId: string | null;
  originId: string | null;
  order: number;
  /** Original conversation thread root, used for existing branch actions. */
  threadId?: string;
}

export interface CanvasLink {
  id: string;
  source: string;
  target: string;
  kind: "sequence" | "containment" | "prerequisite" | "alternative";
}

export interface CanvasGraph { items: CanvasItem[]; links: CanvasLink[] }
export interface CanvasBounds { width: number; height: number }
export interface CanvasPoint { x: number; y: number }
export interface CanvasLayout {
  version: "spine-v1";
  positions: Record<string, CanvasPoint>;
  viewport: { x: number; y: number; zoom: number } | null;
  topologyKey: string;
}
