"use client";

import { useCallback, useRef, useState } from "react";
import { ApiError } from "@/lib/apiClient";
import {
  announceLearningCollectionChanged,
  findSavedWorkspace,
  mapPublicTopicToPrivate,
  saveRoadmapCopy,
  sourceSnapshotRef,
  type EnrollmentDetail,
} from "@/lib/enrollmentApi";
import { createWorkspace, listWorkspaces } from "@/lib/workspaceApi";

export type SaveCopyStatus = "idle" | "pending" | "saved" | "error";

export interface SaveCopyInput {
  templateId: string;
  snapshotVersion: string;
  /** Title for the new private copy and its workspace. */
  title?: string | null;
  /** Public topic the guest was reading, mapped onto the private copy. */
  publicTopicId?: string | null;
}

export interface UseSaveRoadmapCopyResult {
  status: SaveCopyStatus;
  error: string | null;
  enrollment: EnrollmentDetail | null;
  /** True when this save created the copy; false when it reused an existing one. */
  created: boolean;
  /** Private id the guest's public topic was copied to, when one was mapped. */
  privateTopicId: string | null;
  save: (input: SaveCopyInput) => Promise<EnrollmentDetail | null>;
  retry: () => Promise<EnrollmentDetail | null>;
  reset: () => void;
}

const GENERIC_ERROR = "We couldn't save this roadmap. Please try again.";

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
 * useSaveRoadmapCopy — signed-in save flow with pending/retry/reuse (LSI-031).
 *
 * Reuses the existing copy when the snapshot is already saved (the server
 * dedupes on `(workspace, template)`), otherwise creates a fresh, empty workspace
 * for the copy so two different templates stay isolated. One idempotency key is
 * kept per `template:version`, so a retry after a failure replays the same
 * request, and a duplicate click while a save is in flight returns the same
 * pending promise instead of issuing a second write.
 */
export function useSaveRoadmapCopy(): UseSaveRoadmapCopyResult {
  const keys = useRef<Map<string, string>>(new Map());
  const createdWorkspaces = useRef<Map<string, string>>(new Map());
  const pending = useRef<Promise<EnrollmentDetail | null> | null>(null);
  const lastInput = useRef<SaveCopyInput | null>(null);

  const [status, setStatus] = useState<SaveCopyStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<EnrollmentDetail | null>(null);
  const [created, setCreated] = useState(false);
  const [privateTopicId, setPrivateTopicId] = useState<string | null>(null);

  const runSave = useCallback(
    async (input: SaveCopyInput): Promise<EnrollmentDetail | null> => {
      const ref = sourceSnapshotRef(input.templateId, input.snapshotVersion);
      let idempotencyKey = keys.current.get(ref);
      if (!idempotencyKey) {
        idempotencyKey = nextIdempotencyKey();
        keys.current.set(ref, idempotencyKey);
      }

      setStatus("pending");
      setError(null);
      try {
        // A strict list: "could not load" must not be misread as "nothing saved",
        // which would create a duplicate copy.
        const workspaces = await listWorkspaces();
        const existing = findSavedWorkspace(
          workspaces,
          input.templateId,
          input.snapshotVersion,
        );

        let workspaceId: string;
        if (existing) {
          workspaceId = existing.id;
        } else {
          // Reuse a workspace this hook already created for the snapshot (for
          // example after a failed save) so a retry never leaves an empty
          // workspace behind.
          const tracked = createdWorkspaces.current.get(ref);
          if (tracked) {
            workspaceId = tracked;
          } else {
            const name =
              input.title?.trim() || input.templateId.trim() || "My learning";
            const workspace = await createWorkspace(
              name,
              "Saved from the public learning catalog.",
            );
            workspaceId = workspace.id;
            createdWorkspaces.current.set(ref, workspaceId);
          }
        }

        const saved = await saveRoadmapCopy(
          workspaceId,
          {
            templateId: input.templateId,
            snapshotVersion: input.snapshotVersion,
            customTitle: input.title ?? null,
          },
          idempotencyKey,
        );

        setEnrollment(saved);
        // "Created" reflects whether the copy already existed, independent of
        // whether this attempt reused a workspace it created earlier.
        setCreated(!existing);
        setPrivateTopicId(
          input.publicTopicId
            ? mapPublicTopicToPrivate(saved, input.publicTopicId)
            : null,
        );
        setStatus("saved");
        announceLearningCollectionChanged();
        return saved;
      } catch (err) {
        setError(err instanceof ApiError ? err.detail : GENERIC_ERROR);
        setStatus("error");
        return null;
      }
    },
    [],
  );

  const save = useCallback(
    (input: SaveCopyInput) => {
      if (pending.current) return pending.current;
      lastInput.current = input;
      const promise = runSave(input).finally(() => {
        pending.current = null;
      });
      pending.current = promise;
      return promise;
    },
    [runSave],
  );

  const retry = useCallback(
    () =>
      lastInput.current ? save(lastInput.current) : Promise.resolve(null),
    [save],
  );

  const reset = useCallback(() => {
    lastInput.current = null;
    setStatus("idle");
    setError(null);
    setEnrollment(null);
    setCreated(false);
    setPrivateTopicId(null);
  }, []);

  return {
    status,
    error,
    enrollment,
    created,
    privateTopicId,
    save,
    retry,
    reset,
  };
}
