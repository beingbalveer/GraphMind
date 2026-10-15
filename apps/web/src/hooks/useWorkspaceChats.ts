"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listWorkspaceChats,
  renameWorkspaceChat,
  togglePinWorkspaceChat,
  type ChatItem,
} from "@/lib/workspaceApi";

export interface UseWorkspaceChatsResult {
  chats: ChatItem[];
  isLoading: boolean;
  /** Conversation-list load failure (distinct from an empty list). */
  loadError: string | null;
  /** Rename/pin failure surfaced next to the directory. */
  actionError: string | null;
  refresh: () => Promise<ChatItem[]>;
  renameChat: (chatId: string, title: string) => Promise<boolean>;
  togglePin: (chatId: string, pinned: boolean) => Promise<boolean>;
}

/**
 * useWorkspaceChats — Reuse the existing chat list/rename/pin endpoints for the
 * Learning Studio course directory.
 *
 * The list is always scoped to the authorized workspace; the server omits other
 * workspaces' rows and the protected roadmap anchor. Refreshes are stale-guarded
 * so a slower earlier response can never overwrite a newer workspace's list.
 */
export function useWorkspaceChats(
  workspaceId: string | null
): UseWorkspaceChatsResult {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const scopeRef = useRef<string | null>(workspaceId);

  const refresh = useCallback(async (): Promise<ChatItem[]> => {
    const target = scopeRef.current;
    if (!target) {
      setChats([]);
      setLoadError(null);
      return [];
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;

    setIsLoading(true);
    setLoadError(null);

    try {
      const list = await listWorkspaceChats(target, controller.signal);
      if (requestId !== requestIdRef.current || scopeRef.current !== target) {
        return [];
      }
      setChats(list);
      return list;
    } catch (err) {
      if (requestId !== requestIdRef.current || scopeRef.current !== target) {
        return [];
      }
      setLoadError(
        err instanceof Error
          ? err.message
          : "Could not load this course's conversations.",
      );
      return [];
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Reload whenever the workspace identity changes; abort stale requests.
  useEffect(() => {
    scopeRef.current = workspaceId;
    setActionError(null);

    if (!workspaceId) {
      abortRef.current?.abort();
      requestIdRef.current += 1;
      setChats([]);
      setLoadError(null);
      setIsLoading(false);
      return;
    }

    void refresh();

    return () => {
      abortRef.current?.abort();
    };
  }, [workspaceId, refresh]);

  const renameChat = useCallback(
    async (chatId: string, title: string): Promise<boolean> => {
      const target = scopeRef.current;
      const trimmed = title.trim();
      if (!target || !trimmed) return false;

      setActionError(null);
      const ok = await renameWorkspaceChat(target, chatId, trimmed);
      if (scopeRef.current !== target) return false;
      if (!ok) {
        setActionError("Could not rename this conversation. Please try again.");
        return false;
      }
      await refresh();
      return true;
    },
    [refresh],
  );

  const togglePin = useCallback(
    async (chatId: string, pinned: boolean): Promise<boolean> => {
      const target = scopeRef.current;
      if (!target) return false;

      setActionError(null);
      const ok = await togglePinWorkspaceChat(target, chatId, pinned);
      if (scopeRef.current !== target) return false;
      if (!ok) {
        setActionError(
          pinned
            ? "Could not pin this conversation. Please try again."
            : "Could not unpin this conversation. Please try again.",
        );
        return false;
      }
      await refresh();
      return true;
    },
    [refresh],
  );

  return {
    chats,
    isLoading,
    loadError,
    actionError,
    refresh,
    renameChat,
    togglePin,
  };
}
