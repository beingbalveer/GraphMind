"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listTopicSessions,
  openTopicSession,
  readTopicSession,
} from "@/lib/roadmapApi";
import type {
  TopicSessionData,
  TopicSessionSummary,
} from "@/lib/roadmapTypes";

export interface UseTopicChatHistoryOptions {
  isArchived?: boolean;
  initialSessionId?: string | null;
}

export function useTopicChatHistory(
  workspaceId: string | null,
  topicId: string | null,
  options: UseTopicChatHistoryOptions = {},
) {
  const { isArchived = false, initialSessionId = null } = options;

  const [sessions, setSessions] = useState<TopicSessionSummary[]>([]);
  const [activeSession, setActiveSession] = useState<TopicSessionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const idempotencyKeysRef = useRef<Map<string, string>>(new Map());
  const requestScopeRef = useRef<string>("");

  const refreshHistory = useCallback(async () => {
    if (!workspaceId || !topicId) {
      setSessions([]);
      setHistoryError(null);
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setHistoryError(null);

    try {
      const response = await listTopicSessions(
        workspaceId,
        topicId,
        20,
        controller.signal,
      );
      if (!controller.signal.aborted) {
        setSessions(response.sessions);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setHistoryError(
          err instanceof Error
            ? err.message
            : "Could not load saved topic conversations.",
        );
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [workspaceId, topicId]);

  // Load history whenever workspaceId or topicId changes
  useEffect(() => {
    requestScopeRef.current = `${workspaceId}:${topicId}`;
    setActiveSession(null);
    setActionError(null);
    void refreshHistory();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [workspaceId, topicId, refreshHistory]);

  // Load initial session if requested and available
  useEffect(() => {
    if (!workspaceId || !initialSessionId) return;
    let cancelled = false;

    void readTopicSession(workspaceId, initialSessionId)
      .then((data) => {
        if (!cancelled) setActiveSession(data);
      })
      .catch(() => {
        // Silently tolerate if initial session could not be read
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, initialSessionId]);

  const openSession = useCallback(
    async (fresh = false): Promise<TopicSessionData | null> => {
      if (!workspaceId || !topicId) return null;
      if (fresh && isArchived) {
        setActionError("Cannot create a new session on an archived topic.");
        return null;
      }

      const scope = requestScopeRef.current;
      const keyName = `${topicId}:${fresh}`;

      let key = idempotencyKeysRef.current.get(keyName);
      if (!key) {
        key = crypto.randomUUID();
        idempotencyKeysRef.current.set(keyName, key);
      }

      setIsStarting(true);
      setActionError(null);

      try {
        const session = await openTopicSession(workspaceId, topicId, key, fresh);
        if (requestScopeRef.current !== scope) return null;

        // Fresh session succeeded: remove its key so future calls get a new UUID
        if (fresh) {
          idempotencyKeysRef.current.delete(keyName);
        }

        setActiveSession(session);

        // Deduplicate into sessions list
        setSessions((prev) => {
          if (prev.some((s) => s.id === session.id)) return prev;
          const newSummary: TopicSessionSummary = {
            id: session.id,
            chatId: session.chatId,
            topicId: session.topicId,
            title: session.topicTitle || "Lesson session",
            revisionId: session.revisionId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isPrimary: !fresh,
            lessonStartState: session.lessonStartState,
            archived: Boolean(session.archived),
          };
          return [newSummary, ...prev];
        });

        return session;
      } catch (err) {
        if (requestScopeRef.current !== scope) return null;
        setActionError(
          err instanceof Error
            ? err.message
            : "Could not open topic conversation. Please try again.",
        );
        return null;
      } finally {
        if (requestScopeRef.current === scope) {
          setIsStarting(false);
        }
      }
    },
    [workspaceId, topicId, isArchived],
  );

  const selectSession = useCallback(
    async (summary: TopicSessionSummary): Promise<void> => {
      if (!workspaceId) return;
      setActionError(null);

      try {
        const session = await readTopicSession(workspaceId, summary.id);
        setActiveSession(session);
      } catch (err) {
        setActionError(
          err instanceof Error
            ? err.message
            : "Could not switch to selected conversation.",
        );
      }
    },
    [workspaceId],
  );

  const clearActiveSession = useCallback(() => {
    setActiveSession(null);
    setActionError(null);
  }, []);

  return {
    sessions,
    activeSession,
    isLoading,
    isStarting,
    historyError,
    actionError,
    openSession,
    selectSession,
    refreshHistory,
    clearActiveSession,
  };
}
