"use client";

import React from "react";
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Compass,
  RefreshCw,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import type {
  PublicRoadmapLevel,
  PublicRoadmapSummary,
} from "@/lib/publicCatalogApi";
import { cn } from "@/lib/utils";

const LEVEL_ALL = "all" as const;
const CATEGORY_ALL = "all" as const;

const LEVEL_TABS: { id: string; label: string }[] = [
  { id: LEVEL_ALL, label: "All levels" },
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
];

const LEVEL_BADGE: Record<PublicRoadmapLevel, "success" | "info" | "warning"> = {
  beginner: "success",
  intermediate: "info",
  advanced: "warning",
};

const LEVEL_LABEL: Record<PublicRoadmapLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export interface StudioCatalogViewProps {
  items: PublicRoadmapSummary[];
  total: number;
  page: number;
  pageCount: number;
  query: string;
  category: string | null;
  level: PublicRoadmapLevel | null;
  categories: string[];
  isLoading?: boolean;
  error?: string | null;
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: string | null) => void;
  onLevelChange: (value: PublicRoadmapLevel | null) => void;
  onPageChange: (page: number) => void;
  onRetry?: () => void;
  onResetFilters?: () => void;
  onOpen: (slug: string) => void;
  className?: string;
}

/**
 * StudioCatalogView — the public, anonymous learning catalog (LSI-029).
 *
 * Purely presentational: every value is a prop and every interaction is a
 * callback, so the same view serves guest and signed-in visitors without ever
 * reading a private source. It follows the Learning Studio design language:
 * `@/components/ui` primitives, semantic tokens, `rounded-2xl` cards, and the
 * standard typography scale.
 */
