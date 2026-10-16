/**
 * @/lib/studioGeneration.ts — Learning Studio owned-generation helpers (LSI-022).
 *
 * Pure, side-effect-free mapping used by the studio generation flow:
 * - `requestFingerprint` normalizes a mapped `RoadmapRequest` so a repeated
 *   submission reuses one idempotency key (duplicate submit → one job).
 * - `nextJobKeyState` implements that key-reuse rule across retries and edits.
 * - `completedRoadmapTarget` resolves the canonical navigation target from a
 *   completed *generation* job. Refinements/promotions resolve to proposals and
 *   are never auto-opened here; the workspace landing resolves the actual
 *   revision, protected canvas anchor, and saved profile from the server.
 */

import type { JobSnapshot, RoadmapRequest } from "./roadmapTypes";

/** Stable, order-independent fingerprint of a mapped generation request. */
export function requestFingerprint(request: RoadmapRequest): string {
  return JSON.stringify({
    title: request.title ?? null,
    prompt: request.prompt,
    level: request.level ?? null,
    background: request.background ?? null,
    duration: request.duration ?? null,
    hoursPerWeek: request.hoursPerWeek ?? null,
    outcome: request.outcome ?? null,
    knownSkills: request.knownSkills ?? [],
    referenceUrl: request.referenceUrl ?? null,
    sampleTemplateRef: request.sampleTemplateRef ?? null,
  });
}

/** Client-side identity of the single accepted generation submission. */
export interface JobKeyState {
  /** Fingerprint of the request the current `key` was minted for. */
  fingerprint: string | null;
  /** Idempotency key sent as `Idempotency-Key`; stable across duplicate submits. */
  key: string | null;
  /** Server job id once creation succeeded; reused by every later submission. */
  acceptedJobId: string | null;
}

export const EMPTY_JOB_KEY_STATE: JobKeyState = {
  fingerprint: null,
  key: null,
  acceptedJobId: null,
};

/**
 * Advance the idempotency state for a submission.
 *
 * - The same request keeps its key, so a duplicate submit or a retry after an
 *   uncertain failure resolves to the one server-side job.
 * - A deliberately changed request (before acceptance) mints a new key.
 * - Once a job is accepted, its id and key are retained.
 */
export function nextJobKeyState(
  state: JobKeyState,
  request: RoadmapRequest,
  generateKey: () => string,
): JobKeyState {
  const fingerprint = requestFingerprint(request);
  const changedBeforeAccept =
    state.acceptedJobId === null && state.fingerprint !== fingerprint;
  const key = changedBeforeAccept ? null : state.key;
  return {
    fingerprint,
    key: key ?? generateKey(),
    acceptedJobId: state.acceptedJobId,
  };
}

export interface CompletedRoadmapTarget {
  workspaceId: string;
  roadmapId: string;
  revisionId: string;
}

/**
 * Resolve the canonical navigation target for a completed generation job.
 *
 * Returns `null` until the job is a completed published *generation*; proposal
 * results (refinements/promotions) and non-terminal jobs never auto-open. The
 * returned ids are the actual server entities the pipeline committed.
 */
export function completedRoadmapTarget(
  job: JobSnapshot | null,
): CompletedRoadmapTarget | null {
  if (
    !job ||
    job.operation !== "generate" ||
    job.status !== "completed" ||
    !job.result ||
    job.result.kind !== "published"
  ) {
    return null;
  }
  return {
    workspaceId: job.result.workspaceId,
    roadmapId: job.result.roadmapId,
    revisionId: job.result.revisionId,
  };
}

/** Generation statuses that still represent an owned, resumable run. */
export const RESUMABLE_JOB_STATUSES: JobSnapshot["status"][] = [
  "queued",
  "running",
  "awaiting_input",
  "cancel_requested",
];

/**
 * Pick the owned generation job a returning learner should resume (LSI-024).
 *
 * Only an in-flight/awaiting *generation* is resumable: refinement/promotion
 * jobs belong to their workspace surfaces, and terminal jobs are history. The
 * server list is newest-first, so the first match is the most recent run.
 */
export function resumableJob(jobs: JobSnapshot[]): JobSnapshot | null {
  return (
    jobs.find(
      (job) =>
        job.operation === "generate" &&
        RESUMABLE_JOB_STATUSES.includes(job.status),
    ) ?? null
  );
}
