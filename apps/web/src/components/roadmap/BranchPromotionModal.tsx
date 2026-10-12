"use client";

import { useEffect, useRef, useState } from "react";
import { Modal, ModalBody, ModalHeader } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRoadmapJob } from "@/hooks/useRoadmapJob";
import { readRoadmap, requestRoadmapPromotion } from "@/lib/roadmapApi";
import type { CurriculumView } from "@/lib/roadmapTypes";
import { JobStatus } from "./JobStatus";
import { JobActivity } from "./JobActivity";
import { RevisionProposal } from "./RevisionProposal";

export function BranchPromotionModal({
  view,
  sourceChatId,
  sourceNodeId,
  sourceTitle,
  sourceExcerpt,
  isOpen,
  resumeJobId,
  onClose,
  onSaved,
  onJobAccepted,
}: {
  view: CurriculumView;
  sourceChatId: string;
  sourceNodeId: string;
  sourceTitle: string;
  sourceExcerpt: string;
  isOpen: boolean;
  resumeJobId?: string | null;
  onClose: () => void;
  onSaved: (view: CurriculumView) => void;
  onJobAccepted?: (jobId: string, sourceChatId: string, sourceNodeId: string) => void;
}) {
  const [jobId, setJobId] = useState<string | null>(resumeJobId ?? null);
  const [base, setBase] = useState(view);
  const [targetContainerId, setTargetContainerId] = useState(
    () => view.candidate.items.find((item) => item.kind === "root")?.id ?? "",
  );
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const pendingSourceKeyRef = useRef<string | null>(null);
  const sourceKey = `${sourceChatId}:${sourceNodeId}`;
  const sourceKeyRef = useRef(sourceKey);
  sourceKeyRef.current = sourceKey;
  const key = useRef<{ fingerprint: string; value: string } | null>(null);
  const watching = useRoadmapJob(jobId);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  useEffect(() => setBase(view), [view]);
  useEffect(() => {
    setPending(false);
    setError(null);
    key.current = null;
  }, [sourceKey]);
  useEffect(() => {
    if (resumeJobId) setJobId(resumeJobId);
  }, [resumeJobId]);
  useEffect(() => {
    if (!isOpen && !resumeJobId) {
      setJobId(null);
      setError(null);
      setInstruction("");
      key.current = null;
    }
  }, [isOpen, resumeJobId]);

  const containers = base.candidate.items.filter(
    (item) => ["root", "phase", "group"].includes(item.kind) && item.participation === "active",
  );
  const ready = watching.job?.status === "completed" && watching.job.result?.kind === "proposal";

  async function generate(current = base, target = targetContainerId, prompt = instruction) {
    if (pendingSourceKeyRef.current === sourceKey || !target) return;
    pendingSourceKeyRef.current = sourceKey;
    setPending(true);
    setError(null);
    const fingerprint = JSON.stringify([current.revisionId, sourceChatId, sourceNodeId, target, prompt.trim()]);
    if (key.current?.fingerprint !== fingerprint)
      key.current = { fingerprint, value: crypto.randomUUID() };
    try {
      const job = await requestRoadmapPromotion(
        current.workspaceId,
        {
          sourceChatId,
          sourceNodeId,
          targetContainerId: target,
          baseRevisionId: current.revisionId,
          instruction: prompt.trim() || undefined,
        },
        key.current.value,
      );
      onJobAccepted?.(job.id, sourceChatId, sourceNodeId);
      if (alive.current && sourceKeyRef.current === sourceKey) {
        setJobId(job.id);
      }
    } catch (failure) {
      if (alive.current && sourceKeyRef.current === sourceKey && isOpen)
        setError(failure instanceof Error ? failure.message : "Could not prepare this roadmap addition.");
    } finally {
      if (pendingSourceKeyRef.current === sourceKey) pendingSourceKeyRef.current = null;
      if (alive.current && sourceKeyRef.current === sourceKey) setPending(false);
    }
  }

  async function regenerate(prompt?: string | null) {
    if (pendingSourceKeyRef.current === sourceKey) return;
    pendingSourceKeyRef.current = sourceKey;
    setPending(true);
    setError(null);
    try {
      const fresh = await readRoadmap(base.workspaceId);
      if (!alive.current) return;
      setBase(fresh);
      onSaved(fresh);
      setJobId(null);
      key.current = null;
      pendingSourceKeyRef.current = null;
      await generate(fresh, targetContainerId, prompt ?? instruction);
    } catch (failure) {
      if (alive.current && sourceKeyRef.current === sourceKey && isOpen)
        setError(failure instanceof Error ? failure.message : "Could not reload the roadmap.");
    } finally {
      if (pendingSourceKeyRef.current === sourceKey) pendingSourceKeyRef.current = null;
      if (alive.current && sourceKeyRef.current === sourceKey) setPending(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" ariaLabel="Add branch to roadmap">
      <ModalHeader
        title="Add to roadmap"
        description="Prepare a proposed topic from this saved branch. Your active roadmap stays unchanged until you apply it."
        onClose={onClose}
      />
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
          <div className="space-y-5">
            <JobStatus
              snapshot={watching.job ?? {
                id: jobId,
                operation: "refine",
                targetWorkspaceId: base.workspaceId,
                title: "Roadmap addition",
                status: "queued",
                stage: "understand",
                startupReady: true,
                summary: "Loading saved proposal progress…",
                question: null,
                questionCount: 0,
                error: null,
                result: null,
                lastSequence: 0,
                createdAt: "",
                updatedAt: "",
              }}
              onBackground={onClose}
              onCancel={watching.cancel}
              onAnswer={watching.answer}
              onRetry={watching.retry}
            />
            <JobActivity
              events={watching.events}
              active={Boolean(watching.job && ["queued", "running", "cancel_requested"].includes(watching.job.status))}
            />
            {watching.error && <p role="alert" className="text-sm text-destructive">{watching.error.message}</p>}
          </div>
        ) : (
          <div className="space-y-4">
            <section className="rounded-xl border border-border-subtle bg-background-secondary p-3">
              <p className="text-xs font-medium text-foreground-muted">Source conversation · {sourceTitle}</p>
              <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm text-foreground">{sourceExcerpt}</p>
            </section>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Place this topic under</legend>
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {containers.map((container) => (
                  <label key={container.id} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-surface-hover">
                    <Input
                      type="radio"
                      name="promotion-target-container"
                      className="size-4 w-4 accent-primary"
                      checked={targetContainerId === container.id}
                      onChange={() => setTargetContainerId(container.id)}
                      disabled={pending}
                    />
                    <span className="text-foreground">{container.title}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="space-y-2">
              <label htmlFor="promotion-instruction" className="text-sm font-medium">Guidance (optional)</label>
              <Textarea
                id="promotion-instruction"
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                placeholder="Add a topic that explains the key idea in this branch…"
                rows={3}
                disabled={pending}
              />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end">
              <Button disabled={pending || !targetContainerId} onClick={() => void generate()}>
                {pending ? "Preparing proposal…" : "Prepare proposal"}
              </Button>
            </div>
          </div>
        )}
      </ModalBody>
    </Modal>
  );
}
