"use client";

import { useCallback, useRef, useState } from "react";
import { ApiError } from "@/lib/apiClient";
import {
  announceLearningCollectionChanged,
  createSaveCopySession,
  performSaveRoadmapCopy,
  type EnrollmentDetail,
  type SaveCopyInput,
} from "@/lib/enrollmentApi";

export type SaveCopyStatus = "idle" | "pending" | "saved" | "error";

export type { SaveCopyInput };

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

/**
 * useSaveRoadmapCopy — signed-in save flow with pending/retry/reuse (LSI-031).
 *
 * Delegates the resumable copy logic to `performSaveRoadmapCopy` (shared with the
 * LSI-032 intent resume), which reuses an existing copy or creates a fresh
 * workspace, keeps one idempotency key per `template:version`, and maps the
 * guest's public topic onto the private copy. A duplicate click while a save is
 * in flight returns the same pending promise instead of issuing a second write.
 */
export function useSaveRoadmapCopy(): UseSaveRoadmapCopyResult {
  const session = useRef(createSaveCopySession());
  const pending = useRef<Promise<EnrollmentDetail | null> | null>(null);
  const lastInput = useRef<SaveCopyInput | null>(null);

  const [status, setStatus] = useState<SaveCopyStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<EnrollmentDetail | null>(null);
  const [created, setCreated] = useState(false);
  const [privateTopicId, setPrivateTopicId] = useState<string | null>(null);

  const runSave = useCallback(
    async (input: SaveCopyInput): Promise<EnrollmentDetail | null> => {
      setStatus("pending");
      setError(null);
      try {
        const { enrollment: saved, created: didCreate, privateTopicId: mapped } =
          await performSaveRoadmapCopy(input, session.current);

        setEnrollment(saved);
        setCreated(didCreate);
        setPrivateTopicId(mapped);
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
    () => (lastInput.current ? save(lastInput.current) : Promise.resolve(null)),
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
