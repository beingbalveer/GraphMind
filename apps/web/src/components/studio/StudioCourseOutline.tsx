"use client";

import React, { useMemo } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { CurriculumItemData, CurriculumView } from "@/lib/roadmapTypes";
import { cn } from "@/lib/utils";

export interface StudioCourseOutlineProps {
  view: CurriculumView;
  activeTopicId?: string | null;
  onSelectTopic: (topicId: string) => void;
  className?: string;
}

interface OutlinePhase {
  phaseItem?: CurriculumItemData;
  topics: CurriculumItemData[];
}

/**
 * StudioCourseOutline — Renders the structured phased outline for the course rail.
 * Exclusively uses real server-provided CurriculumView (zero fixture fallback).
 * Uses semantic tokens and accessible indicators.
 */
export function StudioCourseOutline({
  view,
  activeTopicId,
  onSelectTopic,
  className,
}: StudioCourseOutlineProps) {
  const { phases, totalTopics } = useMemo(() => {
    const items = view.candidate.items || [];
    const relations = view.candidate.relations || [];

    // Find all phases and active topics
    const phaseItems = items.filter((item) => item.kind === "phase");
    const activeTopics = items.filter(
      (item) => item.kind === "topic" && item.participation !== "archived"
    );

    // Map relations: phase -> topics (contains)
    const topicToPhase = new Map<string, string>();
    for (const rel of relations) {
      if (rel.kind === "contains") {
        topicToPhase.set(rel.targetId, rel.sourceId);
      }
    }

    let phaseList: OutlinePhase[] = [];

    if (phaseItems.length > 0) {
      phaseList = phaseItems
        .sort((a, b) => a.order - b.order)
        .map((phase) => {
          const topics = activeTopics
            .filter((t) => topicToPhase.get(t.id) === phase.id)
            .sort((a, b) => a.order - b.order);
          return { phaseItem: phase, topics };
        })
        .filter((p) => p.topics.length > 0);

      // Collect any unassigned active topics into a fallback phase
      const assignedIds = new Set(phaseList.flatMap((p) => p.topics.map((t) => t.id)));
      const unassigned = activeTopics.filter((t) => !assignedIds.has(t.id));
      if (unassigned.length > 0) {
        phaseList.push({
          phaseItem: undefined,
          topics: unassigned.sort((a, b) => a.order - b.order),
        });
      }
    } else {
      // No phases defined: single flat list
      phaseList = [
        {
          phaseItem: undefined,
          topics: activeTopics.sort((a, b) => a.order - b.order),
        },
      ];
    }

    let done = 0;
    for (const t of activeTopics) {
      if (view.progress[t.id]?.status === "completed") {
        done++;
      }
    }

    return {
      phases: phaseList,
      totalTopics: activeTopics.length,
      completedCount: done,
    };
  }, [view]);

  if (totalTopics === 0) {
    return (
      <div
        data-testid="studio-outline-empty"
        className="p-4 text-xs text-foreground-muted text-center"
      >
        No topics defined for this curriculum.
      </div>
    );
  }

  return (
    <nav
      data-testid="studio-course-outline"
      aria-label="Course outline"
      className={cn("space-y-4 p-1", className)}
    >
      {phases.map((phaseGroup, phaseIdx) => (
        <div key={phaseGroup.phaseItem?.id || `phase-${phaseIdx}`} className="space-y-1">
          {phaseGroup.phaseItem && (
            <h3 className="px-2 pt-2 pb-1 text-2xs font-semibold uppercase tracking-wider text-foreground-muted">
              {phaseGroup.phaseItem.title}
            </h3>
          )}
          <div className="space-y-0.5">
            {phaseGroup.topics.map((topic) => {
              const isCompleted = view.progress[topic.id]?.status === "completed";
              const isActive = activeTopicId === topic.id;

              return (
                <button
                  key={topic.id}
                  data-testid={`outline-topic-${topic.id}`}
                  onClick={() => onSelectTopic(topic.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors",
                    isActive
                      ? "bg-surface-hover text-foreground font-medium shadow-xs"
                      : "text-foreground-muted hover:bg-surface-hover/60 hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    {isCompleted ? (
                      <CheckCircle2
                        data-testid={`topic-done-${topic.id}`}
                        className="size-3.5 text-success shrink-0"
                      />
                    ) : (
                      <Circle
                        data-testid={`topic-todo-${topic.id}`}
                        className="size-3.5 text-foreground-subtle shrink-0"
                      />
                    )}
                    <span className="truncate leading-tight">
                      {topic.title}
                    </span>
                  </div>
                  {topic.estimateMinutes && (
                    <span className="text-2xs text-foreground-subtle shrink-0">
                      {topic.estimateMinutes}m
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
