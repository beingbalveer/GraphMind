"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { CurriculumView, CurriculumItemData } from "@/lib/roadmapTypes";
import {
  curriculumChildren,
  selectedCoreTopics,
} from "@/lib/canvas/curriculumProjection";
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
}: {
  view: CurriculumView;
  mode: "page" | "canvas";
  onOpenTopic?: (id: string) => void;
  onStartTopic?: (id: string) => void;
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
    if (item.kind === "phase")
      return (
        <MilestoneCard
          key={item.id}
          phase={item}
          open={expanded.has(item.id)}
          onToggle={() => toggle(item.id)}
        >
          {content}
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
    return <RoadmapCanvas view={view} onOpenTopic={onOpenTopic} />;
  const root = view.candidate.items.find((i) => i.kind === "root");
  const children = root ? curriculumChildren(view, root.id) : [];
  const completed = topics.filter(
    (i) => view.progress[i.id]?.status === "completed",
  ).length;
  return (
    <main className="h-full overflow-y-auto bg-background">
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
            <Button onClick={() => onStartTopic(next.id)}>
              {completed ? "Continue learning" : "Start learning"}
            </Button>
          )}
          {!next && (
            <p className="text-sm text-foreground-muted">
              Core path completed. Explore further learning when you’re ready.
            </p>
          )}
        </div>
        <div className="space-y-3">
          {children.filter((i) => i.path === "core").map((i) => renderItem(i))}
        </div>
        {view.profile.weeklyMinutes && view.candidate.sessions.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium">Weekly milestones</h2>
            {[...new Set(view.candidate.sessions.map((s) => s.week))]
              .sort((a, b) => a - b)
              .map((week) => (
                <div
                  key={week}
                  className="rounded-xl border border-border bg-surface p-4"
                >
                  <h3 className="mb-2 text-sm font-medium">Week {week}</h3>
                  {view.candidate.sessions
                    .filter((s) => s.week === week)
                    .sort((a, b) => a.sequence - b.sequence)
                    .map((s) => (
                      <p
                        key={`${s.topicId}-${s.sequence}`}
                        className="py-1 text-xs text-foreground-muted"
                      >
                        {
                          view.candidate.items.find((i) => i.id === s.topicId)
                            ?.title
                        }{" "}
                        · {s.minutes} min · Session {s.sequence + 1}
                      </p>
                    ))}
                </div>
              ))}
          </section>
        )}
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
