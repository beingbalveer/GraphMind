"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { CurriculumView, CurriculumItemData } from "@/lib/roadmapTypes";
import {
  curriculumChildren,
  selectedCoreTopics,
} from "@/lib/canvas/curriculumProjection";
import { CapacityWarning } from "./CapacityWarning";
import { RoadmapActions } from "./RoadmapActions";
import { RoadmapCanvas } from "./RoadmapCanvas";
import { TopicRow } from "./TopicRow";
import { MilestoneCard } from "./MilestoneCard";
import { CurriculumGroup } from "./CurriculumGroup";
import { SourcesList } from "./SourcesList";
export function RoadmapWorkspace({
  view,
  mode,
  onOpenTopic,
  onStartTopic,
  opening = false,
  actionError,
  onSaved,
  onReload,
}: {
  view: CurriculumView;
  mode: "page" | "canvas";
  onOpenTopic?: (id: string) => void;
  onStartTopic?: (id: string) => void;
  opening?: boolean;
  actionError?: string | null;
  onSaved?: (view: CurriculumView) => void;
  onReload?: () => Promise<void>;
}) {
  const topics = selectedCoreTopics(view);
  const next = topics.find((i) => view.progress[i.id]?.status !== "completed");
  const [expanded, setExpanded] = useState(() => {
    const ids = new Set<string>();
    let id = next?.id;
    while (id) {
      const parent = view.candidate.relations.find(
        (r) => r.kind === "contains" && r.targetId === id,
      )?.sourceId;
      if (!parent) break;
      ids.add(parent);
      id = parent;
    }
    return ids;
  });
  const toggle = (id: string) =>
    setExpanded((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const renderItem = (
    item: CurriculumItemData,
    includeFurther = false,
  ): React.ReactNode => {
    if (item.kind === "topic")
      return (
        <TopicRow
          key={item.id}
          topic={item}
          progress={view.progress[item.id]}
          onOpen={onOpenTopic}
        />
      );
    const children = curriculumChildren(view, item.id).filter(
      (child) => includeFurther || child.path === "core",
    );
    const choice = view.candidate.choices.find((c) => c.choiceId === item.id);
    const content = (
      <>
        {choice && (
          <p className="px-2 text-xs text-foreground-muted">
            {choice.rationale}
          </p>
        )}
        {children
          .filter((child) => !choice || child.id === choice.selectedId)
          .map((child) => renderItem(child, includeFurther))}
        {choice && (
          <CurriculumGroup
            id={`${item.id}-alternatives`}
            title="Other options"
            open={expanded.has(`${item.id}-alternatives`)}
            onToggle={() => toggle(`${item.id}-alternatives`)}
          >
            {children
              .filter((c) => c.id !== choice.selectedId)
              .map((child) => renderItem(child, includeFurther))}
          </CurriculumGroup>
        )}
      </>
    );
    const descendants = new Set<string>();
    const collect = (id: string) =>
      curriculumChildren(view, id).forEach((child) => {
        if (descendants.has(child.id)) return;
        descendants.add(child.id);
        collect(child.id);
      });
    if (item.kind === "phase") collect(item.id);
    const sessions = view.profile.weeklyMinutes
      ? view.candidate.sessions.filter((session) =>
          descendants.has(session.topicId),
        )
      : [];
    const weekly = sessions.length ? (
      <div className="space-y-4">
        {[...new Set(sessions.map((session) => session.week))]
          .sort((a, b) => a - b)
          .map((week) => (
            <div key={week}>
              <h3 className="mb-1 text-xs font-medium text-foreground-subtle">
                Week {week}
              </h3>
              {sessions
                .filter((session) => session.week === week)
                .map((session) => {
                  const topic = view.candidate.items.find(
                    (i) => i.id === session.topicId,
                  )!;
                  const split =
                    view.candidate.sessions.filter(
                      (s) => s.topicId === topic.id,
                    ).length > 1;
                  return (
                    <TopicRow
                      key={`${session.topicId}-${session.sequence}`}
                      topic={topic}
                      progress={view.progress[topic.id]}
                      onOpen={onOpenTopic}
                      effortMinutes={session.minutes}
                      sessionSequence={split ? session.sequence : undefined}
                    />
                  );
                })}
            </div>
          ))}
        {view.candidate.choices
          .filter((choice) => descendants.has(choice.choiceId))
          .map((choice) => (
            <CurriculumGroup
              key={choice.choiceId}
              id={`${choice.choiceId}-weekly-options`}
              title="Other options"
              open={expanded.has(`${choice.choiceId}-weekly-options`)}
              onToggle={() => toggle(`${choice.choiceId}-weekly-options`)}
            >
              <p className="mb-2 text-xs text-foreground-muted">
                {choice.rationale}
              </p>
              {curriculumChildren(view, choice.choiceId)
                .filter((i) => i.id !== choice.selectedId)
                .map((i) => renderItem(i))}
            </CurriculumGroup>
          ))}
      </div>
    ) : null;
    if (item.kind === "phase")
      return (
        <MilestoneCard
          key={item.id}
          phase={item}
          ordinal={
            view.candidate.items
              .filter((i) => i.kind === "phase" && i.participation === "active")
              .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
              .findIndex((i) => i.id === item.id) + 1
          }
          open={expanded.has(item.id)}
          onToggle={() => toggle(item.id)}
        >
          {weekly ?? content}
        </MilestoneCard>
      );
    return (
      <CurriculumGroup
        key={item.id}
        id={item.id}
        title={item.title}
        open={expanded.has(item.id)}
        onToggle={() => toggle(item.id)}
      >
        {content}
      </CurriculumGroup>
    );
  };
  if (mode === "canvas")
    return (
      <div className="relative h-full w-full">
        <RoadmapCanvas view={view} onOpenTopic={onOpenTopic} />
        <div className="absolute bottom-4 left-4 max-w-sm">
          <CapacityWarning
            validation={view.validation}
            onReview={
              onOpenTopic && topics[0]
                ? () => onOpenTopic(topics[0].id)
                : undefined
            }
          />
        </div>
        {onSaved && (
          <div className="absolute right-4 top-4">
            <RoadmapActions view={view} onSaved={onSaved} onReload={onReload} />
          </div>
        )}
      </div>
    );
  const root = view.candidate.items.find((i) => i.kind === "root");
  const children = root ? curriculumChildren(view, root.id) : [];
  const completed = topics.filter(
    (i) => view.progress[i.id]?.status === "completed",
  ).length;
  return (
    <main className="h-full w-full overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-3xl space-y-6 px-5 py-8 sm:px-8 sm:py-10">
        <div className="space-y-3">
          <p className="text-xs capitalize text-foreground-subtle">
            {view.profile.level} ·{" "}
            {Math.round((view.validation.coreMinutes / 60) * 10) / 10} hours of
            core learning
            {view.profile.weeklyMinutes
              ? ` · ${view.profile.weeklyMinutes / 60} hours/week`
              : " · Self paced"}
          </p>
          {onSaved && (
            <div className="float-right">
              <RoadmapActions
                view={view}
                onSaved={onSaved}
                onReload={onReload}
              />
            </div>
          )}
          <h1 className="font-roadmap-display text-2xl font-normal leading-tight text-foreground sm:text-roadmap-title">
            {view.candidate.title}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-foreground-muted">
            {view.candidate.outcome}
          </p>
          <p className="text-xs text-foreground-muted">
            {completed} of {topics.length} topics completed
          </p>
          {next && onStartTopic && (
            <Button disabled={opening} onClick={() => onStartTopic(next.id)}>
              {opening
                ? "Opening lesson…"
                : completed || view.progress[next.id]?.status === "in_progress"
                  ? "Continue learning"
                  : "Start learning"}
            </Button>
          )}
          {!next && (
            <p className="text-sm text-foreground-muted">
              Core path completed. Explore further learning when you’re ready.
            </p>
          )}
        </div>
        <CapacityWarning
          validation={view.validation}
          onReview={
            onOpenTopic && topics[0]
              ? () => onOpenTopic(topics[0].id)
              : undefined
          }
        />
        {actionError && (
          <p role="alert" className="text-xs text-destructive">
            {actionError}
          </p>
        )}
        <div className="space-y-3">
          {children.filter((i) => i.path === "core").map((i) => renderItem(i))}
        </div>
        <CurriculumGroup
          id="further-learning"
          title="Further learning"
          open={expanded.has("further-learning")}
          onToggle={() => toggle("further-learning")}
        >
          {view.candidate.items
            .filter(
              (i) =>
                i.path === "further" &&
                i.participation === "active" &&
                !view.candidate.relations.some(
                  (r) =>
                    r.kind === "contains" &&
                    r.targetId === i.id &&
                    view.candidate.items.find(
                      (parent) => parent.id === r.sourceId,
                    )?.path === "further",
                ),
            )
            .map((i) => renderItem(i, true))}
        </CurriculumGroup>
        <CurriculumGroup
          id="about-plan"
          title="About this plan"
          open={expanded.has("about-plan")}
          onToggle={() => toggle("about-plan")}
        >
          <div className="space-y-4 px-2">
            {view.candidate.assumptions.map((a, i) => (
              <p key={i} className="text-xs text-foreground-muted">
                {a}
              </p>
            ))}
            {view.validation.issues.map((issue, i) => (
              <p key={i} className="text-xs text-foreground-muted">
                {issue.message}
              </p>
            ))}
            <SourcesList sources={view.sources} />
          </div>
        </CurriculumGroup>
      </div>
    </main>
  );
}
