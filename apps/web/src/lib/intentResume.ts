/**
 * @/lib/intentResume.ts — Execute one consumed guest intent after sign-in (LSI-032).
 *
 * The guest surfaces store a {@link PendingIntent} and route to sign-in; the
 * {@link AuthIntentResumer} consumes it once and calls {@link resumePendingIntent}.
 * The stored payload is treated as untrusted: the executor re-reads the published
 * snapshot (the source of truth), rejects a mismatched/invalid snapshot or a topic
 * that is no longer published, and only then performs the idempotent save-copy. A
 * forged or stale intent therefore can never apply partial private state.
 *
 * Nothing is ever taken on faith from the payload:
 * - the template id, slug, and snapshot version must match the current published
 *   snapshot, and the referenced topic must still exist in it;
 * - the private copy is produced by the server (owner authorized there);
 * - the guest's reading position is transferred to the copied topic's private
 *   reading-position key, so the private lesson resumes where the guest left off;
 * - a practice intent resumes the lesson without ever submitting an answer, and a
 *   tutor intent carries the selected quote as data — it is never auto-sent.
 */

import {
  announceLearningCollectionChanged,
  createSaveCopySession,
  performSaveRoadmapCopy,
  type EnrollmentDetail,
  type SaveCopySession,
} from "./enrollmentApi";
import {
  readPublicRoadmap,
  type PublicRoadmapDetail,
  type PublicTopicSummary,
} from "./publicSnapshotApi";
import { saveReadingPosition } from "./readingPosition";
import type { IntentKind, PendingIntent } from "./authIntent";
import {
  buildPublicCatalogUrl,
  buildPublicRoadmapUrl,
  buildWorkspaceUrl,
} from "./urls";

/** The generator's only production surface (no dedicated `/create` route exists). */
export const GENERATOR_DESTINATION = "/studio-preview";
/** Learner Home, used by a bare sign-in intent from the outer app. */
export const LEARNER_HOME_DESTINATION = "/";

export type ResumeStatus = "applied" | "skipped" | "failed";

export interface ResumeOutcome {
  kind: IntentKind;
  status: ResumeStatus;
  /** A real route the client should land on, whatever the status. */
  destination: string;
  enrollment: EnrollmentDetail | null;
  /** Private topic the guest's public topic was copied to, when one was mapped. */
  privateTopicId: string | null;
  /** Tutor passage carried from the guest selection; never auto-sent. */
  quote: string | null;
  readingRatio: number | null;
  /** Honest reason for a skipped/failed resume (null when applied). */
  message: string | null;
}

/** Injectable dependencies so the executor is unit-testable without a network. */
export interface ResumeDeps {
  readPublicRoadmap: typeof readPublicRoadmap;
  performSaveRoadmapCopy: typeof performSaveRoadmapCopy;
  createSaveCopySession: () => SaveCopySession;
  saveReadingPosition: typeof saveReadingPosition;
  announceLearningCollectionChanged: typeof announceLearningCollectionChanged;
}

const defaultDeps: ResumeDeps = {
  readPublicRoadmap,
  performSaveRoadmapCopy,
  createSaveCopySession,
  saveReadingPosition,
  announceLearningCollectionChanged,
};

const CONTENT_UNAVAILABLE = "This lesson is no longer available.";
const SNAPSHOT_CHANGED =
  "This roadmap was updated. Open it again to continue.";
const RESUME_FAILED = "We couldn't finish that. Please try again.";

/** Resolve the intent's topic against the current snapshot's public topics. */
function findPublicTopic(
  roadmap: PublicRoadmapDetail,
  topicId: string | undefined,
  topicSlug: string | undefined,
): PublicTopicSummary | null {
  for (const phase of roadmap.phases) {
    for (const topic of phase.topics) {
      if (topicId && topic.id === topicId) return topic;
      if (topicSlug && topic.slug === topicSlug) return topic;
    }
  }
  return null;
}

/**
 * Resume a consumed intent exactly once.
 *
 * Returns a {@link ResumeOutcome} describing what happened and where to land.
 * Never throws: a failure resolves to a `failed` outcome so the resumer can route
 * the learner somewhere honest. A skipped/failed intent performs no write.
 */
export async function resumePendingIntent(
  intent: PendingIntent,
  deps: ResumeDeps = defaultDeps,
): Promise<ResumeOutcome> {
  const base = {
    kind: intent.kind,
    enrollment: null as EnrollmentDetail | null,
    privateTopicId: null as string | null,
    quote: null as string | null,
    readingRatio: intent.readingRatio,
  };

  // Generator just opens the form; no snapshot or write is involved.
  if (intent.kind === "generator") {
    return {
      ...base,
      status: "applied",
      destination: GENERATOR_DESTINATION,
      message: null,
    };
  }

  // A bare sign-in (no snapshot context) opens learner Home.
  if (!intent.templateId || !intent.slug || !intent.snapshotVersion) {
    return {
      ...base,
      status: "applied",
      destination: LEARNER_HOME_DESTINATION,
      message: null,
    };
  }

  const slug = intent.slug;
  let roadmap: PublicRoadmapDetail;
  try {
    roadmap = await deps.readPublicRoadmap(slug);
  } catch {
    // Missing, stale, or unpublished content collapses to one neutral state.
    return {
      ...base,
      status: "skipped",
      destination: buildPublicCatalogUrl(),
      message: CONTENT_UNAVAILABLE,
    };
  }

  // The payload is untrusted: the current published snapshot is the authority.
  if (
    roadmap.id !== intent.templateId ||
    roadmap.snapshotVersion !== intent.snapshotVersion
  ) {
    return {
      ...base,
      status: "skipped",
      destination: buildPublicRoadmapUrl(slug),
      message: SNAPSHOT_CHANGED,
    };
  }

  const needsTopic =
    intent.kind === "complete" ||
    intent.kind === "practice" ||
    intent.kind === "tutor";
  const referencedTopic =
    needsTopic || intent.topicId || intent.topicSlug
      ? findPublicTopic(roadmap, intent.topicId, intent.topicSlug)
      : null;

  if (needsTopic && !referencedTopic) {
    return {
      ...base,
      status: "skipped",
      destination: buildPublicRoadmapUrl(slug),
      message: CONTENT_UNAVAILABLE,
    };
  }

  try {
    const outcome = await deps.performSaveRoadmapCopy(
      {
        templateId: roadmap.id,
        snapshotVersion: roadmap.snapshotVersion,
        title: intent.kind === "save" ? intent.title ?? roadmap.title : roadmap.title,
        publicTopicId: referencedTopic?.id ?? null,
      },
      deps.createSaveCopySession(),
    );

    // Carry the guest's reading position onto the copied topic so the private
    // lesson resumes where the guest left off (read by useReadingPosition).
    if (
      outcome.privateTopicId &&
      intent.readingRatio != null &&
      intent.readingRatio > 0
    ) {
      deps.saveReadingPosition(
        outcome.enrollment.workspaceId,
        outcome.privateTopicId,
        { scrollRatio: intent.readingRatio, scrollY: 0 },
      );
    }

    deps.announceLearningCollectionChanged();

    return {
      kind: intent.kind,
      status: "applied",
      destination: buildWorkspaceUrl(outcome.enrollment.workspaceId),
      enrollment: outcome.enrollment,
      privateTopicId: outcome.privateTopicId,
      quote: intent.kind === "tutor" ? intent.quote : null,
      readingRatio: intent.readingRatio,
      message: null,
    };
  } catch {
    return {
      ...base,
      status: "failed",
      destination: buildPublicRoadmapUrl(slug),
      message: RESUME_FAILED,
    };
  }
}
