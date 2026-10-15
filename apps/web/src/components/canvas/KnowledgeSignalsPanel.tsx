"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Brain, Compass, RefreshCw, Target } from "lucide-react";
import type {
  GapAnalysisResponse,
  KnowledgeGap,
  NextTopicsResponse,
  TopicRecommendation,
  WorkspaceMasterySummary,
} from "@graphmind/shared";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, InlineFeedback } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/skeleton";
import {
  adoptKnowledgeGap,
  getNextTopicRecommendations,
  getWorkspaceKnowledgeGaps,
  getWorkspaceMastery,
} from "@/lib/workspaceApi";

export interface KnowledgeSignalsPanelProps {
  workspaceId: string;
  /** Called after an explicit learning signal changes, so hosts can refresh overlays. */
  onSignalsChanged?: () => void;
}

const MASTERY_BADGE: Record<string, BadgeProps["variant"]> = {
  mastered: "success",
  quizzed: "info",
  explored: "secondary",
  stale: "warning",
  unexplored: "outline",
};

const SEVERITY_BADGE: Record<KnowledgeGap["severity"], BadgeProps["variant"]> = {
  high: "destructive",
  medium: "warning",
  low: "secondary",
};

const READINESS_BADGE: Record<TopicRecommendation["readiness"], BadgeProps["variant"]> = {
  ready_to_unlock: "success",
  prerequisites_in_progress: "warning",
  exploratory: "secondary",
};

const READINESS_LABEL: Record<TopicRecommendation["readiness"], string> = {
  ready_to_unlock: "Ready",
  prerequisites_in_progress: "In progress",
  exploratory: "Exploratory",
};

/**
 * KnowledgeSignalsPanel — surfaces the workspace's *explicit* learning signals
 * (concept mastery, detected knowledge gaps, curator recommendations) through
 * the existing mastery/curator services.
 *
 * Mastery is a deliberate, quiz-derived signal: reading or completing a lesson
 * never records one. That separation is stated in the panel and enforced by the
 * backing services.
 */
