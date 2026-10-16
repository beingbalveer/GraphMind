"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/apiClient";
import {
  listPublicRoadmaps,
  type PublicRoadmapLevel,
  type PublicRoadmapSummary,
} from "@/lib/publicCatalogApi";

/** Curated grid page size for the public catalog. */
export const PUBLIC_CATALOG_PAGE_SIZE = 12;
/** Debounce window applied to free-text search before it reaches the network. */
export const PUBLIC_CATALOG_SEARCH_DEBOUNCE_MS = 300;

export interface PublicCatalogOptions {
  /** Seed filters, e.g. from a shareable `/learn?query=…` deep link. */
  query?: string;
  category?: string | null;
  level?: PublicRoadmapLevel | null;
  pageSize?: number;
}

export interface PublicCatalogController {
  items: PublicRoadmapSummary[];
  total: number;
  page: number;
  pageCount: number;
  query: string;
  category: string | null;
  level: PublicRoadmapLevel | null;
  /** Categories discovered so far, accumulated so switching stays possible. */
  categories: string[];
  hasFilters: boolean;
  isLoading: boolean;
  error: string | null;
  setQuery: (value: string) => void;
  setCategory: (value: string | null) => void;
  setLevel: (value: PublicRoadmapLevel | null) => void;
  setPage: (value: number) => void;
  resetFilters: () => void;
  retry: () => void;
}

function catalogErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status >= 500) {
      return "The learning catalog is temporarily unavailable. Please try again.";
    }
    return err.detail || "Could not load the learning catalog.";
  }
  return "Could not load the learning catalog.";
}

/**
 * usePublicCatalog — anonymous catalog data layer for the public `/learn` page.
 *
 * Owns exactly one concern: fetching the published catalog. It aborts superseded
 * requests, debounces the free-text filter, resets to page 1 whenever a filter
 * changes, and surfaces a typed error with an explicit `retry()` so the view can
 * distinguish "nothing published" from "could not load". It never calls a
 * private endpoint.
 */
export function usePublicCatalog(
  options: PublicCatalogOptions = {},
): PublicCatalogController {
  const pageSize = options.pageSize ?? PUBLIC_CATALOG_PAGE_SIZE;
  const [query, setQueryValue] = useState(options.query ?? "");
  const [appliedQuery, setAppliedQuery] = useState(options.query ?? "");
  const [category, setCategoryValue] = useState<string | null>(
    options.category ?? null,
  );
  const [level, setLevelValue] = useState<PublicRoadmapLevel | null>(
    options.level ?? null,
  );
  const [page, setPageValue] = useState(1);
  const [items, setItems] = useState<PublicRoadmapSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<string[]>(() =>
    options.category ? [options.category] : [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Debounce the free-text filter and return to the first page on every change,
  // so typing never fires one request per keystroke or lands on an empty page.
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedQuery(query.trim());
      setPageValue(1);
    }, PUBLIC_CATALOG_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setIsLoading(true);
    setError(null);

    listPublicRoadmaps(
      {
        query: appliedQuery || undefined,
        category: category ?? undefined,
        level: level ?? undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      },
      controller.signal,
    )
      .then((data) => {
        if (!active) return;
        setItems(data.items);
        setTotal(data.total);
        setCategories((prev) => {
          const merged = new Set(prev);
          for (const item of data.items) merged.add(item.category);
          if (category) merged.add(category);
          return Array.from(merged).sort();
        });
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setIsLoading(false);
        setError(catalogErrorMessage(err));
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [appliedQuery, category, level, page, pageSize, reloadToken]);

  const setCategory = useCallback((value: string | null) => {
    setCategoryValue(value);
    setPageValue(1);
  }, []);

  const setLevel = useCallback((value: PublicRoadmapLevel | null) => {
    setLevelValue(value);
    setPageValue(1);
  }, []);

  const setPage = useCallback((value: number) => {
    setPageValue(Math.max(1, Math.floor(value)));
  }, []);

  const resetFilters = useCallback(() => {
    setQueryValue("");
    setAppliedQuery("");
    setCategoryValue(null);
    setLevelValue(null);
    setPageValue(1);
  }, []);

  const retry = useCallback(() => setReloadToken((token) => token + 1), []);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = Boolean(appliedQuery || category || level);

  return useMemo(
    () => ({
      items,
      total,
      page,
      pageCount,
      query,
      category,
      level,
      categories,
      hasFilters,
      isLoading,
      error,
      setQuery: setQueryValue,
      setCategory,
      setLevel,
      setPage,
      resetFilters,
      retry,
    }),
    [
      items,
      total,
      page,
      pageCount,
      query,
      category,
      level,
      categories,
      hasFilters,
      isLoading,
      error,
      setCategory,
      setLevel,
      setPage,
      resetFilters,
      retry,
    ],
  );
}
