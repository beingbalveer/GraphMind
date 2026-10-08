"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClarificationForm } from "./ClarificationForm";
import type { JobSnapshot } from "@/lib/roadmapTypes";
const stages = {
  understand: "Understanding your goal",
  research: "Researching the path",
  compose: "Building your curriculum",
  personalize: "Planning your pace",
  validate: "Checking the roadmap",
  publish: "Preparing your workspace",
};
export function JobStatus({
  snapshot,
  onBackground,
  onCancel,
  onAnswer,
  onRetry,
}: {
  snapshot: JobSnapshot;
  onBackground: () => void;
  onCancel: () => Promise<unknown>;
  onAnswer: (questionId: string, answer: string) => Promise<unknown>;
  onRetry: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function action(run: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await run();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not complete this action",
      );
    } finally {
      setBusy(false);
    }
  }
  const active = ["queued", "running", "cancel_requested"].includes(
    snapshot.status,
  );
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {active && (
            <Loader2 className="size-4 animate-spin text-foreground-muted" />
          )}
          <h3 className="font-roadmap-display text-xl">
            {snapshot.status === "completed"
              ? snapshot.operation === "refine"
                ? "Your changes are ready to review"
                : "Your roadmap is ready"
              : snapshot.status === "failed"
                ? "Generation needs attention"
                : snapshot.status === "canceled"
                  ? "Generation canceled"
                  : snapshot.operation === "refine" &&
                      snapshot.stage === "publish"
                    ? "Preparing your proposal"
                    : stages[snapshot.stage]}
          </h3>
        </div>
        <p className="text-sm text-foreground-muted">
          {snapshot.error?.message || snapshot.summary}
        </p>
      </div>
      {snapshot.question && (
        <ClarificationForm
          key={snapshot.question.id}
          question={snapshot.question}
          onAnswer={onAnswer}
        />
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onBackground} variant="outline">
          Continue in background
        </Button>
        {(active || snapshot.status === "awaiting_input") && (
          <Button
            variant="ghost"
            disabled={busy || snapshot.status === "cancel_requested"}
            onClick={() => void action(onCancel)}
          >
            {snapshot.operation === "refine"
              ? "Cancel refinement"
              : "Cancel generation"}
          </Button>
        )}
        {(snapshot.error?.recoverable || snapshot.status === "canceled") && (
          <Button disabled={busy} onClick={() => void action(onRetry)}>
            {snapshot.operation === "refine"
              ? "Retry refinement"
              : "Retry generation"}
          </Button>
        )}
      </div>
    </div>
  );
}
