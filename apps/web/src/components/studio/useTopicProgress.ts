"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { setTopicProgress } from "@/lib/roadmapApi";
import type { TopicProgressData } from "@/lib/roadmapTypes";

export interface ProgressErrorState {
  topicId: string;
  message: string;
  targetStatus: TopicProgressData["status"];
}

export interface UseTopicProgressOptions {
  workspaceId: string;
  initialProgress?: Record<string, TopicProgressData>;
  onProgressChange?: (topicId: string, progress: TopicProgressData) => void;
}

export function useTopicProgress({
  workspaceId,
  initialProgress = {},
  onProgressChange,
}: UseTopicProgressOptions) {
  const [progressMap, setProgressMap] = useState<Record<string, TopicProgressData>>(initialProgress);
  const [pendingTopicId, setPendingTopicId] = useState<string | null>(null);
  const [error, setError] = useState<ProgressErrorState | null>(null);

  // Per-topic sequence counter to prevent rapid clicks from overwriting newer intent
  const seqMapRef = useRef<Record<string, number>>({});

  const isCompleted = useCallback(
    (topicId: string): boolean => {
      return progressMap[topicId]?.status === "completed";
    },
    [progressMap]
  );

  const isPending = useCallback(
    (topicId: string): boolean => {
      return pendingTopicId === topicId;
    },
    [pendingTopicId]
  );

  const toggleTopicProgress = useCallback(
    async (topicId: string): Promise<TopicProgressData | null> => {
      if (!workspaceId || !topicId) return null;

      const currentStatus = progressMap[topicId]?.status ?? "not_started";
      const targetStatus: TopicProgressData["status"] =
        currentStatus === "completed" ? "in_progress" : "completed";

      // Increment sequence for this topic
      const nextSeq = (seqMapRef.current[topicId] ?? 0) + 1;
      seqMapRef.current[topicId] = nextSeq;

      setPendingTopicId(topicId);
      setError((prev) => (prev?.topicId === topicId ? null : prev));

      // Optimistic update
      const previousState = progressMap[topicId];
      setProgressMap((prev) => ({
        ...prev,
        [topicId]: {
          topicId,
          status: targetStatus,
          completedAt: targetStatus === "completed" ? new Date().toISOString() : null,
        },
      }));

      try {
        const confirmed = await setTopicProgress(workspaceId, topicId, targetStatus);

        // Discard response if a newer intent was fired for this topic
        if (seqMapRef.current[topicId] !== nextSeq) {
          return null;
        }

        setProgressMap((prev) => ({
          ...prev,
          [topicId]: confirmed,
        }));
        onProgressChange?.(topicId, confirmed);
        setPendingTopicId(null);
        return confirmed;
      } catch (err) {
        // Discard error if a newer intent superseded this one
        if (seqMapRef.current[topicId] !== nextSeq) {
          return null;
        }

        // Revert optimistic update
        setProgressMap((prev) => ({
          ...prev,
          [topicId]: previousState ?? { topicId, status: "not_started", completedAt: null },
        }));

        setError({
          topicId,
          message:
            err instanceof Error ? err.message : "Failed to update lesson completion status",
          targetStatus,
        });
        setPendingTopicId(null);
        return null;
      }
    },
    [workspaceId, progressMap, onProgressChange]
  );

  const retry = useCallback(
    async (topicId?: string): Promise<void> => {
      const targetId = topicId ?? error?.topicId;
      if (!targetId) return;
      await toggleTopicProgress(targetId);
    },
    [error, toggleTopicProgress]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const completedTopicIds = useMemo(() => {
    return Object.values(progressMap)
      .filter((p) => p.status === "completed")
      .map((p) => p.topicId);
  }, [progressMap]);

  const completedCount = completedTopicIds.length;

  const calculateProgressPercent = useCallback(
    (totalTopics: number): number => {
      if (!totalTopics || totalTopics <= 0) return 0;
      return Math.round((completedCount / totalTopics) * 100);
    },
    [completedCount]
  );

  return {
    progressMap,
    setProgressMap,
    pendingTopicId,
    error,
    isCompleted,
    isPending,
    toggleTopicProgress,
    retry,
    clearError,
    completedTopicIds,
    completedCount,
    calculateProgressPercent,
  };
}
