"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, ModalHeader, ModalBody } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { readRoadmap } from "@/lib/roadmapApi";
import { buildWorkspaceUrl } from "@/lib/urls";
import type { CurriculumView } from "@/lib/roadmapTypes";
import { RefinementModal } from "./RefinementModal";
export function ResumeRefinement({
  workspaceId,
  jobId,
  onClose,
}: {
  workspaceId: string;
  jobId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [view, setView] = useState<CurriculumView | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void readRoadmap(workspaceId, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setView(value);
          setError(null);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(
            err instanceof Error
              ? err
              : new Error("Could not load this roadmap."),
          );
      });
    return () => controller.abort();
  }, [workspaceId, reload]);
  if (view)
    return (
      <RefinementModal
        view={view}
        resumeJobId={jobId}
        onClose={onClose}
        onSaved={(next) => {
          setView(next);
        }}
      />
    );
  return (
    <Modal isOpen onClose={onClose}>
      <ModalHeader title="Refine roadmap" />
      <ModalBody>
        {error ? (
          <>
            <p role="alert" className="text-sm text-destructive">
              {error.message}
            </p>
            <Button
              variant="secondary"
              onClick={() => setReload((old) => old + 1)}
            >
              Retry
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                onClose();
                router.push(buildWorkspaceUrl(workspaceId));
              }}
            >
              Open current roadmap
            </Button>
          </>
        ) : (
          <p role="status" className="text-sm text-foreground-muted">
            Loading your roadmap…
          </p>
        )}
      </ModalBody>
    </Modal>
  );
}
