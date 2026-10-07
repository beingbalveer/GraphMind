"use client";

import { useMemo, useSyncExternalStore } from "react";
import { canvasSaveQueue } from "@/lib/canvas/layoutPersistence";
import type { CanvasKind } from "@/lib/canvasApi";

/** Subscribe to the per-chat queue; its final save outlives this component. */
export function useCanvasLayout(workspaceId?: string, chatId?: string, kind: CanvasKind = "conversation") {
  const queue = useMemo(() => canvasSaveQueue(workspaceId, chatId, kind), [workspaceId, chatId, kind]);
  const state = useSyncExternalStore(queue.subscribe, queue.snapshot, queue.serverSnapshot);
  return { layout: state.layout, setLayout: queue.setLayout, ready: state.ready,
    loadError: state.loadError, saveState: state.saveState, conflict: state.conflict,
    reload: queue.reload, retrySave: queue.retrySave };
}
