"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { StudioGoalForm } from "@/components/studio/StudioGoalForm";
import { usePreferences } from "@/context/PreferencesContext";
import { StudioJobProgress } from "@/components/studio/StudioJobProgress";
import {
  shouldOpenCompletedRoadmap,
  useRoadmapJob,
} from "@/hooks/useRoadmapJob";
import { createRoadmapJob, listRoadmapJobs, startRoadmapJob } from "@/lib/roadmapApi";
import {
  EMPTY_JOB_KEY_STATE,
  completedRoadmapTarget,
  nextJobKeyState,
  resumableJob,
  type JobKeyState,
} from "@/lib/studioGeneration";
import type {
  GeneratorPreferences,
  GeneratorProfile,
} from "@/lib/generatorProfile";
import type { JobSnapshot, RoadmapRequest } from "@/lib/roadmapTypes";
import { buildWorkspaceUrl } from "@/lib/urls";

export interface StudioRoadmapGeneratorProps {
  /** Approved preference defaults seeding a blank goal form. */
  defaults?: Partial<GeneratorPreferences> | null;
  /** Override completion navigation (tests / embedding); defaults to canonical URL. */
  onCompleted?: (workspaceId: string, job: JobSnapshot) => void;
  className?: string;
}

/**
 * StudioRoadmapGenerator (LSI-022) — owned job creation, status, and result.
 *
 * Consumes the LSI-021 `StudioGoalForm` handoff (mapped `RoadmapRequest` +
 * immutable profile) and drives the existing owned job API:
 * 1. `createRoadmapJob` with a key that is stable across duplicate submits, so
 *    the same request resolves to exactly one job (`IDEMPOTENCY_KEY` reuse).
 * 2. `startRoadmapJob` to enqueue the durable worker.
 * 3. `useRoadmapJob` for the real server status/phases (SSE + polling), no timer.
 * 4. On a completed published generation, navigate to the canonical workspace
 *    URL via `buildWorkspaceUrl`, where the revision, protected canvas anchor,
 *    and saved profile resolve from the server.
 */
export function StudioRoadmapGenerator({
  defaults,
  onCompleted,
  className,
}: StudioRoadmapGeneratorProps) {
  const router = useRouter();
  const path = usePathname();
  // Persisted study-hours preference seeds a blank goal form (LSI-044).
  const { preferences: learnerPreferences } = usePreferences();
  const effectiveDefaults =
    defaults ?? { hoursPerWeek: learnerPreferences.defaultStudyHours };
  const [watchingId, setWatchingId] = useState<string | null>(null);
  const [submittedProfile, setSubmittedProfile] =
    useState<GeneratorProfile | null>(null);
  const keyState = useRef<JobKeyState>(EMPTY_JOB_KEY_STATE);
  const submitting = useRef(false);
  const pathRef = useRef(path);
  pathRef.current = path;
  const startPath = useRef(path);
  const openedResult = useRef<string | null>(null);
  const resumeChecked = useRef(false);
  const [resumedNotice, setResumedNotice] = useState(false);

  const { job, events, connection, error, cancel, retry, answer } =
    useRoadmapJob(watchingId);

  const target = completedRoadmapTarget(job);

  const openWorkspace = useCallback(() => {
    if (!target) return;
    if (onCompleted) onCompleted(target.workspaceId, job as JobSnapshot);
    else router.push(buildWorkspaceUrl(target.workspaceId));
  }, [target, onCompleted, router, job]);

  useEffect(() => {
    if (!job || !target || openedResult.current === job.id) return;
    // Only open while this flow is still watching the same job on the route it
    // started from; a stale completed job never yanks the learner elsewhere.
    if (
      !shouldOpenCompletedRoadmap({
        watchingJobId: watchingId,
        completedJobId: job.id,
        isProgressOpen: Boolean(watchingId),
        currentPath: path,
        startPath: startPath.current,
      })
    )
      return;
    openedResult.current = job.id;
    openWorkspace();
  }, [job, target, watchingId, path, openWorkspace]);

  // LSI-024: on a fresh mount, resume the learner's owned in-flight generation
  // so a refresh never loses the run. A resumed run never auto-navigates; the
  // learner opens the finished roadmap explicitly.
  useEffect(() => {
    if (resumeChecked.current) return;
    resumeChecked.current = true;
    const controller = new AbortController();
    void listRoadmapJobs(controller.signal)
      .then((jobs) => {
        if (controller.signal.aborted) return;
        const candidate = resumableJob(jobs);
        if (!candidate) return;
        openedResult.current = candidate.id;
        setResumedNotice(true);
        setWatchingId(candidate.id);
      })
      .catch(() => {
        /* A failed list never blocks starting a new roadmap. */
      });
    return () => controller.abort();
  }, []);

  const submit = async (request: RoadmapRequest, profile: GeneratorProfile) => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      // Reuse the same idempotency key for a repeated request; a changed request
      // (before acceptance) mints a new key. Duplicate submits therefore resolve
      // to the one job the server already accepted.
      keyState.current = nextJobKeyState(
        keyState.current,
        request,
        () => crypto.randomUUID(),
      );
      let jobId = keyState.current.acceptedJobId;
      if (!jobId) {
        const created = await createRoadmapJob(request, keyState.current.key!);
        jobId = created.id;
        keyState.current = { ...keyState.current, acceptedJobId: jobId };
      }
      // `start` is idempotent server-side; it enqueues exactly once.
      await startRoadmapJob(jobId);
      startPath.current = pathRef.current;
      setSubmittedProfile(profile);
      setWatchingId(jobId);
    } finally {
      submitting.current = false;
    }
  };

  const startOver = () => {
    keyState.current = EMPTY_JOB_KEY_STATE;
    openedResult.current = null;
    setResumedNotice(false);
    setWatchingId(null);
    setSubmittedProfile(null);
  };

  // LSI-024: reopen the goal form with the failed/canceled profile pre-filled.
  // A new run mints fresh idempotency state (the old terminal job is not reused).
  const editRequest = () => {
    keyState.current = EMPTY_JOB_KEY_STATE;
    openedResult.current = null;
    setResumedNotice(false);
    setWatchingId(null);
  };

  if (watchingId) {
    return (
      <>
        {resumedNotice && (
          <p
            role="status"
            className="mx-auto w-full max-w-3xl px-4 pt-6 text-xs text-foreground-muted sm:px-8"
          >
            Resumed your in-progress generation. It stays saved on the server.
          </p>
        )}
        <StudioJobProgress
          job={job}
          events={events}
          connection={connection}
          error={error}
          profile={submittedProfile}
          onCancel={cancel}
          onRetry={retry}
          onAnswer={answer}
          onEditRequest={submittedProfile ? editRequest : undefined}
          onStartOver={startOver}
          onOpenWorkspace={target ? openWorkspace : undefined}
          className={className}
        />
      </>
    );
  }

  return (
    <StudioGoalForm
      defaults={effectiveDefaults}
      initialProfile={submittedProfile ?? undefined}
      onSubmit={submit}
      className={className}
    />
  );
}
