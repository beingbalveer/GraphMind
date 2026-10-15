"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Check, RotateCcw, Lightbulb, Loader2, Sparkles, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  readTopicPracticeState,
  savePracticeDraft,
  deletePracticeDraft,
  submitPracticeAttempt,
} from "@/lib/roadmapApi";
import type {
  PracticeStateData,
  PracticeAttemptData,
  PracticeActivityData,
} from "@/lib/roadmapTypes";

export interface StudioPracticeActivityProps {
  workspaceId: string;
  topicId: string;
  topicTitle?: string;
  enabled?: boolean;
  onEnablePractice?: () => void;
  className?: string;
}

export function StudioPracticeActivity({
  workspaceId,
  topicId,
  topicTitle: _topicTitle,
  enabled = true,
  onEnablePractice,
  className = "",
}: StudioPracticeActivityProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<PracticeStateData | null>(null);

  const [draft, setDraft] = useState("");
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [draftSaveStatus, setDraftSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [latestAttempt, setLatestAttempt] = useState<PracticeAttemptData | null>(null);

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentActivityRef = useRef<PracticeActivityData | null>(null);

  const loadPractice = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const res = await readTopicPracticeState(workspaceId, topicId, signal);
        setState(res);
        currentActivityRef.current = res.activity;
        setLatestAttempt(res.latestAttempt ?? null);

        // Populate draft from server if available
        if (res.draft) {
          setDraft(res.draft.draft || "");
          setSelectedChoice(res.draft.selectedChoice || null);
        } else if (res.latestAttempt && !res.latestAttempt.correct) {
          // If no draft but there is a previous non-correct attempt, allow learner to see and retry
          setDraft(res.latestAttempt.answer || "");
          setSelectedChoice(res.latestAttempt.selectedChoice || null);
        } else {
          setDraft("");
          setSelectedChoice(null);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load practice activity");
      } finally {
        setLoading(false);
      }
    },
    [workspaceId, topicId]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadPractice(controller.signal);
    return () => {
      controller.abort();
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [loadPractice]);

  // Debounced auto-save for draft
  const triggerDraftSave = useCallback(
    (newDraft: string, newChoice: string | null) => {
      if (!enabled || !currentActivityRef.current) return;
      const activity = currentActivityRef.current;

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      setDraftSaveStatus("saving");
      saveTimerRef.current = setTimeout(async () => {
        try {
          await savePracticeDraft(workspaceId, topicId, {
            activityId: activity.id,
            activityVersion: activity.version,
            draft: newDraft,
            selectedChoice: newChoice,
          });
          setDraftSaveStatus("saved");
          setTimeout(() => setDraftSaveStatus("idle"), 2000);
        } catch {
          setDraftSaveStatus("error");
        }
      }, 600);
    },
    [enabled, workspaceId, topicId]
  );

  const handleDraftChange = (text: string) => {
    setDraft(text);
    triggerDraftSave(text, selectedChoice);
  };

  const handleChoiceChange = (choice: string) => {
    setSelectedChoice(choice);
    triggerDraftSave(draft, choice);
  };

  const handleStartOver = async () => {
    setDraft("");
    setSelectedChoice(null);
    setLatestAttempt(null);
    setSubmitError(null);
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    try {
      await deletePracticeDraft(workspaceId, topicId);
    } catch {
      // Ignore background draft deletion error
    }
  };

  const activity = state?.activity;
  const hasPrompt = Boolean(activity?.prompt && activity.prompt.trim().length > 0);
  const attemptsCount = (state?.attemptsCount ?? 0) + (latestAttempt && !state?.latestAttempt ? 1 : 0);

  const canCheck =
    activity?.kind === "choice"
      ? Boolean(selectedChoice)
      : Boolean(draft.trim().length > 0);

  const handleSubmitAttempt = async () => {
    if (!activity || !canCheck || submitting) return;

    setSubmitting(true);
    setSubmitError(null);

    const attemptId = `attempt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      const response = await submitPracticeAttempt(workspaceId, topicId, {
        activityId: activity.id,
        activityVersion: activity.version,
        attemptId,
        answer: draft,
        selectedChoice,
      });

      // Parse attempt result
      const res = (response.result || {}) as Record<string, unknown>;
      const newAttempt: PracticeAttemptData = {
        id: response.id,
        attemptId: (res.attemptId as string) || response.id,
        attemptNumber: (res.attemptNumber as number) || (attemptsCount + 1),
        activityId: (res.activityId as string) || activity.id,
        activityVersion: (res.activityVersion as string) || activity.version,
        answer: (res.answer as string) || draft,
        selectedChoice: (res.selectedChoice as string) || selectedChoice,
        correct: res.correct as boolean | undefined,
        feedback: (res.feedback as string) || response.feedback || "Attempt recorded.",
        explanation: (res.explanation as string) || activity.explanation || null,
        canRetry: res.canRetry !== false,
        nextAction: (res.nextAction as PracticeAttemptData["nextAction"]) || "retry",
        submittedAt: response.createdAt,
      };

      setLatestAttempt(newAttempt);
      setState((prev) =>
        prev
          ? {
              ...prev,
              attemptsCount: prev.attemptsCount + 1,
              draft: null,
            }
          : null
      );
      setDraftSaveStatus("idle");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to record practice attempt";
      setSubmitError(errMsg);
      // If version mismatch was reported by server, refresh state
      if (errMsg.includes("version mismatch")) {
        loadPractice();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      aria-labelledby="practice-heading"
      className={`rounded-2xl border border-border-subtle bg-surface p-5 sm:p-6 space-y-5 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="practice-heading" className="text-base sm:text-lg font-semibold text-foreground">
              Practice this idea
            </h2>
            {enabled && attemptsCount > 0 && (
              <Badge variant="outline" className="text-2xs">
                {attemptsCount} {attemptsCount === 1 ? "attempt" : "attempts"}
              </Badge>
            )}
            {draftSaveStatus === "saving" && (
              <span className="text-2xs text-foreground-muted flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" /> Saving draft...
              </span>
            )}
            {draftSaveStatus === "saved" && (
              <span className="text-2xs text-foreground-muted">Draft saved</span>
            )}
          </div>
          <p className="mt-1 text-xs text-foreground-muted">
            A targeted exercise tied to this lesson. Your answer and drafts are private to this workspace.
          </p>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-foreground-muted">
          <Loader2 className="size-4 animate-spin text-primary" />
          <span>Loading practice activity...</span>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 space-y-2">
          <p className="text-xs font-medium text-destructive">{error}</p>
          <Button size="xs" variant="outline" onClick={() => loadPractice()}>
            Retry loading
          </Button>
        </div>
      )}

      {/* Gated Un-enabled State */}
      {!loading && !error && !enabled && (
        <div className="rounded-xl border border-border-subtle bg-background-secondary p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Sparkles className="size-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">Private practice is locked</p>
              <p className="text-xs leading-5 text-foreground-muted">
                Reading is open to everyone. Enable this private practice area to test your understanding, save answer drafts, and record self-checks with your learning copy.
              </p>
            </div>
          </div>
          {onEnablePractice && (
            <Button size="sm" variant="outline" onClick={onEnablePractice}>
              Enable private practice
            </Button>
          )}
        </div>
      )}

      {/* Honest Empty State: Activity Missing or Unconfigured */}
      {!loading && !error && enabled && !hasPrompt && (
        <div className="rounded-xl border border-border-subtle bg-background-secondary p-4 space-y-2 text-xs text-foreground-muted">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <HelpCircle className="size-4 text-foreground-muted" />
            <span>Practice activity not yet configured</span>
          </div>
          <p className="leading-5">
            No interactive practice activity is available for this topic yet. You can review the key learning objectives above, pause and reflect, or discuss questions directly with the AI tutor.
          </p>
        </div>
      )}

      {/* Active Activity Form */}
      {!loading && !error && enabled && hasPrompt && activity && (
        <div className="space-y-5">
          {/* Activity Prompt */}
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
              {activity.kind === "choice"
                ? "Multiple Choice Check"
                : activity.kind === "reflection"
                ? "Reflection Exercise"
                : "Short Answer Check"}
            </p>
            <p className="text-sm leading-6 text-foreground font-medium">{activity.prompt}</p>
          </div>

          {/* Activity Input */}
          {activity.kind === "choice" ? (
            <div
              role="radiogroup"
              aria-label="Answer choices"
              className="grid gap-2.5 pt-1"
            >
              {(activity.choices || []).map((choice, i) => {
                const isSelected = selectedChoice === choice;
                return (
                  <Button
                    key={i}
                    type="button"
                    variant={isSelected ? "secondary" : "outline"}
                    className={`h-auto min-h-11 justify-start whitespace-normal px-4 py-3 text-left text-xs sm:text-sm font-normal border transition-colors ${
                      isSelected
                        ? "border-primary/50 bg-primary/10 text-foreground font-medium"
                        : "border-border-subtle hover:bg-surface-hover"
                    }`}
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleChoiceChange(choice)}
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border mr-3 text-2xs font-semibold">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="flex-1">{choice}</span>
                  </Button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              <Textarea
                aria-label={
                  activity.kind === "reflection"
                    ? "Your reflection response"
                    : "Your practice answer"
                }
                value={draft}
                onChange={(e) => handleDraftChange(e.target.value)}
                placeholder={
                  activity.kind === "reflection"
                    ? "Write your personal reflection and takeaways..."
                    : "Write your answer or explanation here..."
                }
                className="min-h-24 text-xs sm:text-sm"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              size="sm"
              disabled={!canCheck || submitting}
              onClick={handleSubmitAttempt}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Checking...
                </>
              ) : latestAttempt ? (
                <>
                  <RotateCcw className="size-3.5 mr-1.5" />
                  Check again
                </>
              ) : (
                <>
                  <Check className="size-3.5 mr-1.5" />
                  {activity.kind === "reflection" ? "Save reflection" : "Check answer"}
                </>
              )}
            </Button>

            {(draft || selectedChoice || latestAttempt) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStartOver}
                disabled={submitting}
              >
                Start over
              </Button>
            )}
          </div>

          {/* Hint Disclosure */}
          {activity.hint && (
            <div className="pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs text-foreground-muted hover:text-foreground"
                aria-expanded={hintOpen}
                onClick={() => setHintOpen((prev) => !prev)}
              >
                <Lightbulb className="mr-1.5 size-3.5 text-warning" />
                {hintOpen ? "Hide hint" : "Need a hint?"}
              </Button>
              {hintOpen && (
                <div className="mt-2 rounded-xl border border-warning/20 bg-warning/5 p-3 text-xs leading-5 text-foreground-muted">
                  <span className="font-semibold text-warning">Hint: </span>
                  {activity.hint}
                </div>
              )}
            </div>
          )}

          {/* Submission Error */}
          {submitError && (
            <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              {submitError}
            </div>
          )}

          {/* Attempt Result / Feedback Announcement */}
          {latestAttempt && (
            <div
              role="status"
              aria-live="polite"
              className={`rounded-xl border p-4 space-y-2 ${
                latestAttempt.correct === true
                  ? "border-success/40 bg-success/10 text-success-foreground"
                  : latestAttempt.correct === false
                  ? "border-warning/40 bg-warning/10 text-warning-foreground"
                  : "border-primary/40 bg-primary/10 text-primary-foreground"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">
                  {latestAttempt.correct === true
                    ? "Great check! Your reasoning matches."
                    : latestAttempt.correct === false
                    ? "Review and try once more"
                    : "Reflection recorded"}
                </span>
                <span className="text-2xs opacity-80">
                  Attempt #{latestAttempt.attemptNumber}
                </span>
              </div>
              <p className="text-xs leading-5 text-foreground">
                {latestAttempt.feedback}
              </p>
              {latestAttempt.explanation && (
                <p className="text-xs leading-5 text-foreground-muted border-t border-border-subtle pt-2">
                  <span className="font-medium text-foreground">Explanation: </span>
                  {latestAttempt.explanation}
                </p>
              )}
            </div>
          )}

          {/* Anti-Mastery / Decoupling Notice */}
          <div className="rounded-xl border border-border-subtle bg-background-secondary p-3 text-2xs leading-4 text-foreground-muted">
            <p>
              Practice checks are self-directed exercises for reinforcement. Submitting an answer does not automatically complete the topic or infer mastery.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
