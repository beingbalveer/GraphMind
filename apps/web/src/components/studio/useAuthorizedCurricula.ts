"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { fetchWorkspaces, WorkspaceItem } from "@/lib/workspaceApi";
import { subscribeLearningCollectionChanged } from "@/lib/enrollmentApi";

export interface UseAuthorizedCurriculaResult {
  workspaces: WorkspaceItem[];
  learningWorkspaces: WorkspaceItem[];
  activeLearningWorkspace: WorkspaceItem | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * useAuthorizedCurricula — Fetches and manages authorized workspace collection summaries
 * with projected curriculum and progress data from the backend.
 */
export function useAuthorizedCurricula(
  initialWorkspaces?: WorkspaceItem[]
): UseAuthorizedCurriculaResult {
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>(initialWorkspaces || []);
  const [isLoading, setIsLoading] = useState(!initialWorkspaces);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const items = await fetchWorkspaces();
      setWorkspaces(items);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load learning collection";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialWorkspaces) {
      refresh();
    }
  }, [initialWorkspaces, refresh]);

  // A save elsewhere (LSI-031) announces a change; refresh so the new copy
  // appears in the collection without a page reload.
  useEffect(() => subscribeLearningCollectionChanged(() => void refresh()), [
    refresh,
  ]);

  const learningWorkspaces = useMemo(() => {
    return workspaces.filter((w) => Boolean(w.curriculum));
  }, [workspaces]);

  const activeLearningWorkspace = useMemo(() => {
    if (!learningWorkspaces.length) return null;
    return [...learningWorkspaces].sort((a, b) => {
      const timeA = new Date(a.updatedAt).getTime();
      const timeB = new Date(b.updatedAt).getTime();
      return timeB - timeA;
    })[0];
  }, [learningWorkspaces]);

  return {
    workspaces,
    learningWorkspaces,
    activeLearningWorkspace,
    isLoading,
    error,
    refresh,
  };
}
