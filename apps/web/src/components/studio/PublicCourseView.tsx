"use client";

import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  Layers,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { RoadmapCanvas } from "@/components/roadmap/RoadmapCanvas";
import {
  projectPublicRoadmap,
  publicTopicSequence,
} from "@/lib/publicCurriculum";
import type { PublicRoadmapDetail } from "@/lib/publicSnapshotApi";
import { cn } from "@/lib/utils";

export type PublicCourseMode = "list" | "canvas";

/** Signed-in save-copy state projected into the view (LSI-031). */
export type PublicSaveStatus = "idle" | "pending" | "saved" | "error";

const LEVEL_BADGE: Record<
  PublicRoadmapDetail["level"],
  "success" | "info" | "warning"
> = {
  beginner: "success",
  intermediate: "info",
  advanced: "warning",
};

export interface PublicCourseViewProps {
  roadmap: PublicRoadmapDetail | null;
  isLoading?: boolean;
  /** Neutral "not available" (missing/stale/unpublished) state from LSI-027. */
  notFound?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onOpenTopic: (topicSlug: string) => void;
  /** Gated private action: sends a guest to sign in, never mutates snapshot data. */
  onRequireSignIn: () => void;
  /** Signed-in save-copy flow (LSI-031). Guests see only the sign-in gate. */
  isAuthenticated?: boolean;
  saveStatus?: PublicSaveStatus;
  saveError?: string | null;
  /** True when the latest save created the copy; false when it reused one. */
  savedCreated?: boolean;
  onSave?: () => void;
  onRetrySave?: () => void;
  onOpenSavedCopy?: () => void;
  mode?: PublicCourseMode;
  onModeChange?: (mode: PublicCourseMode) => void;
  className?: string;
}

/**
 * PublicCourseView — read-only guest view of one published roadmap snapshot
 * (LSI-030).
 *
 * Presents the frozen snapshot as an ordered List or the existing spatial
 * Canvas. Both modes project the same public ids, and neither reads nor writes
 * private state: `projectPublicRoadmap` yields a `canWrite: false` view, so the
 * canvas uses its local, in-memory layout only (no protected-layout request).
 * The single private affordance, saving the roadmap, is gated behind sign-in.
 */
