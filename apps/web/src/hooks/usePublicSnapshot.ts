"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/apiClient";
import {
  readPublicLesson,
  readPublicRoadmap,
  type PublicLessonDetail,
  type PublicRoadmapDetail,
} from "@/lib/publicSnapshotApi";

export interface PublicResourceState<T> {
  data: T | null;
  isLoading: boolean;
  /** The server's neutral "not available" (missing/stale/unpublished) state. */
  notFound: boolean;
  error: string | null;
  retry: () => void;
}

const GENERIC_ERROR = "We couldn't load this content. Please try again.";

function usePublicResource<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
  enabled: boolean,
): PublicResourceState<T> {
  const loadRef = useRef(load);
  loadRef.current = load;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      setData(null);
      setNotFound(false);
      setError(null);
      return;
    }
    const controller = new AbortController();
    let active = true;
    setIsLoading(true);
    setNotFound(false);
    setError(null);
    setData(null);

    loadRef
      .current(controller.signal)
      .then((value) => {
        if (!active) return;
        setData(value);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setIsLoading(false);
        // Missing, stale, and unpublished content all collapse to one neutral
        // 404; the guest surface shows an honest "not available" state.
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
          return;
        }
        setError(GENERIC_ERROR);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [key, reloadToken, enabled]);

  const retry = useCallback(() => setReloadToken((token) => token + 1), []);

  return { data, isLoading, notFound, error, retry };
}

/** Read one published public roadmap snapshot for a guest. */
export function usePublicRoadmap(slug: string): PublicResourceState<PublicRoadmapDetail> {
  return usePublicResource<PublicRoadmapDetail>(
    slug,
    (signal) => readPublicRoadmap(slug, signal),
    Boolean(slug),
  );
}

/** Read one published public lesson body for a guest. */
export function usePublicLesson(
  slug: string,
  topicSlug: string,
): PublicResourceState<PublicLessonDetail> {
  return usePublicResource<PublicLessonDetail>(
    `${slug}::${topicSlug}`,
    (signal) => readPublicLesson(slug, topicSlug, signal),
    Boolean(slug && topicSlug),
  );
}
