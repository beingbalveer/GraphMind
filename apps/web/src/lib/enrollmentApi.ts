/**
 * @/lib/enrollmentApi.ts — Signed-in save-copy boundary (LSI-031).
 *
 * The guest surfaces (LSI-030) can only read public snapshots. Saving one into
 * a learner's collection is a private, authorized operation against the LSI-028
 * route `POST /workspaces/{workspaceId}/learning-roadmaps`. This module owns that
 * contract plus the small, pure helpers the save flow needs:
 *
 * - `sourceSnapshotRef` — the frozen `template_id:snapshot_version` identity that
 *   both the client and the server use to recognize an already-saved copy.
 * - `findSavedWorkspace` — locate the workspace that already hosts a given
 *   snapshot so a duplicate save reuses the existing copy instead of creating a
 *   second one.
 * - `mapPublicTopicToPrivate` — translate the public topic the guest was reading
 *   into the copy's private topic id via the durable `topic_map`, so the private
 *   course resumes the same lesson.
 *
 * A successful save also announces a collection change so any mounted learning
 * collection (see `useAuthorizedCurricula`) refreshes without a global store.
 */

import { apiFetch } from "./apiClient";
import {
  createWorkspace,
  listWorkspaces,
  type WorkspaceItem,
} from "./workspaceApi";

export interface SaveRoadmapCopyRequest {
  templateId: string;
  snapshotVersion: string;
  customTitle?: string | null;
}

/** One durable public-topic → private-topic mapping held by a saved copy. */
export interface EnrollmentTopicMap {
  publicTopicId: string;
  privateTopicId: string;
}

/** The private identity of a saved copy, returned on create and on reuse. */
export interface EnrollmentDetail {
  roadmapId: string;
  workspaceId: string;
  revisionId: string;
  sourceSnapshotRef: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  topicProgress: Record<string, unknown>;
  topicMap: EnrollmentTopicMap[];
}

/** Frozen snapshot identity shared by the client and the save-copy service. */
export const sourceSnapshotRef = (
  templateId: string,
  snapshotVersion: string,
): string => `${templateId}:${snapshotVersion}`;

/**
 * Find the workspace that already hosts the given published snapshot, if any.
 *
 * `WorkspaceItem.curriculum.sourceSnapshotRef` carries `{templateId}:{version}`
 * for a saved copy, so re-saving the same snapshot reuses that workspace (the
 * server then returns the existing copy) instead of creating a second one.
 */
export function findSavedWorkspace(
  workspaces: WorkspaceItem[],
  templateId: string,
  snapshotVersion: string,
): WorkspaceItem | null {
  const ref = sourceSnapshotRef(templateId, snapshotVersion);
  return (
    workspaces.find(
      (workspace) => workspace.curriculum?.sourceSnapshotRef === ref,
    ) ?? null
  );
}

/** Resolve the private topic id a guest's public topic was copied to. */
export function mapPublicTopicToPrivate(
  enrollment: EnrollmentDetail,
  publicTopicId: string,
): string | null {
  const match = enrollment.topicMap.find(
    (entry) => entry.publicTopicId === publicTopicId,
  );
  return match?.privateTopicId ?? null;
}

/** Idempotently create (or reuse) a private copy of a published snapshot. */
export function saveRoadmapCopy(
  workspaceId: string,
  request: SaveRoadmapCopyRequest,
  idempotencyKey: string,
): Promise<EnrollmentDetail> {
  return apiFetch<EnrollmentDetail>(
    `/workspaces/${encodeURIComponent(workspaceId)}/learning-roadmaps`,
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(request),
    },
  );
}

// ---------------------------------------------------------------------------
// Shared save-copy flow (used by the save hook and the LSI-032 intent resume)
// ---------------------------------------------------------------------------

export interface SaveCopyInput {
  templateId: string;
  snapshotVersion: string;
  /** Title for the new private copy and its workspace. */
  title?: string | null;
  /** Public topic the guest was reading, mapped onto the private copy. */
  publicTopicId?: string | null;
}

