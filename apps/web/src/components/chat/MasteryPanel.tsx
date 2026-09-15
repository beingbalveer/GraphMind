"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Sparkles,
  CheckCircle2,
  Clock,
  BookOpen,
  RefreshCw,
  Search,
  Zap,
  GitBranch,
  Compass,
  Plus,
  Rocket,
} from "lucide-react";
import {
  GapAnalysisResponse,
  KnowledgeGap,
  NextTopicsResponse,
  TopicRecommendation,
  WorkspaceMasterySummary,
} from "@graphmind/shared";
import {
  adoptKnowledgeGap,
  getNextTopicRecommendations,
  getWorkspaceKnowledgeGaps,
  getWorkspaceMastery,
} from "@/lib/workspaceApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SegmentedTabs, SegmentedTabItem } from "@/components/ui/segmented-tabs";

interface MasteryPanelProps {
  workspaceId: string;
  onQuizConcept?: (conceptName: string) => void;
  onExploreGap?: (gap: KnowledgeGap) => void;
  onStartTopic?: (topic: TopicRecommendation) => void;
}

type PanelTab = "curated" | "concepts";

export function MasteryPanel({
  workspaceId,
  onQuizConcept,
  onExploreGap,
  onStartTopic,
}: MasteryPanelProps) {
  const [summary, setSummary] = useState<WorkspaceMasterySummary | null>(null);
  const [gapAnalysis, setGapAnalysis] = useState<GapAnalysisResponse | null>(null);
  const [nextTopics, setNextTopics] = useState<NextTopicsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [adoptingGapId, setAdoptingGapId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PanelTab>("curated");

  const loadSummary = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const [summaryData, gapsData, topicsData] = await Promise.all([
        getWorkspaceMastery(workspaceId),
        getWorkspaceKnowledgeGaps(workspaceId),
        getNextTopicRecommendations(workspaceId, 3),
      ]);
      setSummary(summaryData);
      setGapAnalysis(gapsData);
      setNextTopics(topicsData);
    } catch (err) {
      console.warn("Failed to load workspace mastery or recommendations:", err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadSummary();

    const handleUpdate = () => {
      loadSummary();
    };

    window.addEventListener("concept-mastery-updated", handleUpdate);
    return () => {
      window.removeEventListener("concept-mastery-updated", handleUpdate);
    };
  }, [loadSummary]);

  const concepts = useMemo(() => summary?.concepts ?? [], [summary]);

  const filteredConcepts = useMemo(() => {
    if (!searchQuery.trim()) return concepts;
    const query = searchQuery.toLowerCase().trim();
    return concepts.filter((c) => c.name.toLowerCase().includes(query));
  }, [concepts, searchQuery]);

  const tabs = useMemo<SegmentedTabItem<PanelTab>[]>(() => [
    { id: "curated", label: "Curated", icon: Sparkles },
    {
      id: "concepts",
      label: "Concepts",
      icon: BookOpen,
      badge: concepts.length > 0 ? `${concepts.length}` : undefined,
    },
  ], [concepts.length]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-2 text-foreground-muted select-none">
        <RefreshCw className="w-5 h-5 animate-spin text-foreground-muted" />
        <span className="text-xs text-foreground-muted font-medium">Loading knowledge profile...</span>
      </div>
    );
  }

  const overallPct = Math.round((summary?.overallScore ?? 0) * 100);
  const distribution = summary?.distribution ?? {
    mastered: 0,
    quizzed: 0,
    explored: 0,
    stale: 0,
    unexplored: 0,
  };

  return (
    <div className="flex-1 flex flex-col space-y-4 overflow-y-auto pr-0.5 pb-6">
      {/* Top Segmented Navigation */}
      <SegmentedTabs
        items={tabs}
        value={activeTab}
        onChange={setActiveTab}
        size="md"
        className="w-full justify-center shadow-xs"
      />

      {activeTab === "curated" ? (
        <>
          {/* Overall Mastery Score Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-border shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-sm font-semibold text-foreground">
                <Sparkles className="w-4 h-4 text-foreground" />
                <span>Mastery Score</span>
              </div>
              <span className="text-xl font-bold text-foreground font-mono">{overallPct}%</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-foreground transition-all duration-500 rounded-full"
                style={{ width: `${Math.max(overallPct, 4)}%` }}
              />
            </div>

            {/* Distribution Badges */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-surface-hover/50 border border-border-subtle text-xs">
                <span className="flex items-center space-x-2 text-foreground-muted font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-foreground shrink-0" />
                  <span>Mastered</span>
                </span>
                <span className="font-semibold text-foreground font-mono">{distribution.mastered}</span>
              </div>

              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-surface-hover/50 border border-border-subtle text-xs">
                <span className="flex items-center space-x-2 text-foreground-muted font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-foreground-muted shrink-0" />
                  <span>Quizzed</span>
                </span>
                <span className="font-semibold text-foreground font-mono">{distribution.quizzed}</span>
              </div>

              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-surface-hover/50 border border-border-subtle text-xs">
                <span className="flex items-center space-x-2 text-foreground-muted font-medium">
                  <BookOpen className="w-3.5 h-3.5 text-foreground-muted shrink-0" />
                  <span>Explored</span>
                </span>
                <span className="font-semibold text-foreground font-mono">{distribution.explored}</span>
              </div>

              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-surface-hover/50 border border-border-subtle text-xs">
                <span className="flex items-center space-x-2 text-foreground-muted font-medium">
                  <Clock className="w-3.5 h-3.5 text-foreground-muted shrink-0" />
                  <span>Stale</span>
                </span>
                <span className="font-semibold text-foreground font-mono">{distribution.stale}</span>
              </div>
            </div>
          </div>

          {/* Next Best Topics (Forward Learning Frontier) */}
          {nextTopics && nextTopics.recommendations.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center space-x-2">
                  <Rocket className="w-4 h-4 text-foreground-muted" />
                  <h3 className="text-sm font-semibold text-foreground">Next Best Topics</h3>
                </div>
                <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-xs font-medium">
                  AI Curated
                </Badge>
              </div>

              <div className="space-y-3">
                {nextTopics.recommendations.map((rec) => {
                  const isReady = rec.readiness === "ready_to_unlock";
                  const isProgress = rec.readiness === "prerequisites_in_progress";

                  return (
                    <div
                      key={rec.id}
                      className="p-4 rounded-2xl bg-surface border border-border hover:border-border-strong transition-all space-y-3 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 pr-1">
                          <p className="font-semibold text-foreground truncate text-sm leading-snug">
                            {rec.topicName}
                          </p>
                          <p className="text-xs text-foreground-muted font-normal mt-0.5">
                            {rec.domain}
                          </p>
                        </div>
                        <Badge
                          variant={isReady ? "default" : isProgress ? "secondary" : "outline"}
                          className="rounded-full px-2.5 py-0.5 text-xs shrink-0 font-medium tracking-wide"
                        >
                          {rec.readiness.replace(/_/g, " ")}
                        </Badge>
                      </div>

                      <p className="text-xs text-foreground-muted leading-relaxed">
                        {rec.rationale}
                      </p>

                      {rec.unlockedBy.length > 0 && (
                        <div className="pt-1">
                          <span className="text-xs font-medium text-foreground-muted block mb-1.5">
                            Unlocked by:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {rec.unlockedBy.map((u, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2.5 py-1 rounded-lg bg-surface-hover text-foreground-muted text-xs font-normal border border-border-subtle"
                              >
                                {u}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {rec.futureUnlocks.length > 0 && (
                        <div className="pt-1">
                          <span className="text-xs font-medium text-foreground-muted block mb-1.5">
                            Unlocks next:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {rec.futureUnlocks.map((fu, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2.5 py-1 rounded-lg bg-surface-hover text-foreground-muted text-xs font-normal border border-border-subtle"
                              >
                                {fu}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {onStartTopic && (
                        <div className="pt-1.5">
                          <Button
                            size="sm"
                            variant="default"
                            className="w-full h-9 rounded-xl text-xs font-medium cursor-pointer"
                            onClick={() => onStartTopic(rec)}
                          >
                            <Rocket className="w-3.5 h-3.5 mr-2" />
                            <span>Start Learning Topic</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Knowledge Gaps (Knowledge Curator) */}
          {gapAnalysis && gapAnalysis.gaps.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center space-x-2">
                  <GitBranch className="w-4 h-4 text-foreground-muted" />
                  <h3 className="text-sm font-semibold text-foreground">Knowledge Gaps</h3>
                </div>
                <Badge
                  variant={gapAnalysis.highSeverityCount > 0 ? "destructive" : "secondary"}
                  className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                >
                  {gapAnalysis.totalGaps} prerequisite{gapAnalysis.totalGaps === 1 ? "" : "s"}
                </Badge>
              </div>

              <div className="space-y-3">
                {gapAnalysis.gaps.slice(0, 3).map((gap) => (
                  <div
                    key={gap.id}
                    className="p-4 rounded-2xl bg-surface border border-border hover:border-border-strong transition-all space-y-3 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 pr-1">
                        <p className="font-semibold text-foreground truncate text-sm leading-snug">
                          {gap.conceptName}
                        </p>
                        <p className="text-xs text-foreground-muted font-normal mt-0.5">
                          {gap.domain}
                        </p>
                      </div>
                      <Badge
                        variant={gap.status === "missing" ? "destructive" : "secondary"}
                        className="rounded-full px-2.5 py-0.5 text-xs shrink-0 font-medium tracking-wide"
                      >
                        {gap.status.replace("_", " ")}
                      </Badge>
                    </div>

                    <p className="text-xs text-foreground-muted leading-relaxed">
                      {gap.rationale}
                    </p>

                    {gap.dependentConcepts.length > 0 && (
                      <div className="pt-1">
                        <span className="text-xs font-medium text-foreground-muted block mb-1.5">
                          Prerequisite for:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {gap.dependentConcepts.map((dep, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2.5 py-1 rounded-lg bg-surface-hover text-foreground-muted text-xs font-normal border border-border-subtle"
                            >
                              {dep}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center space-x-2 pt-1.5">
                      {onExploreGap && (
                        <Button
                          size="sm"
                          variant="default"
                          className="flex-1 h-9 rounded-xl text-xs font-medium cursor-pointer"
                          onClick={() => onExploreGap(gap)}
                        >
                          <Compass className="w-3.5 h-3.5 mr-2" />
                          <span>Explore Gap</span>
                        </Button>
                      )}

                      {gap.status === "missing" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={adoptingGapId === gap.id}
                          onClick={async () => {
                            setAdoptingGapId(gap.id);
                            try {
                              await adoptKnowledgeGap(workspaceId, gap.id);
                              window.dispatchEvent(new CustomEvent("concept-mastery-updated"));
                            } finally {
                              setAdoptingGapId(null);
                            }
                          }}
                          className="h-9 px-3 rounded-xl text-xs font-medium cursor-pointer shrink-0"
                          title="Add to tracked concepts"
                        >
                          {adoptingGapId === gap.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                          ) : (
                            <Plus className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          <span>Track</span>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Review Recommendations */}
          {summary?.needingReview && summary.needingReview.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-foreground-muted" />
                  <h3 className="text-sm font-semibold text-foreground">Needs Review</h3>
                </div>
                <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs font-medium">
                  {summary.needingReview.length} concepts
                </Badge>
              </div>

              <div className="space-y-2">
                {summary.needingReview.slice(0, 3).map((concept) => (
                  <div
                    key={concept.id}
                    className="p-3.5 sm:p-4 rounded-2xl bg-surface border border-border hover:border-border-strong transition-all flex items-center justify-between shadow-xs"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="text-sm font-medium text-foreground truncate">
                        {concept.name}
                      </p>
                      <p className="text-xs text-foreground-muted font-mono mt-0.5">
                        Confidence: {Math.round(concept.confidenceScore * 100)}%
                      </p>
                    </div>

                    {onQuizConcept && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onQuizConcept(concept.name)}
                        className="h-8 px-3 rounded-lg text-xs font-medium cursor-pointer shrink-0"
                        title={`Practice ${concept.name}`}
                      >
                        <Zap className="w-3.5 h-3.5 mr-1 text-foreground" />
                        <span>Quiz</span>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* Concepts Tab View */
        <div className="space-y-3 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold text-foreground">
              Tracked Concepts ({concepts.length})
            </h3>
          </div>

          {/* Filter Input */}
          <Input
            startIcon={<Search className="w-4 h-4 text-foreground-muted" />}
            placeholder="Filter concepts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 text-xs bg-surface rounded-xl shadow-xs border-border"
          />

          {/* Concepts List */}
          <div className="space-y-2 overflow-y-auto flex-1 pr-0.5">
            {filteredConcepts.length === 0 ? (
              <div className="text-center py-10 px-4 text-foreground-muted space-y-1.5 select-none">
                <p className="text-sm font-medium text-foreground">No concepts found</p>
                <p className="text-xs text-foreground-muted leading-relaxed max-w-[240px] mx-auto">
                  Take quizzes or explore technical branches to populate your profile.
                </p>
              </div>
            ) : (
              filteredConcepts.map((c) => {
                const confPct = Math.round(c.confidenceScore * 100);
                return (
                  <div
                    key={c.id}
                    className="p-3.5 rounded-2xl bg-surface border border-border hover:border-border-strong transition-all group flex items-center justify-between shadow-xs"
                  >
                    <div className="min-w-0 pr-3 flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-sm font-medium text-foreground truncate">
                          {c.name}
                        </span>
                        <Badge
                          variant={
                            c.masteryLevel === "mastered"
                              ? "default"
                              : c.masteryLevel === "quizzed"
                              ? "secondary"
                              : "outline"
                          }
                          className="rounded-full px-2 py-0.5 text-2xs font-medium capitalize"
                        >
                          {c.masteryLevel}
                        </Badge>
                      </div>

                      <div className="flex items-center space-x-2.5">
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300 bg-foreground"
                            style={{ width: `${Math.max(confPct, 5)}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-foreground-muted shrink-0">
                          {confPct}%
                        </span>
                      </div>
                    </div>

                    {onQuizConcept && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => onQuizConcept(c.name)}
                        className="opacity-0 group-hover:opacity-100 h-8 w-8 rounded-lg text-foreground-muted hover:text-foreground cursor-pointer shrink-0"
                        title={`Practice ${c.name}`}
                      >
                        <Zap className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
