"use client";

import { useEffect, useState, useCallback, useRef } from "react";

export interface StoredReadingPosition {
  scrollRatio: number;
  scrollY: number;
  updatedAt: string;
}

const STORAGE_PREFIX = "graphmind:reading_pos:";

export function getReadingPositionKey(workspaceId: string, topicId: string): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(workspaceId)}:${encodeURIComponent(topicId)}`;
}

export function getReadingPosition(
  workspaceId: string,
  topicId: string
): StoredReadingPosition | null {
  if (typeof window === "undefined" || !workspaceId || !topicId) return null;
  try {
    const raw = window.localStorage.getItem(getReadingPositionKey(workspaceId, topicId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredReadingPosition;
    if (typeof parsed?.scrollRatio === "number" && !isNaN(parsed.scrollRatio)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveReadingPosition(
  workspaceId: string,
  topicId: string,
  position: { scrollRatio: number; scrollY: number }
): void {
  if (typeof window === "undefined" || !workspaceId || !topicId) return;
  try {
    const payload: StoredReadingPosition = {
      scrollRatio: Math.max(0, Math.min(1, position.scrollRatio)),
      scrollY: Math.max(0, position.scrollY),
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(
      getReadingPositionKey(workspaceId, topicId),
      JSON.stringify(payload)
    );
  } catch {
    // Storage quota or blocked
  }
}

export function clearReadingPosition(workspaceId: string, topicId: string): void {
  if (typeof window === "undefined" || !workspaceId || !topicId) return;
  try {
    window.localStorage.removeItem(getReadingPositionKey(workspaceId, topicId));
  } catch {
    // Ignore
  }
}

export function useReadingPosition(
  workspaceId: string,
  topicId: string,
  containerRef: React.RefObject<HTMLElement | null>
) {
  const [restored, setRestored] = useState(false);
  const [scrollRatio, setScrollRatio] = useState(0);
  const throttleTimer = useRef<NodeJS.Timeout | null>(null);

  // Restore position when topic changes or mounts
  useEffect(() => {
    setRestored(false);
    if (!workspaceId || !topicId) return;

    const stored = getReadingPosition(workspaceId, topicId);
    if (!stored || stored.scrollRatio <= 0.02) {
      setScrollRatio(0);
      return;
    }

    setScrollRatio(stored.scrollRatio);

    // Give DOM a frame to layout before scrolling
    const timer = setTimeout(() => {
      const el = containerRef.current;
      if (el) {
        const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
        const target = stored.scrollY > 0 && stored.scrollY <= maxScroll
          ? stored.scrollY
          : maxScroll * stored.scrollRatio;
        el.scrollTo({ top: target, behavior: "smooth" });
        setRestored(true);
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [workspaceId, topicId, containerRef]);

  // Track scroll and persist
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el || !workspaceId || !topicId) return;

    const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
    const ratio = maxScroll > 0 ? el.scrollTop / maxScroll : 0;
    setScrollRatio(ratio);

    if (throttleTimer.current) return;
    throttleTimer.current = setTimeout(() => {
      throttleTimer.current = null;
      if (containerRef.current) {
        const currentEl = containerRef.current;
        const currentMax = Math.max(0, currentEl.scrollHeight - currentEl.clientHeight);
        const currentRatio = currentMax > 0 ? currentEl.scrollTop / currentMax : 0;
        saveReadingPosition(workspaceId, topicId, {
          scrollRatio: currentRatio,
          scrollY: currentEl.scrollTop,
        });
      }
    }, 250);
  }, [workspaceId, topicId, containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
      if (throttleTimer.current) {
        clearTimeout(throttleTimer.current);
        throttleTimer.current = null;
      }
    };
  }, [containerRef, handleScroll]);

  const clear = useCallback(() => {
    clearReadingPosition(workspaceId, topicId);
    setScrollRatio(0);
    setRestored(false);
  }, [workspaceId, topicId]);

  return { restored, scrollRatio, clear };
}
