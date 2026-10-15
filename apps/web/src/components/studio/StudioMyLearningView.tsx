"use client";

import React, { useState, useMemo } from "react";
import { ChevronRight, Search, AlertCircle, RefreshCw, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { WorkspaceItem } from "@/lib/workspaceApi";
import { cn } from "@/lib/utils";

export type LearningProgressFilter = "all" | "not-started" | "in-progress" | "completed";

export interface StudioMyLearningViewProps {
  workspaces: WorkspaceItem[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onOpen: (workspaceId: string) => void;
  onBrowse: () => void;
  className?: string;
}

/**
 * StudioMyLearningView — Authorized saved learning collection with search, filters, and authoritative progress.
 * Adheres strictly to AGENTS.md design tokens and rules:
 * - Uses SegmentedTabs, Input, Button, and Badge primitives.
 * - Displays separate identities for distinct personal copies.
 */
export function StudioMyLearningView({
  workspaces,
  isLoading = false,
  error = null,
  onRetry,
  onOpen,
  onBrowse,
  className,
}: StudioMyLearningViewProps) {
  const [query, setQuery] = useState("");
  const [progressFilter, setProgressFilter] = useState<LearningProgressFilter>("all");

  // Only consider workspaces that are learning curricula
  const learningWorkspaces = useMemo(() => {
    return workspaces.filter((w) => Boolean(w.curriculum));
  }, [workspaces]);

  const filteredWorkspaces = useMemo(() => {
    return learningWorkspaces.filter((ws) => {
      const curriculum = ws.curriculum;
      if (!curriculum) return false;

      // Text search match
      const titleMatch = (curriculum.title || ws.name || "").toLowerCase().includes(query.toLowerCase());
      const descMatch = (ws.description || "").toLowerCase().includes(query.toLowerCase());
      if (query.trim() && !titleMatch && !descMatch) {
        return false;
      }

      // Progress filter match
      const total = curriculum.totalTopics;
      const completed = curriculum.completedTopics;

      if (progressFilter === "completed") {
        return total > 0 && completed >= total;
      }
      if (progressFilter === "not-started") {
        return completed === 0;
      }
      if (progressFilter === "in-progress") {
        return completed > 0 && completed < total;
      }
      return true;
    });
  }, [learningWorkspaces, query, progressFilter]);

  return (
    <div
      data-testid="studio-my-learning-view"
      className={cn("mx-auto max-w-5xl px-6 py-10 md:px-10", className)}
    >
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">My learning</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          Your saved roadmaps and active curriculum copies with authoritative progress.
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          data-testid="studio-mylearning-error"
          className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/10 p-5 flex items-start justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-destructive">Failed to load learning collection</h2>
              <p className="mt-1 text-xs text-foreground-muted">{error}</p>
            </div>
          </div>
          {onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry} className="shrink-0">
              <RefreshCw className="size-3.5 mr-1.5" />
              Retry
            </Button>
          )}
        </div>
      )}

      {/* Controls: Search and Tabs */}
      <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="max-w-md w-full">
          <Input
            aria-label="Search My learning"
            placeholder="Search saved roadmaps"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            startIcon={<Search className="size-4" />}
          />
        </div>

        <SegmentedTabs
          ariaLabel="Filter My learning by progress"
          items={[
            { id: "all", label: "All" },
            { id: "not-started", label: "Not started" },
            { id: "in-progress", label: "In progress" },
            { id: "completed", label: "Completed" },
          ]}
          value={progressFilter}
          onChange={(val) => setProgressFilter(val as LearningProgressFilter)}
          size="sm"
        />
      </div>

      {/* Loading Skeletons */}
      {isLoading ? (
        <div data-testid="studio-mylearning-loading" className="mt-6 grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-56 rounded-2xl border border-border-subtle bg-surface animate-pulse p-5"
            >
              <div className="flex justify-between items-center mb-4">
                <div className="h-5 w-20 bg-muted rounded-md" />
                <div className="h-4 w-24 bg-muted rounded-md" />
              </div>
              <div className="h-6 w-3/4 bg-muted rounded-md mb-2" />
              <div className="h-4 w-full bg-muted rounded-md mb-4" />
              <div className="h-1.5 w-full bg-muted rounded-full mb-6" />
              <div className="h-9 w-28 bg-muted rounded-lg" />
            </div>
          ))}
        </div>
      ) : filteredWorkspaces.length > 0 ? (
        /* Roadmap Grid */
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {filteredWorkspaces.map((ws) => {
            const cur = ws.curriculum!;
            const total = cur.totalTopics;
            const completed = cur.completedTopics;
            const isComplete = total > 0 && completed >= total;
            const percent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
            const category = cur.sourceSnapshotRef ? "Snapshot" : cur.originJobId ? "Generated" : "Personal";

            return (
              <article
                key={ws.id}
                data-testid={`workspace-curriculum-card-${ws.id}`}
                className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-2xs">
                      {category}
                    </Badge>
                    <span className="text-xs text-foreground-muted font-medium">
                      {completed}/{total} complete
                    </span>
                  </div>

                  <h2 className="mt-4 text-base font-semibold tracking-tight">
                    {cur.title || ws.name}
                  </h2>
                  <p className="mt-2 text-sm text-foreground-muted line-clamp-2">
                    {ws.description || "Personal roadmap copy"}
                  </p>

                  <p className="mt-3 text-xs text-foreground-muted">
                    <span className="font-medium text-foreground">
                      {isComplete ? "Ready to review" : completed > 0 ? "In progress · " : "Not started · "}
                    </span>
                    {isComplete ? "All lessons completed" : `${total - completed} lessons remaining`}
                  </p>

                  {/* Progress bar */}
                  <div
                    className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
                    aria-label={`${percent}% complete`}
                    role="progressbar"
                    aria-valuenow={percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full bg-primary transition-all duration-300 rounded-full"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                <div className="mt-5 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpen(ws.id)}
                    className="gap-1"
                  >
                    Open course
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        /* Empty States */
        <div
          data-testid="studio-mylearning-empty"
          className="mt-6 rounded-2xl border border-border-subtle bg-surface p-8 text-center"
        >
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-foreground-muted mb-4">
            <BookOpen className="size-6" />
          </div>
          <h2 className="text-base font-medium">
            {query || progressFilter !== "all" ? "No matching roadmaps" : "Nothing saved yet"}
          </h2>
          <p className="mt-2 text-sm text-foreground-muted max-w-sm mx-auto">
            {query || progressFilter !== "all"
              ? "Try adjusting your search query or progress filter."
              : "Browse a sample roadmap or create a personal goal to start your learning journey."}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            {query || progressFilter !== "all" ? (
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setProgressFilter("all");
                }}
              >
                Clear search and filters
              </Button>
            ) : (
              <Button onClick={onBrowse}>
                Browse roadmaps
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