export function StudioCatalogView({
  items,
  total,
  page,
  pageCount,
  query,
  category,
  level,
  categories,
  isLoading = false,
  error = null,
  onQueryChange,
  onCategoryChange,
  onLevelChange,
  onPageChange,
  onRetry,
  onResetFilters,
  onOpen,
  className,
}: StudioCatalogViewProps) {
  const hasFilters = Boolean(query.trim() || category || level);

  const categoryTabs = [
    { id: CATEGORY_ALL, label: "All topics" },
    ...categories.map((name) => ({ id: name, label: name })),
  ];

  return (
    <div
      data-testid="studio-catalog-view"
      className={cn("mx-auto max-w-6xl px-6 py-10 md:px-10", className)}
    >
      <div>
        <div className="mb-3 flex items-center gap-2 text-xs text-foreground-muted">
          <span className="size-2 rounded-full bg-success" />
          Published learning roadmaps
        </div>
        <h1 className="text-xl font-semibold">Browse the catalog</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground-muted">
          Explore curated, self-paced roadmaps. Every roadmap below is a published
          snapshot anyone can read — no account required.
        </p>
      </div>

      {error && (
        <div
          data-testid="studio-catalog-error"
          className="mt-6 flex items-start justify-between gap-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-5"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div>
              <h2 className="text-sm font-semibold text-destructive">
                Failed to load the catalog
              </h2>
              <p className="mt-1 text-xs text-foreground-muted">{error}</p>
            </div>
          </div>
          {onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry} className="shrink-0">
              <RefreshCw className="mr-1.5 size-3.5" />
              Retry
            </Button>
          )}
        </div>
      )}

      {/* Discovery controls: free-text search, level, and category facets. */}
      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="w-full max-w-md">
          <Input
            aria-label="Search public catalog"
            placeholder="Search roadmaps"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            startIcon={<Search className="size-4" />}
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SegmentedTabs
            ariaLabel="Filter catalog by level"
            items={LEVEL_TABS}
            value={level ?? LEVEL_ALL}
            onChange={(next) =>
              onLevelChange(next === LEVEL_ALL ? null : (next as PublicRoadmapLevel))
            }
            size="sm"
          />
          {categories.length > 0 && (
            <SegmentedTabs
              ariaLabel="Filter catalog by category"
              items={categoryTabs}
              value={category ?? CATEGORY_ALL}
              onChange={(next) =>
                onCategoryChange(next === CATEGORY_ALL ? null : next)
              }
              size="sm"
            />
          )}
        </div>
      </div>

      {isLoading ? (
        <div
          data-testid="studio-catalog-loading"
          className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-2xl border border-border-subtle bg-surface p-5"
            >
              <div className="mb-4 flex justify-between">
                <div className="h-5 w-20 rounded-md bg-muted" />
                <div className="h-4 w-16 rounded-md bg-muted" />
              </div>
              <div className="mb-2 h-6 w-3/4 rounded-md bg-muted" />
              <div className="mb-2 h-4 w-full rounded-md bg-muted" />
              <div className="mb-6 h-4 w-2/3 rounded-md bg-muted" />
              <div className="h-9 w-32 rounded-lg bg-muted" />
            </div>
          ))}
        </div>
      ) : items.length > 0 ? (
        <>
          <p className="mt-6 text-xs text-foreground-muted" aria-live="polite">
            {total} {total === 1 ? "roadmap" : "roadmaps"}
            {hasFilters ? " match your filters" : " published"}
          </p>
          <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((roadmap) => (
              <article
                key={roadmap.id}
                data-testid={`public-roadmap-card-${roadmap.slug}`}
                className="flex flex-col justify-between rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={LEVEL_BADGE[roadmap.level]}>
                      {LEVEL_LABEL[roadmap.level]}
                    </Badge>
                    <Badge variant="secondary" className="text-2xs">
                      {roadmap.category}
                    </Badge>
                  </div>

                  <h2 className="mt-4 text-base font-semibold tracking-tight">
                    {roadmap.title}
                  </h2>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-foreground-muted">
                    {roadmap.summary}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-foreground-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <BookOpen className="size-3.5" />
                      {roadmap.topicCount} {roadmap.topicCount === 1 ? "lesson" : "lessons"}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" />
                      {roadmap.estimatedWeeks} weeks
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="size-3.5" />
                      {roadmap.hoursPerWeek} h/week
                    </span>
                  </div>

                  {roadmap.tags.length > 0 && (
                    <ul className="mt-4 flex flex-wrap gap-1.5">
                      {roadmap.tags.slice(0, 4).map((tag) => (
                        <li key={tag}>
                          <Badge variant="outline" className="text-2xs font-normal">
                            {tag}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpen(roadmap.slug)}
                    className="gap-1"
                  >
                    Open roadmap
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </article>
            ))}
          </div>

          {pageCount > 1 && (
            <nav
              data-testid="studio-catalog-pagination"
              aria-label="Catalog pages"
              className="mt-8 flex items-center justify-center gap-3"
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
              >
                <ChevronLeft className="mr-1 size-3.5" />
                Previous
              </Button>
              <span className="text-xs text-foreground-muted">
                Page {page} of {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(page + 1)}
                disabled={page >= pageCount}
              >
                Next
                <ChevronRight className="ml-1 size-3.5" />
              </Button>
            </nav>
          )}
        </>
      ) : (
        <div
          data-testid={
            hasFilters ? "studio-catalog-no-results" : "studio-catalog-empty"
          }
          className="mt-6 rounded-2xl border border-border-subtle bg-surface p-8 text-center"
        >
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted text-foreground-muted">
            <Compass className="size-6" />
          </div>
          <h2 className="text-base font-medium">
            {hasFilters ? "No matching roadmaps" : "No roadmaps published yet"}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-foreground-muted">
            {hasFilters
              ? "Try a different search term or clear your filters to see the full catalog."
              : "Published learning roadmaps will appear here as soon as they are curated."}
          </p>
          {hasFilters && onResetFilters && (
            <div className="mt-5 flex justify-center">
              <Button variant="outline" onClick={onResetFilters}>
                Clear search and filters
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
