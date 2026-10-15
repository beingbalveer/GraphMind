"use client";

import React, { useMemo, useState } from "react";
import { Check, ChevronRight, Clock3, ExternalLink, BookOpen, Network, AlertCircle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { RoadmapCanvas } from "@/components/roadmap/RoadmapCanvas";
import { StudioRoadmapEditing } from "./StudioRoadmapEditing";
import { CurriculumItemData, CurriculumView } from "@/lib/roadmapTypes";
import { cn } from "@/lib/utils";

export interface StudioCourseListViewProps {
  view?: CurriculumView | null;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onSelectTopic: (topicId: string) => void;
  mode?: "list" | "canvas";
  onModeChange?: (mode: "list" | "canvas") => void;
  /** Projects the current-revision view after an edit or restore across List and Canvas. */
  onSaved?: (view: CurriculumView) => void;
  /** Reloads the authoritative revision so a stale edit can recover safely. */
  onReload?: () => Promise<void>;
  className?: string;
}

interface PhaseWithTopics {
  phaseItem?: CurriculumItemData;
  topics: CurriculumItemData[];
}

/**
 * StudioCourseListView — Center-stage structured List / Canvas view of the private roadmap.
 * Adheres strictly to AGENTS.md design tokens and rules:
 * - Uses @/components/ui/button, @/components/ui/badge, and @/components/ui/segmented-tabs.
 * - Displays phases, lessons with completion status, outcomes, and verified source references.
 * - Reuses existing RoadmapCanvas for spatial graph view, projecting identical revision/topics.
 */
export function StudioCourseListView({
  view,
  isLoading = false,
  error = null,
  onRetry,
  onSelectTopic,
  mode,
  onModeChange,
  onSaved,
  onReload,
  className,
}: StudioCourseListViewProps) {
  const [localMode, setLocalMode] = useState<"list" | "canvas">("list");
  const currentMode = mode ?? localMode;

  const handleModeChange = (next: "list" | "canvas") => {
    setLocalMode(next);
    onModeChange?.(next);
  };
  const { phases, activeTopics, completedCount, percent } = useMemo(() => {
    if (!view) {
      return { phases: [], activeTopics: [], completedCount: 0, percent: 0 };
    }

    const items = view.candidate.items || [];
    const relations = view.candidate.relations || [];

    const phaseItems = items.filter((item) => item.kind === "phase");
    const topics = items.filter(
      (item) => item.kind === "topic" && item.participation !== "archived"
    );

    const topicToPhase = new Map<string, string>();
    for (const rel of relations) {
      if (rel.kind === "contains") {
        topicToPhase.set(rel.targetId, rel.sourceId);
      }
    }

    let phaseList: PhaseWithTopics[] = [];

    if (phaseItems.length > 0) {
      phaseList = phaseItems
        .sort((a, b) => a.order - b.order)
        .map((phase) => {
          const matched = topics
            .filter((t) => topicToPhase.get(t.id) === phase.id)
            .sort((a, b) => a.order - b.order);
          return { phaseItem: phase, topics: matched };
        })
        .filter((p) => p.topics.length > 0);

      const assignedIds = new Set(phaseList.flatMap((p) => p.topics.map((t) => t.id)));
      const unassigned = topics.filter((t) => !assignedIds.has(t.id));
      if (unassigned.length > 0) {
        phaseList.push({
          phaseItem: undefined,
          topics: unassigned.sort((a, b) => a.order - b.order),
        });
      }
    } else {
      phaseList = [
        {
          phaseItem: undefined,
          topics: topics.sort((a, b) => a.order - b.order),
        },
      ];
    }

    let done = 0;
    for (const t of topics) {
      if (view.progress[t.id]?.status === "completed") {
        done++;
      }
    }

    const pct = topics.length > 0 ? Math.min(100, Math.round((done / topics.length) * 100)) : 0;

    return {
      phases: phaseList,
      activeTopics: topics,
      completedCount: done,
      percent: pct,
    };
  }, [view]);

  // Loading State
  if (isLoading) {
    return (
      <div
        data-testid="studio-list-view-loading"
        className={cn("mx-auto max-w-5xl px-6 py-10 md:px-10", className)}
      >
        <div className="h-6 w-32 bg-muted rounded-md mb-4 animate-pulse" />
        <div className="h-9 w-2/3 bg-muted rounded-md mb-3 animate-pulse" />
        <div className="h-4 w-full bg-muted rounded-md mb-8 animate-pulse" />
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-muted/60 rounded-xl border border-border-subtle animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-muted/40 rounded-2xl border border-border-subtle animate-pulse" />
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div
        data-testid="studio-list-view-error"
        className={cn("mx-auto max-w-5xl px-6 py-10 md:px-10", className)}
      >
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-destructive">Failed to load roadmap outline</h2>
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
      </div>
    );
  }

  // No Roadmap Found (e.g. ordinary workspace)
  if (!view) {
    return (
      <div
        data-testid="studio-list-view-not-found"
        className={cn("mx-auto max-w-5xl px-6 py-12 md:px-10 text-center", className)}
      >
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-foreground-muted mb-4">
          <BookOpen className="size-6" />
        </div>
        <h2 className="text-base font-medium">No curriculum roadmap attached</h2>
        <p className="mt-2 text-sm text-foreground-muted max-w-sm mx-auto">
          This workspace is configured for ordinary brainstorming and chat conversations.
        </p>
      </div>
    );
  }

  if (currentMode === "canvas" && view) {
    return (
      <div
        data-testid="studio-course-canvas-view"
        className={cn("h-full w-full flex flex-col overflow-hidden bg-background", className)}
      >
        {/* Top Switcher Bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-background z-10 shrink-0">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">ROADMAP CANVAS</Badge>
            <span className="text-xs text-foreground-muted">
              Revision {view.revisionId.slice(0, 8)} · {activeTopics.length} lessons
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onSaved && (
              <StudioRoadmapEditing
                view={view}
                onSaved={onSaved}
                onReload={onReload}
              />
            )}
            <SegmentedTabs
              items={[
                { id: "list", label: "List", icon: BookOpen },
                { id: "canvas", label: "Canvas", icon: Network },
              ]}
              value="canvas"
              onChange={(m) => handleModeChange(m as "list" | "canvas")}
              size="sm"
              ariaLabel="Roadmap view switcher"
            />
          </div>
        </div>
        {/* Reused 2D Spatial Roadmap Canvas */}
        <div className="flex-1 relative min-h-0 min-w-0">
          <RoadmapCanvas view={view} onOpenTopic={onSelectTopic} />
        </div>
      </div>
    );
  }

  const durationStr = view.profile?.duration
    ? `${view.profile.duration.value} ${view.profile.duration.unit}`
    : `${Math.ceil((activeTopics.reduce((acc, t) => acc + (t.estimateMinutes || 30), 0)) / 60)} hours`;

  let runningTopicIndex = 0;

  return (
    <div
      data-testid="studio-course-list-view"
      className={cn("mx-auto max-w-5xl px-6 py-10 md:px-10", className)}
    >
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="secondary">CURRICULUM OUTLINE</Badge>
            <span className="text-xs text-foreground-muted">
              Revision {view.revisionId.slice(0, 8)}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {view.candidate.title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-foreground-muted">
            {view.candidate.outcome}
          </p>
        </div>
        <div className="shrink-0 self-start sm:self-auto pt-1">
          <div className="flex items-center gap-2">
            {onSaved && (
              <StudioRoadmapEditing
                view={view}
                onSaved={onSaved}
                onReload={onReload}
              />
            )}
            <SegmentedTabs
              items={[
                { id: "list", label: "List", icon: BookOpen },
                { id: "canvas", label: "Canvas", icon: Network },
              ]}
              value="list"
              onChange={(m) => handleModeChange(m as "list" | "canvas")}
              size="sm"
              ariaLabel="Roadmap view switcher"
            />
          </div>
        </div>
      </div>

      {/* Meta Bar */}
      <div className="mt-6 flex flex-wrap items-center gap-5 text-xs text-foreground-muted pb-6 border-b border-border">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <Clock3 className="size-3.5 text-foreground-muted" />
          {durationStr}
        </span>
        <span>{activeTopics.length} lessons</span>
        <span>
          {completedCount}/{activeTopics.length} complete ({percent}%)
        </span>
      </div>

      {/* Main Two-Column Layout */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_280px]">
        {/* Left Column: Phased Lesson Outline */}
        <section>
          <h2 className="text-base font-semibold text-foreground mb-4">
            Roadmap Lessons
          </h2>

          <div className="space-y-6">
            {phases.map((phaseGroup, phaseIdx) => (
              <div key={phaseGroup.phaseItem?.id || `phase-${phaseIdx}`}>
                {phaseGroup.phaseItem && (
                  <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                    {phaseGroup.phaseItem.title}
                  </h3>
                )}
                <div className="space-y-2">
                  {phaseGroup.topics.map((item) => {
                    runningTopicIndex++;
                    const indexStr = String(runningTopicIndex).padStart(2, "0");
                    const isCompleted = view.progress[item.id]?.status === "completed";

                    return (
                      <Button
                        key={item.id}
                        variant="ghost"
                        data-testid={`list-topic-button-${item.id}`}
                        onClick={() => onSelectTopic(item.id)}
                        className="h-auto w-full justify-start gap-3 rounded-xl border border-border-subtle bg-surface p-4 text-left hover:bg-surface-hover/80 transition-all duration-150"
                      >
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-medium",
                            isCompleted
                              ? "bg-success/15 text-success"
                              : "bg-background-secondary text-foreground-muted"
                          )}
                        >
                          {isCompleted ? (
                            <Check className="size-4" data-testid={`list-topic-check-${item.id}`} />
                          ) : (
                            indexStr
                          )}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block whitespace-normal text-sm font-medium text-foreground leading-snug">
                            {item.title}
                          </span>
                          <span className="mt-1 block text-xs text-foreground-muted line-clamp-1">
                            {item.estimateMinutes ? `${item.estimateMinutes} min · ` : ""}
                            {item.brief || item.objectives[0] || "Interactive lesson"}
                          </span>
                        </span>

                        <ChevronRight className="size-4 shrink-0 text-foreground-muted" />
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Right Sidebar: Outcomes, Prerequisites, References */}
        <aside className="space-y-5">
          {/* You will practice */}
          {view.candidate.assumptions && view.candidate.assumptions.length > 0 && (
            <section className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs">
              <h2 className="text-sm font-semibold text-foreground">You will practice</h2>
              <ul className="mt-3 space-y-2 text-xs leading-relaxed text-foreground-muted">
                {view.candidate.assumptions.map((x, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-primary font-bold">•</span>
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Before you begin */}
          {view.profile?.knownSkills && view.profile.knownSkills.length > 0 && (
            <section className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs">
              <h2 className="text-sm font-semibold text-foreground">Before you begin</h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {view.profile.knownSkills.map((skill, idx) => (
                  <Badge key={idx} variant="secondary" className="text-2xs">
                    {skill}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          {/* References */}
          {view.sources && view.sources.length > 0 && (
            <section className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs">
              <h2 className="text-sm font-semibold text-foreground">References</h2>
              <div className="mt-3 space-y-2.5">
                {view.sources.slice(0, 4).map((source) => (
                  <div key={source.id} className="text-xs">
                    {source.url ? (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-foreground hover:text-primary hover:underline flex items-center gap-1 leading-snug"
                      >
                        <span className="truncate">{source.title}</span>
                        <ExternalLink className="size-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="font-medium text-foreground">{source.title}</span>
                    )}
                    {source.locator && (
                      <p className="text-2xs text-foreground-muted mt-0.5 truncate">
                        {source.locator}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
