"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Sparkles,
  CheckCircle2,
  Clock,
  BookOpen,
  RefreshCw,
  Search,
  Zap,
} from "lucide-react";
import { WorkspaceMasterySummary } from "@graphmind/shared";
import { getWorkspaceMastery } from "@/lib/workspaceApi";

interface MasteryPanelProps {
  workspaceId: string;
  onQuizConcept?: (conceptName: string) => void;
}

export function MasteryPanel({
  workspaceId,
  onQuizConcept,
}: MasteryPanelProps) {
  const [summary, setSummary] = useState<WorkspaceMasterySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const loadSummary = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const data = await getWorkspaceMastery(workspaceId);
      setSummary(data);
    } catch (err) {
      console.warn("Failed to load workspace mastery summary:", err);
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

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-2 text-zinc-400">
        <RefreshCw className="w-5 h-5 animate-spin text-purple-600" />
        <span className="text-xs">Loading Knowledge Profile...</span>
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

  const concepts = summary?.concepts ?? [];
  const filteredConcepts = searchQuery.trim()
    ? concepts.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : concepts;

  return (
    <div className="flex-1 flex flex-col space-y-4 overflow-y-auto pr-1">
      {/* Overall Mastery Score Card */}
      <div className="p-4 rounded-2xl bg-white border border-zinc-200/80 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-zinc-900">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Mastery Score</span>
          </div>
          <span className="text-lg font-bold text-zinc-950">{overallPct}%</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 rounded-full bg-zinc-100 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-emerald-500 transition-all duration-500 rounded-full"
            style={{ width: `${Math.max(overallPct, 4)}%` }}
          />
        </div>

        {/* Distribution Badges */}
        <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
          <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-100">
            <span className="flex items-center space-x-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Mastered</span>
            </span>
            <span className="font-semibold">{distribution.mastered}</span>
          </div>

          <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-purple-50 text-purple-900 border border-purple-100">
            <span className="flex items-center space-x-1">
              <Sparkles className="w-3 h-3 text-purple-600" />
              <span>Quizzed</span>
            </span>
            <span className="font-semibold">{distribution.quizzed}</span>
          </div>

          <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-sky-50 text-sky-900 border border-sky-100">
            <span className="flex items-center space-x-1">
              <BookOpen className="w-3 h-3 text-sky-600" />
              <span>Explored</span>
            </span>
            <span className="font-semibold">{distribution.explored}</span>
          </div>

          <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-100">
            <span className="flex items-center space-x-1">
              <Clock className="w-3 h-3 text-amber-600" />
              <span>Stale</span>
            </span>
            <span className="font-semibold">{distribution.stale}</span>
          </div>
        </div>
      </div>

      {/* Review Recommendations (if any) */}
      {summary?.needingReview && summary.needingReview.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold text-zinc-900">
              Needs Retention Review
            </h3>
            <span className="text-[11px] text-amber-600 font-medium">
              {summary.needingReview.length} concepts
            </span>
          </div>

          <div className="space-y-1.5">
            {summary.needingReview.slice(0, 3).map((concept) => (
              <div
                key={concept.id}
                className="p-2.5 rounded-xl border border-amber-200/80 bg-amber-50/40 flex items-center justify-between group"
              >
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-semibold text-zinc-900 truncate">
                    {concept.name}
                  </p>
                  <p className="text-[10.5px] text-zinc-500">
                    Confidence: {Math.round(concept.confidenceScore * 100)}%
                  </p>
                </div>

                {onQuizConcept && (
                  <button
                    type="button"
                    onClick={() => onQuizConcept(concept.name)}
                    className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100/60 text-[11px] font-medium transition-colors cursor-pointer shrink-0 shadow-2xs"
                    title={`Practice ${concept.name}`}
                  >
                    <Zap className="w-3 h-3 text-amber-600 fill-amber-500" />
                    <span>Quiz</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Concepts List & Search */}
      <div className="space-y-2 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-semibold text-zinc-900">
            Tracked Concepts ({concepts.length})
          </h3>
        </div>

        {/* Filter Input */}
        {concepts.length > 4 && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter concepts..."
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl bg-white border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
          </div>
        )}

        {/* List */}
        <div className="space-y-1.5 overflow-y-auto flex-1">
          {filteredConcepts.length === 0 ? (
            <div className="text-center py-6 px-3 text-zinc-400 space-y-1">
              <p className="text-xs">No concepts recorded yet</p>
              <p className="text-[11px] leading-relaxed">
                Take quizzes or explore technical branches to populate your profile.
              </p>
            </div>
          ) : (
            filteredConcepts.map((c) => {
              const confPct = Math.round(c.confidenceScore * 100);
              const badgeBg =
                c.masteryLevel === "mastered"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : c.masteryLevel === "quizzed"
                  ? "bg-purple-50 text-purple-800 border-purple-200"
                  : c.masteryLevel === "stale"
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : "bg-zinc-100 text-zinc-700 border-zinc-200";

              return (
                <div
                  key={c.id}
                  className="p-2.5 rounded-xl bg-white border border-zinc-200/70 hover:border-zinc-300 transition-colors group flex items-center justify-between shadow-2xs"
                >
                  <div className="min-w-0 pr-2 flex-1">
                    <div className="flex items-center space-x-1.5 mb-1">
                      <span className="text-xs font-semibold text-zinc-900 truncate">
                        {c.name}
                      </span>
                      <span
                        className={`text-[9.5px] px-1.5 py-0.2 rounded-md font-medium border uppercase tracking-wider ${badgeBg}`}
                      >
                        {c.masteryLevel}
                      </span>
                    </div>

                    {/* Mini Confidence Bar */}
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            c.confidenceScore >= 0.8
                              ? "bg-emerald-500"
                              : c.confidenceScore >= 0.5
                              ? "bg-purple-500"
                              : "bg-sky-500"
                          }`}
                          style={{ width: `${Math.max(confPct, 5)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                        {confPct}%
                      </span>
                    </div>
                  </div>

                  {onQuizConcept && (
                    <button
                      type="button"
                      onClick={() => onQuizConcept(c.name)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-400 hover:text-purple-700 hover:bg-purple-50 transition-all cursor-pointer shrink-0"
                      title={`Quiz me on ${c.name}`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
