"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/apiClient";
import { readRoadmap } from "@/lib/roadmapApi";
import type { CurriculumView } from "@/lib/roadmapTypes";
export function useRoadmap(workspaceId: string | null) {
  const [state, setState] = useState<{
    workspaceId: string | null;
    view: CurriculumView | null;
    loading: boolean;
    error: ApiError | null;
  }>({ workspaceId: null, view: null, loading: false, error: null });
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    request.current?.abort();
    if (!workspaceId) return;
    const controller = new AbortController();
    request.current = controller;
    setState((old) => ({
      workspaceId,
      view: old.workspaceId === workspaceId ? old.view : null,
      loading: true,
      error: null,
    }));
    try {
      const view = await readRoadmap(workspaceId, controller.signal);
      if (!controller.signal.aborted)
        setState({ workspaceId, view, loading: false, error: null });
    } catch (error) {
      if (controller.signal.aborted) return;
      const typed =
        error instanceof ApiError
          ? error
          : new ApiError(0, "Could not load your roadmap.");
      setState((old) => ({
        workspaceId,
        view: old.workspaceId === workspaceId ? old.view : null,
        loading: false,
        error: typed.code === "ROADMAP_NOT_FOUND" ? null : typed,
      }));
    }
  }, [workspaceId]);
  useEffect(() => {
    if (workspaceId) void refresh();
    else
      setState({ workspaceId: null, view: null, loading: false, error: null });
    return () => request.current?.abort();
  }, [workspaceId, refresh]);
  return {
    ...(state.workspaceId === workspaceId
      ? state
      : { view: null, loading: Boolean(workspaceId), error: null }),
    refresh,
  };
}
