"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  answerRoadmapQuestion,
  cancelRoadmapJob,
  readRoadmapJob,
  retryRoadmapJob,
} from "@/lib/roadmapApi";
import type { JobEventData, JobSnapshot } from "@/lib/roadmapTypes";

export function shouldOpenCompletedRoadmap(input: {
  watchingJobId: string | null;
  completedJobId: string;
  isProgressOpen: boolean;
  currentPath: string;
  startPath: string;
}) {
  return (
    input.watchingJobId === input.completedJobId &&
    input.isProgressOpen &&
    input.currentPath === input.startPath
  );
}

export function useRoadmapJob(jobId: string | null) {
  const [job, setJob] = useState<JobSnapshot | null>(null);
  const [events, setEvents] = useState<JobEventData[]>([]);
  const [connection, setConnection] = useState<
    "connecting" | "live" | "polling" | "offline"
  >("connecting");
  const [error, setError] = useState<Error | null>(null);
  const activeJob = useRef(jobId);
  const reconnect = useRef<(snapshot: JobSnapshot) => void>(() => {});
  activeJob.current = jobId;
  useEffect(() => {
    setJob(null);
    setEvents([]);
    setError(null);
    if (!jobId) return;
    let disposed = false,
      terminal = false,
      cursor = 0;
    let latestSnapshotSequence = -1;
    let failures = 0;
    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const abort = new AbortController();
    const received = new Map<number, JobEventData>();
    const clearTimer = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    const refresh = async () => {
      try {
        const snapshot = await readRoadmapJob(jobId, abort.signal);
        if (disposed) return;
        if (snapshot.lastSequence < latestSnapshotSequence) return;
        latestSnapshotSequence = snapshot.lastSequence;
        failures = 0;
        setJob((previous) =>
          !previous || snapshot.lastSequence >= previous.lastSequence
            ? snapshot
            : previous,
        );
        setError(null);
        terminal = ["completed", "failed", "canceled"].includes(
          snapshot.status,
        );
        if (terminal) {
          clearTimer();
          source?.close();
        }
      } catch (failure) {
        if (disposed) return;
        failures += 1;
        setError(
          failure instanceof Error
            ? failure
            : new Error("Could not load generation status"),
        );
        setConnection("offline");
      }
    };
    const poll = () => {
      if (disposed || terminal) return;
      clearTimer();
      timer = setTimeout(
        async () => {
          await refresh();
          if (!disposed && !terminal) {
            if (navigator.onLine && failures === 0) connect();
            else poll();
          }
        },
        navigator.onLine && failures === 0 ? 3000 : 10000,
      );
    };
    const handleEvent = (message: MessageEvent<string>) => {
      if (disposed) return;
      try {
        const event = JSON.parse(message.data) as JobEventData;
        if (
          !Number.isSafeInteger(event.sequence) ||
          event.sequence < 1 ||
          typeof event.summary !== "string"
        )
          return;
        if (!received.has(event.sequence)) {
          received.set(event.sequence, event);
          while (received.has(cursor + 1)) cursor += 1;
          setEvents(
            [...received.values()].sort((a, b) => a.sequence - b.sequence),
          );
        }
        void refresh();
      } catch {
        /* Malformed transport data does not erase saved status or activity. */
      }
    };
    function connect() {
      if (disposed || terminal) return;
      clearTimer();
      source?.close();
      setConnection("connecting");
      if (typeof EventSource === "undefined") {
        setConnection("polling");
        poll();
        return;
      }
      const nextSource = new EventSource(
        `/api/v1/roadmap/jobs/${encodeURIComponent(jobId!)}/events?after=${cursor}`,
        { withCredentials: true },
      );
      source = nextSource;
      nextSource.onopen = () => {
        if (!disposed && source === nextSource) setConnection("live");
      };
      for (const name of ["job", "activity", "question", "completed", "failed"])
        nextSource.addEventListener(name, handleEvent as EventListener);
      nextSource.onerror = () => {
        if (source !== nextSource) return;
        nextSource.close();
        if (!disposed && !terminal) {
          setConnection(
            navigator.onLine && failures === 0 ? "polling" : "offline",
          );
          poll();
        }
      };
    }
    reconnect.current = (snapshot) => {
      if (!disposed) {
        latestSnapshotSequence = Math.max(
          latestSnapshotSequence,
          snapshot.lastSequence,
        );
        terminal = ["completed", "failed", "canceled"].includes(
          snapshot.status,
        );
        void refresh();
        if (!terminal) connect();
        else {
          clearTimer();
          source?.close();
        }
      }
    };
    const online = () => {
      if (!disposed && !terminal) {
        void refresh();
        connect();
      }
    };
    void refresh();
    connect();
    window.addEventListener("online", online);
    return () => {
      disposed = true;
      abort.abort();
      clearTimer();
      source?.close();
      window.removeEventListener("online", online);
    };
  }, [jobId]);
  const action = useCallback(
    async (run: (id: string) => Promise<JobSnapshot>) => {
      if (!jobId) return;
      const snapshot = await run(jobId);
      if (activeJob.current === jobId) {
        setJob(snapshot);
        reconnect.current(snapshot);
      }
      return snapshot;
    },
    [jobId],
  );
  return {
    job,
    events,
    connection,
    error,
    answer: (questionId: string, answer: string) =>
      action((id) => answerRoadmapQuestion(id, questionId, answer)),
    cancel: () => action(cancelRoadmapJob),
    retry: () => action(retryRoadmapJob),
  };
}
