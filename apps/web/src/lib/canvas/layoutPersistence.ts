import { ApiError } from "@/lib/apiClient";
import { readCanvasLayout, writeCanvasLayout, type CanvasKind } from "@/lib/canvasApi";
import type { CanvasLayout } from "./types";

interface Draft {
  layout: CanvasLayout | null; revision: number; ready: boolean;
  dirty: boolean; saving: boolean; conflict: boolean; loadError: string | null;
  saveState: "saved" | "saving" | "error";
}
const empty: Draft = { layout: null, revision: 0, ready: false, dirty: false,
  saving: false, conflict: false, loadError: null, saveState: "saved" };
const queues = new Map<string, CanvasSaveQueue>();
const signature = (layout: CanvasLayout | null) => layout && JSON.stringify({
  version: layout.version, topologyKey: layout.topologyKey,
  positions: Object.entries(layout.positions).sort(([a], [b]) => a.localeCompare(b))
    .map(([id, p]) => [id, p.x, p.y]),
  viewport: layout.viewport && [layout.viewport.x, layout.viewport.y, layout.viewport.zoom],
});

function cachedDraft(key: string): { layout: CanvasLayout; revision: number } | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    if (!value || !Number.isSafeInteger(value.revision) || value.revision < 0) return null;
    const layout = value.layout as CanvasLayout;
    if (layout?.version !== "spine-v1" || typeof layout.topologyKey !== "string" ||
        !layout.positions || Object.keys(layout.positions).length > 2000 ||
        Object.values(layout.positions).some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) ||
        (layout.viewport !== null && (!layout.viewport || !Number.isFinite(layout.viewport.x) ||
          !Number.isFinite(layout.viewport.y) || !Number.isFinite(layout.viewport.zoom) ||
          layout.viewport.zoom < 0.05 || layout.viewport.zoom > 4))) return null;
    return { layout, revision: value.revision };
  } catch { return null; }
}

/** Coordinates only: never cache conversation text, credentials or research data. */
class CanvasSaveQueue {
  private state: Draft = empty;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: Promise<void> | null = null;
  private loaded = false;
  private readGeneration = 0;
  private readonly cacheKey: string;
  constructor(private readonly key: string, private readonly workspaceId: string | undefined,
    private readonly chatId: string | undefined, private readonly kind: CanvasKind) {
    this.cacheKey = `graphmind:canvas-draft:${key}`;
  }
  snapshot = () => this.state;
  serverSnapshot = () => empty;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    if (!this.loaded) { this.loaded = true; void this.load(false); }
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) {
        this.cancelTimer();
        // Existing in-flight work continues with the newest draft afterward.
        if (this.state.saveState !== "error") void this.save();
        this.release();
      }
    };
  };
  private release() {
    if (!this.listeners.size && !this.pending && this.state.ready && queues.get(this.key) === this) queues.delete(this.key);
  }
  private cancelTimer() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
  private publish(state: Draft) {
    this.state = state;
    if (this.workspaceId && this.chatId) {
      try {
        if (state.dirty && state.layout) localStorage.setItem(this.cacheKey,
          JSON.stringify({ layout: state.layout, revision: state.revision }));
        else if (state.ready) localStorage.removeItem(this.cacheKey);
      } catch { /* A blocked/full browser store does not prevent the server save. */ }
    }
    this.listeners.forEach(listener => listener());
  }
  private async load(discard: boolean) {
    this.cancelTimer();
    if (this.pending) await this.pending;
    const id = ++this.readGeneration;
    if (discard) { try { localStorage.removeItem(this.cacheKey); } catch {} }
    this.publish(empty);
    if (!this.workspaceId || !this.chatId) { this.publish({ ...empty, ready: true }); return; }
    try {
      const stored = await readCanvasLayout(this.workspaceId, this.chatId, this.kind);
      if (id !== this.readGeneration) return;
      const cached = discard ? null : cachedDraft(this.cacheKey);
      const different = cached && signature(cached.layout) !== signature(stored.layout);
      const conflict = Boolean(different && cached.revision !== stored.revision);
      this.publish({ ...empty, ready: true, revision: different ? cached.revision : stored.revision,
        layout: different ? cached.layout : stored.layout?.version === "spine-v1" ? stored.layout : null,
        dirty: Boolean(different), conflict, saveState: conflict ? "error" : different ? "saving" : "saved" });
      this.schedule();
      this.release();
    } catch {
      if (id === this.readGeneration) this.publish({ ...empty, loadError: "Could not load your saved canvas." });
    }
  }
  reload = () => this.load(true);
  setLayout = (layout: CanvasLayout | ((previous: CanvasLayout | null) => CanvasLayout)) => {
    if (!this.state.ready) return;
    const next = typeof layout === "function" ? layout(this.state.layout) : layout;
    if (signature(next) === signature(this.state.layout)) return;
    this.publish({ ...this.state, layout: next, dirty: true,
      saveState: this.state.conflict || this.state.saveState === "error" ? "error" : "saving" });
    this.schedule();
  };
  private schedule() {
    this.cancelTimer();
    if (!this.state.dirty || this.pending || this.state.conflict || this.state.saveState === "error") return;
    if (!this.listeners.size) { void this.save(); return; }
    this.timer = setTimeout(() => { void this.save(); }, 500);
  }
  retrySave = () => { void this.save(); };
  private save(): Promise<void> {
    if (this.pending) return this.pending;
    const current = this.state;
    if (!current.ready || !current.dirty || current.conflict || !current.layout) return Promise.resolve();
    this.cancelTimer();
    if (!this.workspaceId || !this.chatId) {
      this.publish({ ...current, dirty: false, saveState: "saved" }); return Promise.resolve();
    }
    const sent = current.layout;
    this.publish({ ...current, saving: true, saveState: "saving" });
    this.pending = (async () => {
      try {
        const stored = await writeCanvasLayout(this.workspaceId!, this.chatId!, this.kind, current.revision, sent);
        const changed = signature(this.state.layout) !== signature(sent);
        this.publish({ ...this.state, revision: stored.revision, saving: false, dirty: Boolean(changed),
          saveState: changed ? "saving" : "saved" });
      } catch (error) {
        const conflict = error instanceof ApiError && error.status === 409;
        this.publish({ ...this.state, saving: false, conflict, saveState: "error" });
        if (conflict) await readCanvasLayout(this.workspaceId!, this.chatId!, this.kind).catch(() => undefined);
      }
    })().finally(() => {
      this.pending = null;
      this.schedule();
      this.release();
    });
    return this.pending;
  }
}

export function canvasSaveQueue(workspaceId: string | undefined, chatId: string | undefined, kind: CanvasKind) {
  const key = JSON.stringify([workspaceId, chatId, kind]);
  let queue = typeof window !== "undefined" ? queues.get(key) : undefined;
  if (!queue) {
    queue = new CanvasSaveQueue(key, workspaceId, chatId, kind);
    if (typeof window !== "undefined") queues.set(key, queue);
  }
  return queue;
}