export function PublicCourseView({
  roadmap,
  isLoading = false,
  notFound = false,
  error = null,
  onRetry,
  onOpenTopic,
  onRequireSignIn,
  isAuthenticated = false,
  saveStatus = "idle",
  saveError = null,
  savedCreated = false,
  onSave,
  onRetrySave,
  onOpenSavedCopy,
  mode,
  onModeChange,
  className,
}: PublicCourseViewProps) {
  const [localMode, setLocalMode] = useState<PublicCourseMode>("list");
  const currentMode = mode ?? localMode;

  const sequence = useMemo(
    () => (roadmap ? publicTopicSequence(roadmap) : []),
    [roadmap],
  );
  const view = useMemo(
    () => (roadmap ? projectPublicRoadmap(roadmap) : null),
    [roadmap],
  );
  const slugByTopicId = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of sequence) map.set(entry.topic.id, entry.topic.slug);
    return map;
  }, [sequence]);

  const handleModeChange = (next: PublicCourseMode) => {
    setLocalMode(next);
    onModeChange?.(next);
  };

  if (isLoading) {
    return (
      <div
        data-testid="public-course-loading"
        className={cn("mx-auto max-w-6xl px-6 py-10 md:px-10", className)}
      >
        <div className="h-8 w-2/3 animate-pulse rounded-md bg-muted" />
        <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded-md bg-muted" />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl border border-border-subtle bg-surface"
            />
          ))}
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div
        data-testid="public-course-not-found"
        className={cn("mx-auto max-w-2xl px-6 py-20 text-center md:px-10", className)}
      >
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted text-foreground-muted">
          <BookOpen className="size-6" />
        </div>
        <h1 className="text-lg font-semibold">This roadmap is not available</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-foreground-muted">
          It may have been unpublished. Browse the catalog to find another
          published roadmap.
        </p>
      </div>
    );
  }

  if (error || !roadmap) {
    return (
      <div
        data-testid="public-course-error"
        className={cn("mx-auto max-w-3xl px-6 py-16 md:px-10", className)}
      >
        <div className="flex items-start justify-between gap-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div>
              <h2 className="text-sm font-semibold text-destructive">
                Failed to load this roadmap
              </h2>
              <p className="mt-1 text-xs text-foreground-muted">
                {error ?? "This roadmap could not be loaded."}
              </p>
            </div>
          </div>
          {onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry} className="shrink-0">
              <RefreshCw className="mr-1.5 size-3.5" />
              Retry
            </Button>
          )}
        </div>
      </div>
    );
  }

  const phases = [...roadmap.phases].sort((a, b) => a.order - b.order);

  return (
    <div
      data-testid="public-course-view"
      className={cn("mx-auto max-w-6xl px-6 py-10 md:px-10", className)}
    >
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={LEVEL_BADGE[roadmap.level]}>
            {roadmap.level.charAt(0).toUpperCase() + roadmap.level.slice(1)}
          </Badge>
          <Badge variant="secondary">{roadmap.category}</Badge>
          <Badge variant="outline" className="font-normal">
            v{roadmap.snapshotVersion}
          </Badge>
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">
          {roadmap.title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground-muted">
          {roadmap.summary}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-foreground-muted">
          <span className="inline-flex items-center gap-1.5">
            <Layers className="size-3.5" />
            {phases.length} {phases.length === 1 ? "phase" : "phases"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <BookOpen className="size-3.5" />
            {sequence.length} {sequence.length === 1 ? "lesson" : "lessons"}
          </span>
          {view && view.validation.coreMinutes > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="size-3.5" />
              about {Math.max(1, Math.round(view.validation.coreMinutes / 60))} hours
            </span>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {isAuthenticated ? (
            saveStatus === "pending" ? (
              <Button disabled className="gap-1.5">
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </Button>
            ) : saveStatus === "saved" ? (
              <div
                data-testid="public-course-save-success"
                className="flex flex-wrap items-center gap-3"
              >
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                  <CheckCircle2 className="size-4" />
                  {savedCreated
                    ? "Saved to your learning"
                    : "Already in your learning"}
                </span>
                <Button variant="outline" onClick={onOpenSavedCopy} className="gap-1.5">
                  Open my copy
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            ) : saveStatus === "error" ? (
              <div
                data-testid="public-course-save-error"
                className="flex flex-wrap items-center gap-3"
              >
                <span className="inline-flex items-center gap-1.5 text-sm text-destructive">
                  <AlertCircle className="size-4" />
                  {saveError ?? "We couldn't save this roadmap."}
                </span>
                {onRetrySave && (
                  <Button variant="outline" onClick={onRetrySave} className="gap-1.5">
                    <RefreshCw className="size-3.5" />
                    Retry save
                  </Button>
                )}
              </div>
            ) : (
              <Button onClick={onSave} className="gap-1.5">
                <Sparkles className="size-4" />
                Add to my learning
              </Button>
            )
          ) : (
            <Button onClick={onRequireSignIn} className="gap-1.5">
              <Sparkles className="size-4" />
              Sign in to save this roadmap
            </Button>
          )}
          <span className="inline-flex items-center gap-1.5 text-xs text-foreground-muted">
            <ShieldCheck className="size-3.5" />
            {isAuthenticated
              ? "Saving adds a private copy. The published snapshot never changes."
              : "Anyone can read this published snapshot. No account required."}
          </span>
        </div>
      </header>

      {roadmap.outcomes.length > 0 && (
        <section className="mt-8 rounded-2xl border border-border-subtle bg-surface p-5">
          <h2 className="text-sm font-semibold">What you&apos;ll be able to do</h2>
          <ul className="mt-3 space-y-2">
            {roadmap.outcomes.map((outcome) => (
              <li key={outcome} className="flex items-start gap-2 text-sm text-foreground-muted">
                <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-primary" />
                {outcome}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8 flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold">Roadmap</h2>
        <SegmentedTabs
          ariaLabel="Roadmap view switcher"
          items={[
            { id: "list", label: "List", icon: BookOpen },
            { id: "canvas", label: "Canvas" },
          ]}
          value={currentMode}
          onChange={(next) => handleModeChange(next as PublicCourseMode)}
          size="sm"
        />
      </div>

      {currentMode === "canvas" && view ? (
        <div className="mt-4 h-[70vh] min-h-[420px] w-full overflow-hidden rounded-2xl border border-border-subtle bg-background-secondary">
          <RoadmapCanvas
            view={view}
            readOnly
            onOpenTopic={(topicId) => {
              const slug = slugByTopicId.get(topicId);
              if (slug) onOpenTopic(slug);
            }}
          />
        </div>
      ) : (
        <div data-testid="public-course-outline" className="mt-4 space-y-6">
          {phases.map((phase) => (
            <section
              key={phase.id}
              data-testid={`public-phase-${phase.id}`}
              className="rounded-2xl border border-border-subtle bg-surface p-5"
            >
              <h3 className="text-sm font-semibold">{phase.title}</h3>
              <ul className="mt-3 space-y-1">
                {[...phase.topics]
                  .sort((a, b) => a.order - b.order)
                  .map((topic) => (
                    <li key={topic.id}>
                      <button
                        type="button"
                        data-testid={`public-topic-${topic.slug}`}
                        onClick={() => onOpenTopic(topic.slug)}
                        className="group flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {topic.title}
                          </span>
                          {topic.brief && (
                            <span className="mt-0.5 block truncate text-xs text-foreground-muted">
                              {topic.brief}
                            </span>
                          )}
                        </span>
                        <span className="flex shrink-0 items-center gap-3 text-xs text-foreground-muted">
                          {topic.estimateMinutes != null && (
                            <span className="inline-flex items-center gap-1">
                              <Clock3 className="size-3.5" />
                              {topic.estimateMinutes}m
                            </span>
                          )}
                          <ChevronRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {roadmap.sources.length > 0 && (
        <section
          data-testid="public-course-sources"
          className="mt-8 rounded-2xl border border-border-subtle bg-surface p-5"
        >
          <h2 className="text-sm font-semibold">Verified sources</h2>
          <ul className="mt-3 space-y-2">
            {roadmap.sources.map((source) =>
              source.url ? (
                <li key={source.id}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    {source.title}
                    <ExternalLink className="size-3.5" />
                  </a>
                </li>
              ) : (
                <li key={source.id} className="text-sm text-foreground-muted">
                  {source.title}
                </li>
              ),
            )}
          </ul>
        </section>
      )}
    </div>
  );
}
