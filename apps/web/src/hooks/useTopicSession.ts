"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { readTopicSession } from "@/lib/roadmapApi";
import type { TopicSessionData } from "@/lib/roadmapTypes";
export function useTopicSession(
  workspaceId: string | null,
  sessionId: string | null,
) {
  const [state, setState] = useState<{
    id: string | null;
    session: TopicSessionData | null;
    error: string | null;
  }>({ id: null, session: null, error: null });
  const current = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    current.current?.abort();
    if (!workspaceId || !sessionId) return;
    const controller = new AbortController();
    current.current = controller;
    try {
      const session = await readTopicSession(
        workspaceId,
        sessionId,
        controller.signal,
      );
      if (!controller.signal.aborted)
        setState({ id: sessionId, session, error: null });
    } catch (error) {
      if (!controller.signal.aborted)
        setState((old) => ({
          id: sessionId,
          session: old.id === sessionId ? old.session : null,
          error:
            error instanceof Error
              ? error.message
              : "Could not load the lesson.",
        }));
    }
  }, [workspaceId, sessionId]);
  useEffect(() => {
    setState({ id: sessionId, session: null, error: null });
    void refresh();
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    return () => {
      current.current?.abort();
      window.removeEventListener("focus", focus);
    };
  }, [sessionId, refresh]);
  const session = state.id === sessionId ? state.session : null;
  useEffect(() => {
    if (session?.lessonStartState !== "started") return;
    const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
  }, [session?.lessonStartState, refresh]);
  const updateProgress = useCallback(
    (progress: NonNullable<TopicSessionData["progress"]>) =>
      setState((old) =>
        old.id === sessionId && old.session
          ? { ...old, session: { ...old.session, progress } }
          : old,
      ),
    [sessionId],
  );
  return {
    session,
    error: state.id === sessionId ? state.error : null,
    refresh,
    updateProgress,
  };
}
