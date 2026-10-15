"use client";

import React from "react";
import { ChevronRight, Sparkles, AlertCircle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkspaceItem } from "@/lib/workspaceApi";
import { cn } from "@/lib/utils";

export interface StudioHomeViewProps {
  workspaces: WorkspaceItem[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onResume: (workspaceId: string) => void;
  onBrowse: () => void;
  onCreate: () => void;
  displayName?: string;
  className?: string;
}

/**
 * StudioHomeView — Production learner entry point presenting authorized server curriculum summaries.
 * Aligns with AGENTS.md design tokens and rules:
 * - Uses @/components/ui/button and @/components/ui/badge primitives.
 * - Adheres to semantic colors, rounded-2xl cards, and responsive layouts.
 */
export function StudioHomeView({
  workspaces,
  isLoading = false,
  error = null,
  onRetry,
  onResume,
  onBrowse,
  onCreate,
  displayName,
  className,
}: StudioHomeViewProps) {
  const learningWorkspaces = workspaces.filter((w) => Boolean(w.curriculum));
  const activeWorkspace = learningWorkspaces.length > 0
    ? [...learningWorkspaces].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]
    : null;

  const curriculum = activeWorkspace?.curriculum;
  const done = curriculum?.completedTopics ?? 0;
  const count = curriculum?.totalTopics ?? 0;
  const isComplete = count > 0 && done >= count;
  const percent = count > 0 ? Math.min(100, Math.round((done / count) * 100)) : 0;

  return (
    <div
      data-testid="studio-home-view"
      className={cn("mx-auto max-w-5xl px-6 py-12 md:px-10", className)}
    >
      {/* Welcome Banner */}
      <div className="mb-9">
        <div className="mb-3 flex items-center gap-2 text-xs text-foreground-muted">
          <span className="size-2 rounded-full bg-success" />
          Your learning space
        </div>
        <h1 className="text-xl font-semibold">
          {displayName ? `Welcome back, ${displayName}.` : "Make room for a little learning."}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-foreground-muted">
          Pick up where you left off, explore curated learning roadmaps, or describe
          a personal goal to generate a tailored plan.
        </p>
      </div>

      {/* Error State */}
      {error && (
        <div
          data-testid="studio-home-error"
          className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/10 p-5 flex items-start justify-between gap-4"
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

      {/* Loading Skeletons */}
      {isLoading ? (
        <div data-testid="studio-home-loading" className="grid gap-4 lg:grid-cols-[1.3fr_0.8fr]">
          <div className="h-64 rounded-2xl border border-border-subtle bg-surface animate-pulse p-6">
            <div className="h-5 w-28 bg-muted rounded-md mb-4" />
            <div className="h-7 w-3/4 bg-muted rounded-md mb-3" />
            <div className="h-4 w-full bg-muted rounded-md mb-2" />
            <div className="h-4 w-2/3 bg-muted rounded-md mb-6" />
            <div className="h-2 w-full bg-muted rounded-full mb-6" />
            <div className="h-9 w-36 bg-muted rounded-lg" />
          </div>
          <div className="h-64 rounded-2xl border border-border-subtle bg-background-secondary animate-pulse p-6">
            <div className="h-6 w-40 bg-muted rounded-md mb-3" />
            <div className="h-4 w-full bg-muted rounded-md mb-2" />
            <div className="h-4 w-4/5 bg-muted rounded-md mb-6" />
            <div className="h-9 w-32 bg-muted rounded-lg" />
          </div>
        </div>
      ) : (
        /* Content Grid */
        <div className="grid gap-4 lg:grid-cols-[1.3fr_0.8fr]">
          {/* Main Active Course / Get Started Card */}
          <section className="rounded-2xl border border-border-subtle bg-surface p-6 shadow-xs flex flex-col justify-between">
            {activeWorkspace && curriculum ? (
              <div>
                <div className="flex items-center justify-between">
                  <Badge variant={isComplete ? "success" : "default"}>
                    {isComplete ? "PATH COMPLETE" : "IN PROGRESS"}
                  </Badge>
                  <span className="text-xs text-foreground-muted font-medium">
                    {done}/{count} lessons
                  </span>
                </div>
                <h2 className="mt-5 text-lg font-semibold tracking-tight">
                  {curriculum.title || activeWorkspace.name}
                </h2>
                <p className="mt-2 text-sm leading-6 text-foreground-muted line-clamp-3">
                  {activeWorkspace.description || "Active interactive learning curriculum."}
                </p>

                {/* Progress Bar */}
                <div
                  className="mt-6 h-1.5 overflow-hidden rounded-full bg-muted"
                  aria-label={`${percent}% completed`}
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

                <div className="mt-6 flex items-center gap-3">
                  <Button
                    onClick={() => onResume(activeWorkspace.id)}
                    className="gap-1.5"
                  >
                    {isComplete ? "Review lessons" : "Continue learning"}
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <Badge variant="secondary">A place to begin</Badge>
                <h2 className="mt-5 text-lg font-semibold tracking-tight">
                  Choose a roadmap for your next skill.
                </h2>
                <p className="mt-2 text-sm leading-6 text-foreground-muted">
                  Saved roadmaps and your lesson progress will appear here once started.
                </p>
                <Button className="mt-6" onClick={onBrowse}>
                  Browse sample roadmaps
                </Button>
              </div>
            )}
          </section>

          {/* Create Goal Action Card */}
          <section className="rounded-2xl border border-border-subtle bg-background-secondary p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="size-4 text-primary" />
                <h2 className="text-base font-semibold">Build a focused plan</h2>
              </div>
              <p className="mt-2 text-sm leading-6 text-foreground-muted">
                Describe your goal and pace to generate a personalized curriculum,
                tailored with bite-sized lessons and interactive practice.
              </p>
            </div>
            <div className="mt-6">
              <Button variant="outline" onClick={onCreate}>
                Create roadmap
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
