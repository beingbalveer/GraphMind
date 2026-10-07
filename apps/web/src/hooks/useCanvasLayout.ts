"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/apiClient";
import { readCanvasLayout, writeCanvasLayout, type CanvasKind } from "@/lib/canvasApi";
import type { CanvasLayout } from "@/lib/canvas/types";

type SaveState = "saved" | "saving" | "error";
interface Draft {
  layout: CanvasLayout | null; revision: number; ready: boolean;
  dirty: boolean; saving: boolean; conflict: boolean; loadError: string | null;
  saveState: SaveState;
}
const empty = (): Draft => ({ layout: null, revision: 0, ready: false,
  dirty: false, saving: false, conflict: false, loadError: null, saveState: "saved" });

/** Single-flight saves: the next draft always uses the last acknowledged revision. */
export function useCanvasLayout(workspaceId?: string, chatId?: string, kind: CanvasKind = "conversation") {
  const [state, setState] = useState<Draft>(empty);
  const draft = useRef(state);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelTimer = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const publish = useCallback((value: Draft) => { draft.current = value; setState(value); }, []);
  const reload = useCallback(async () => {
    cancelTimer();
    const id = ++generation.current;
    publish(empty());
    if (!workspaceId || !chatId) { publish({ ...empty(), ready: true }); return; }
    try {
      const stored = await readCanvasLayout(workspaceId, chatId, kind);
      if (id !== generation.current) return;
      publish({ ...empty(), ready: true, revision: stored.revision,
        layout: stored.layout?.version === "spine-v1" ? stored.layout : null });
    } catch {
      if (id === generation.current) publish({ ...empty(), loadError: "Could not load your saved canvas." });
    }
  }, [workspaceId, chatId, kind, cancelTimer, publish]);

  const save = useCallback(async () => {
    const current = draft.current;
    if (!current.ready || !current.dirty || current.saving || current.conflict || !current.layout) return;
    cancelTimer();
    if (!workspaceId || !chatId) { publish({ ...current, dirty: false, saveState: "saved" }); return; }
    const id = generation.current;
    const sent = current.layout;
    publish({ ...current, saving: true, saveState: "saving" });
    try {
      const stored = await writeCanvasLayout(workspaceId, chatId, kind, current.revision, sent);
      if (id !== generation.current) return;
      const changed = draft.current.layout !== sent;
      publish({ ...draft.current, revision: stored.revision, saving: false, dirty: changed,
        saveState: changed ? "saving" : "saved" });
    } catch (error) {
      if (id !== generation.current) return;
      const conflict = error instanceof ApiError && error.status === 409;
      publish({ ...draft.current, saving: false, conflict, saveState: "error" });
      if (conflict) {
        // Inspect the remote revision without replacing the unsaved local draft.
        await readCanvasLayout(workspaceId, chatId, kind).catch(() => undefined);
      }
    }
  }, [workspaceId, chatId, kind, cancelTimer, publish]);

  useEffect(() => {
    void reload();
    return () => { generation.current++; cancelTimer(); };
  }, [reload, cancelTimer]);
  useEffect(() => {
    if (state.ready && state.dirty && !state.saving && !state.conflict && state.saveState !== "error") {
      timer.current = setTimeout(() => { void save(); }, 500);
    }
    return cancelTimer;
  }, [state, save, cancelTimer]);

  const setLayout = useCallback((layout: CanvasLayout | ((previous: CanvasLayout | null) => CanvasLayout)) => {
    const current = draft.current;
    if (!current.ready) return;
    const next = typeof layout === "function" ? layout(current.layout) : layout;
    if (JSON.stringify(next) === JSON.stringify(current.layout)) return;
    publish({ ...current, layout: next, dirty: true,
      saveState: current.conflict || current.saveState === "error" ? "error" : "saving" });
  }, [publish]);
  return { layout: state.layout, setLayout, ready: state.ready, loadError: state.loadError,
    saveState: state.saveState, conflict: state.conflict, reload,
    retrySave: () => { void save(); } };
}
