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
import type { WorkspaceItem } from "./workspaceApi";

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
