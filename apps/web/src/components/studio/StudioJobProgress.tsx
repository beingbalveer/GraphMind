"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JobActivity } from "@/components/roadmap/JobActivity";
import type { GeneratorProfile } from "@/lib/generatorProfile";
import type { JobEventData, JobSnapshot } from "@/lib/roadmapTypes";
import { cn } from "@/lib/utils";

/** Server stage names → learner-facing phase labels (mirrors the job worker). */
export const STAGE_LABELS: Record<JobSnapshot["stage"], string> = {
  understand: "Understanding your goal",
  research: "Researching the path",
  compose: "Building your curriculum",
  personalize: "Planning your pace",
  validate: "Checking the roadmap",
  publish: "Preparing your workspace",
};

const ACTIVE_STATUSES: JobSnapshot["status"][] = [
  "queued",
  "running",
  "cancel_requested",
];

function heading(snapshot: JobSnapshot): string {
  switch (snapshot.status) {
    case "completed":
      return "Your roadmap is ready";
    case "failed":
      return "Generation needs attention";
    case "canceled":
      return "Generation canceled";
    case "awaiting_input":
      return "One preference needs your answer";
    case "cancel_requested":
      return "Stopping safely";
    default:
      return STAGE_LABELS[snapshot.stage];
  }
}

export interface StudioJobProgressProps {
  /** Latest authoritative snapshot; `null` only while the first read resolves. */
  job: JobSnapshot | null;
  /** Server-persisted activity events, ordered by sequence. */
  events: JobEventData[];
  connection: "connecting" | "live" | "polling" | "offline";
  error: Error | null;
  /** Immutable submitted profile retained while the job runs. */
  profile: GeneratorProfile | null;
  onCancel: () => Promise<unknown>;
  onRetry: () => Promise<unknown>;
  onStartOver: () => void;
  onOpenWorkspace?: () => void;
  className?: string;
}

/**
 * StudioJobProgress (LSI-022) — real, server-driven generation status.
 *
 * Every phase, summary, and step comes from the owned job API (`useRoadmapJob`
 * + the SSE feed). There is no local timer and no simulated completion: the
 * panel is a projection of the server snapshot and its persisted events.
 */
export function StudioJobProgress({
  job,
  events,
  connection,
  error,
  profile,
  onCancel,
  onRetry,
  onStartOver,
  onOpenWorkspace,
  className,
}: StudioJobProgressProps) {
  const active = Boolean(job && ACTIVE_STATUSES.includes(job.status));
  const card = "rounded-2xl border border-border-subtle bg-surface p-5";
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const runAction = async (run: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await run();
    } catch (failure) {
      setActionError(
        failure instanceof Error
          ? failure.message
          : "Could not complete this action.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      data-testid="studio-job-progress"
      aria-labelledby="studio-job-progress-title"
      aria-live="polite"
      className={cn("mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-10", className)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="info">Generating</Badge>
        {job && (
          <Badge variant="mono" data-testid="studio-job-phase">
            {STAGE_LABELS[job.stage]}
          </Badge>
        )}
      </div>

      <div className="mt-4 flex items-start gap-3">
        {job?.status === "completed" ? (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
        ) : job?.status === "failed" ? (
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
        ) : job?.status === "canceled" ? (
          <XCircle className="mt-0.5 size-5 shrink-0 text-foreground-muted" />
        ) : (
          <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-primary" />
        )}
        <div className="min-w-0">
          <h1 id="studio-job-progress-title" className="text-xl font-semibold">
            {job ? heading(job) : "Starting your roadmap"}
          </h1>
          <p className="mt-1 break-words text-sm leading-6 text-foreground-muted">
            {job?.error?.message ||
              job?.summary ||
              "Your generation is being saved. This page follows the server."}
          </p>
        </div>
      </div>

      {profile && (
        <div className={cn(card, "mt-6")} data-testid="studio-job-submitted-profile">
          <h2 className="text-sm font-semibold">Your saved request</h2>
          <p className="mt-2 break-words text-sm text-foreground">
            {profile.title || profile.goal}
          </p>
          <p className="mt-1 text-xs text-foreground-muted">
            {profile.hoursPerWeek && profile.durationWeeks
              ? `${profile.hoursPerWeek} hours/week · ${profile.durationWeeks} weeks`
              : "Pace not specified"}
          </p>
        </div>
      )}

      <div className={cn(card, "mt-4")}>
        <JobActivity events={events} active={active} />
      </div>

      {(connection === "offline" || error) && (
        <p role="status" className="mt-4 text-xs text-foreground-muted">
          Connection interrupted. Your generation stays saved on the server.
        </p>
      )}

      {actionError && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {actionError}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
        {job && (active || job.status === "awaiting_input") && (
          <Button
            type="button"
            variant="outline"
            disabled={busy || job.status === "cancel_requested"}
            onClick={() => void runAction(onCancel)}
          >
            Cancel generation
          </Button>
        )}
        {job &&
          (job.status === "canceled" || Boolean(job.error?.recoverable)) && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void runAction(onRetry)}
            >
              <RotateCcw className="size-4" />
              Retry generation
            </Button>
          )}
        {job && job.status === "completed" && onOpenWorkspace && (
          <Button type="button" onClick={onOpenWorkspace}>
            Open your roadmap
          </Button>
        )}
        {job && ["failed", "canceled", "completed"].includes(job.status) && (
          <Button type="button" variant="ghost" onClick={onStartOver}>
            Create another roadmap
          </Button>
        )}
      </div>
    </section>
  );
}