/** Per-flow state: one idempotency key and created workspace per snapshot. */
export interface SaveCopySession {
  keys: Map<string, string>;
  workspaces: Map<string, string>;
}

export interface SaveCopyOutcome {
  enrollment: EnrollmentDetail;
  /** True when this save created the copy; false when it reused an existing one. */
  created: boolean;
  /** Private id the public topic was copied to, when one was mapped. */
  privateTopicId: string | null;
}

/** Injectable dependencies so the flow is unit-testable without a network. */
export interface SaveCopyDeps {
  listWorkspaces: (signal?: AbortSignal) => Promise<WorkspaceItem[]>;
  createWorkspace: (name: string, description?: string) => Promise<WorkspaceItem>;
  saveRoadmapCopy: typeof saveRoadmapCopy;
}

export const createSaveCopySession = (): SaveCopySession => ({
  keys: new Map(),
  workspaces: new Map(),
});

const defaultSaveCopyDeps: SaveCopyDeps = {
  listWorkspaces,
  createWorkspace,
  saveRoadmapCopy,
};

/** A UUID `Idempotency-Key`; the save route requires a UUID header. */
function nextIdempotencyKey(): string {
  const cryptoObj = typeof crypto !== "undefined" ? crypto : undefined;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

/**
 * Create (or reuse) a private copy of a published snapshot.
 *
 * Reuses the workspace that already hosts the snapshot (the server then returns
 * the existing copy), otherwise creates a fresh, empty workspace. A workspace
 * created for the snapshot is remembered in the session so a retry never leaves
 * an orphan workspace. One idempotency key is kept per `template:version` so a
 * retry replays the same request.
 */
export async function performSaveRoadmapCopy(
  input: SaveCopyInput,
  session: SaveCopySession,
  deps: SaveCopyDeps = defaultSaveCopyDeps,
): Promise<SaveCopyOutcome> {
  const ref = sourceSnapshotRef(input.templateId, input.snapshotVersion);
  let idempotencyKey = session.keys.get(ref);
  if (!idempotencyKey) {
    idempotencyKey = nextIdempotencyKey();
    session.keys.set(ref, idempotencyKey);
  }

  const workspaces = await deps.listWorkspaces();
  const existing = findSavedWorkspace(
    workspaces,
    input.templateId,
    input.snapshotVersion,
  );

  let workspaceId: string;
  if (existing) {
    workspaceId = existing.id;
  } else {
    const tracked = session.workspaces.get(ref);
    if (tracked) {
      workspaceId = tracked;
    } else {
      const name =
        input.title?.trim() || input.templateId.trim() || "My learning";
      const workspace = await deps.createWorkspace(
        name,
        "Saved from the public learning catalog.",
      );
      workspaceId = workspace.id;
      session.workspaces.set(ref, workspaceId);
    }
  }

  const enrollment = await deps.saveRoadmapCopy(
    workspaceId,
    {
      templateId: input.templateId,
      snapshotVersion: input.snapshotVersion,
      customTitle: input.title ?? null,
    },
    idempotencyKey,
  );

  return {
    enrollment,
    created: !existing,
    privateTopicId: input.publicTopicId
      ? mapPublicTopicToPrivate(enrollment, input.publicTopicId)
      : null,
  };
}

export const LEARNING_COLLECTION_CHANGED_EVENT =
  "graphmind:learning-collection-changed";

/** Broadcast that the signed-in learning collection has changed. */
export function announceLearningCollectionChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(LEARNING_COLLECTION_CHANGED_EVENT));
}

/** Subscribe to learning-collection changes; returns an unsubscribe function. */
export function subscribeLearningCollectionChanged(
  listener: () => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(LEARNING_COLLECTION_CHANGED_EVENT, listener);
  return () =>
    window.removeEventListener(LEARNING_COLLECTION_CHANGED_EVENT, listener);
}