export function KnowledgeSignalsPanel({
  workspaceId,
  onSignalsChanged,
}: KnowledgeSignalsPanelProps) {
  const [mastery, setMastery] = useState<WorkspaceMasterySummary | null>(null);
  const [gaps, setGaps] = useState<GapAnalysisResponse | null>(null);
  const [topics, setTopics] = useState<NextTopicsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [adoptingId, setAdoptingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const request = useRef(0);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    const id = ++request.current;
    setLoading(true);
    const [nextMastery, nextGaps, nextTopics] = await Promise.all([
      getWorkspaceMastery(workspaceId),
      getWorkspaceKnowledgeGaps(workspaceId),
      getNextTopicRecommendations(workspaceId),
    ]);
    if (id !== request.current) return;
    setMastery(nextMastery);
    setGaps(nextGaps);
    setTopics(nextTopics);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    void load();
    // Quiz feedback and gap adoption dispatch this event; refresh reactively.
    const updated = () => {
      void load();
    };
    window.addEventListener("concept-mastery-updated", updated);
    return () => {
      request.current += 1;
      window.removeEventListener("concept-mastery-updated", updated);
    };
  }, [load]);

  const handleAdopt = useCallback(
    async (gap: KnowledgeGap) => {
      setAdoptingId(gap.id);
      setActionError(null);
      const adopted = await adoptKnowledgeGap(workspaceId, gap.id);
      setAdoptingId(null);
      if (!adopted) {
        setActionError(
          `Could not adopt “${gap.conceptName}”. Adopting a gap needs write access to this workspace.`
        );
        return;
      }
      onSignalsChanged?.();
      // Canonical refresh signal: the panel reloads and canvas heatmaps update.
      window.dispatchEvent(
        new CustomEvent("concept-mastery-updated", { detail: { workspaceId } })
      );
    },
    [workspaceId, onSignalsChanged]
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-3 p-4" role="status" aria-label="Loading knowledge signals">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} label="" className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const unavailable = !mastery && !gaps && !topics;

  if (unavailable) {
    return (
      <div className="p-4">
        <InlineFeedback
          tone="info"
          title="Knowledge signals unavailable"
          action={
            <Button size="sm" variant="ghost" onClick={() => void load()}>
              <RefreshCw /> Retry
            </Button>
          }
        >
          The mastery and curator services for this workspace could not be reached.
        </InlineFeedback>
      </div>
    );
  }

  const distribution = mastery?.distribution;
  const overallPct = Math.round((mastery?.overallScore ?? 0) * 100);
  const conceptCount = mastery?.totalConcepts ?? 0;
  const gapsList = gaps?.gaps ?? [];
  const recommendations = topics?.recommendations ?? [];

  return (
    <div className="flex flex-col gap-5 p-4" data-testid="knowledge-signals-panel">
      <InlineFeedback tone="info" title="Explicit learning signals">
        Concept mastery is recorded from quizzes and explicit reviews. It stays
        separate from lesson completion — marking a topic complete never infers
        mastery.
      </InlineFeedback>

      {actionError && (
        <InlineFeedback tone="destructive" title="Action not applied">
          {actionError}
        </InlineFeedback>
      )}

      <section aria-label="Mastery profile" className="flex flex-col gap-3">
        <header className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Brain className="size-3.5 shrink-0" /> Mastery profile
          </h3>
          <span className="text-xs font-semibold text-foreground">{overallPct}%</span>
        </header>

        {conceptCount === 0 ? (
          <EmptyState
            icon={<Target className="size-5" />}
            title="No mastery signals yet"
            description="Answer a quiz or record a review to start building this profile. Completing lessons does not create mastery signals."
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="success">Mastered {distribution?.mastered ?? 0}</Badge>
              <Badge variant="info">Quizzed {distribution?.quizzed ?? 0}</Badge>
              <Badge variant="secondary">Explored {distribution?.explored ?? 0}</Badge>
              <Badge variant="warning">Stale {distribution?.stale ?? 0}</Badge>
              <Badge variant="outline">Unexplored {distribution?.unexplored ?? 0}</Badge>
            </div>

            {mastery && mastery.concepts.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {mastery.concepts.slice(0, 6).map((concept) => (
                  <li
                    key={concept.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border-subtle bg-surface px-2.5 py-2"
                  >
                    <span className="min-w-0 truncate text-xs text-foreground">
                      {concept.name}
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="text-2xs text-foreground-muted">
                        {Math.round(concept.confidenceScore * 100)}%
                      </span>
                      <Badge variant={MASTERY_BADGE[concept.masteryLevel] ?? "outline"}>
                        {concept.masteryLevel}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section aria-label="Knowledge gaps" className="flex flex-col gap-2.5">
        <header className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Target className="size-3.5 shrink-0" /> Knowledge gaps
          </h3>
          {gaps && gaps.highSeverityCount > 0 && (
            <span className="text-2xs font-medium text-foreground-muted">
              {gaps.highSeverityCount} high priority
            </span>
          )}
        </header>

        {gapsList.length === 0 ? (
          <p className="rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-xs text-foreground-muted">
            No prerequisite gaps detected for the concepts explored so far.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {gapsList.slice(0, 6).map((gap) => (
              <li
                key={gap.id}
                className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">
                      {gap.conceptName}
                    </p>
                    <p className="text-2xs text-foreground-muted">{gap.domain}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge variant={SEVERITY_BADGE[gap.severity]}>{gap.severity}</Badge>
                    <Badge variant="mono">{gap.status}</Badge>
                  </div>
                </div>
                <p className="text-xs text-foreground-muted">{gap.suggestedAction}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="self-start"
                  loading={adoptingId === gap.id}
                  onClick={() => void handleAdopt(gap)}
                >
                  Adopt gap
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Recommended next topics" className="flex flex-col gap-2.5">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Compass className="size-3.5 shrink-0" /> Recommended next topics
        </h3>

        {recommendations.length === 0 ? (
          <p className="rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-xs text-foreground-muted">
            No recommendations yet. Explore a concept to unlock the next frontier.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recommendations.slice(0, 4).map((topic) => (
              <li
                key={topic.id}
                className="flex flex-col gap-1.5 rounded-xl border border-border-subtle bg-surface p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-xs font-semibold text-foreground">
                    {topic.topicName}
                  </span>
                  <Badge variant={READINESS_BADGE[topic.readiness]}>
                    {READINESS_LABEL[topic.readiness]}
                  </Badge>
                </div>
                <p className="text-2xs text-foreground-muted">{topic.domain}</p>
                <p className="text-xs text-foreground-muted">{topic.rationale}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
