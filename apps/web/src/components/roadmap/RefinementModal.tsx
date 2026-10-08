"use client";
import { useEffect, useRef, useState } from "react";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  requestRoadmapRefinement,
  readRoadmap,
  listRoadmapJobs,
} from "@/lib/roadmapApi";
import { useRoadmapJob } from "@/hooks/useRoadmapJob";
import { ApiError } from "@/lib/apiClient";
import type { CurriculumView } from "@/lib/roadmapTypes";
import { JobStatus } from "./JobStatus";
import { JobActivity } from "./JobActivity";
import { RevisionProposal } from "./RevisionProposal";
export function RefinementModal({
  view,
  onClose,
  onSaved,
  resumeJobId,
  onJobAccepted,
}: {
  view: CurriculumView;
  onClose: () => void;
  onSaved: (view: CurriculumView) => void;
  resumeJobId?: string | null;
  onJobAccepted?: (id: string) => void;
}) {
  const [base, setBase] = useState(view);
  const [instruction, setInstruction] = useState("");
  const [jobId, setJobId] = useState<string | null>(resumeJobId ?? null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const key = useRef<{ fingerprint: string; value: string } | null>(null);
  const busy = useRef(false);
  const alive = useRef(true);
  const watching = useRoadmapJob(jobId);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    setBase(view);
  }, [view]);
  useEffect(() => {
    if (resumeJobId) setJobId(resumeJobId);
  }, [resumeJobId]);
  const [checking, setChecking] = useState(!resumeJobId);
  useEffect(() => {
    if (resumeJobId) {
      setChecking(false);
      return;
    }
    const controller = new AbortController();
    void (async () => {
      try {
        const jobs = await listRoadmapJobs(controller.signal);
        const latest = jobs.find(
          (job) =>
            job.operation === "refine" &&
            job.targetWorkspaceId === view.workspaceId &&
            job.status !== "canceled" &&
            !["applied", "rejected"].includes(job.result?.proposalState ?? ""),
        );
        if (latest && !controller.signal.aborted) setJobId(latest.id);
      } catch {
        /* Generating still uses the authoritative active-job limit. */
      } finally {
        if (!controller.signal.aborted) setChecking(false);
      }
    })();
    return () => controller.abort();
  }, [view.workspaceId, resumeJobId]);

  async function generate(current = base, prompt = instruction) {
    if (busy.current || prompt.trim().length < 10) return;
    busy.current = true;
    setPending(true);
    setError(null);
    const fingerprint = JSON.stringify([current.revisionId, prompt.trim()]);
    if (key.current?.fingerprint !== fingerprint)
      key.current = { fingerprint, value: crypto.randomUUID() };
    try {
      const job = await requestRoadmapRefinement(
        current.workspaceId,
        { baseRevisionId: current.revisionId, instruction: prompt.trim() },
        key.current.value,
      );
      if (alive.current) {
        setJobId(job.id);
        onJobAccepted?.(job.id);
      }
    } catch (err) {
      if (alive.current)
        setError(
          err instanceof Error ? err : new Error("Could not start refinement."),
        );
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  }
  async function regenerate(prompt?: string | null) {
    setPending(true);
    setError(null);
    try {
      const fresh = await readRoadmap(base.workspaceId);
      if (!alive.current) return;
      setBase(fresh);
      onSaved(fresh);
      setJobId(null);
      key.current = null;
      const next = prompt ?? instruction;
      setInstruction(next);
      if (next.trim().length >= 10) await generate(fresh, next);
    } catch (err) {
      if (alive.current)
        setError(
          err instanceof Error
            ? err
            : new Error("Could not reload your roadmap."),
        );
    } finally {
      if (alive.current) setPending(false);
    }
  }
  const ready =
    watching.job?.status === "completed" &&
    watching.job.result?.kind === "proposal";
  return (
    <Modal isOpen onClose={onClose} size="lg">
      <ModalHeader title="Refine roadmap" />
      <ModalBody className="space-y-5">
        {ready && watching.job?.result ? (
          <RevisionProposal
            workspaceId={base.workspaceId}
            revisionId={watching.job.result.revisionId}
            onSaved={onSaved}
            onClose={onClose}
            onRegenerate={regenerate}
          />
        ) : jobId ? (
          <>
            <JobStatus
              snapshot={
                watching.job ?? {
                  id: jobId,
                  operation: "refine",
                  targetWorkspaceId: base.workspaceId,
                  title: base.candidate.title,
                  status: "queued",
                  stage: "understand",
                  startupReady: true,
                  summary: "Loading saved refinement progress…",
                  question: null,
                  questionCount: 0,
                  error: null,
                  result: null,
                  lastSequence: 0,
                  createdAt: "",
                  updatedAt: "",
                }
              }
              onBackground={onClose}
              onCancel={watching.cancel}
              onAnswer={watching.answer}
              onRetry={watching.retry}
            />
            <JobActivity events={watching.events} />
            {watching.error && (
              <p role="alert" className="text-sm text-destructive">
                {watching.error.message}
              </p>
            )}
            {watching.job?.error?.nextAction === "new_run" && (
              <Button
                variant="secondary"
                onClick={() => {
                  setJobId(null);
                  key.current = null;
                }}
              >
                Start another refinement
              </Button>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-foreground-muted">
              What would you like to change?
            </p>
            <Textarea
              aria-label="Refinement instruction"
              placeholder="More hands-on practice, a stronger foundation, or a different focus…"
              value={instruction}
              maxLength={8000}
              onChange={(e) => setInstruction(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-foreground-muted">
              The agent will propose changes within your current study budget.
            </p>
          </>
        )}
        {error && (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-destructive">
              {error.message}
            </p>
            {error instanceof ApiError &&
              error.code === "REVISION_CONFLICT" && (
                <Button variant="secondary" onClick={() => void regenerate()}>
                  Reload latest
                </Button>
              )}
          </div>
        )}
      </ModalBody>
      {!jobId && (
        <ModalFooter>
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={checking || pending || instruction.trim().length < 10}
            onClick={() => void generate()}
          >
            {pending ? "Starting…" : "Generate proposal"}
          </Button>
        </ModalFooter>
      )}
    </Modal>
  );
}
