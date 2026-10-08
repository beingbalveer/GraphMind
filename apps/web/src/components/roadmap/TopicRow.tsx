"use client";
import { Check, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CurriculumItemData, TopicProgressData } from "@/lib/roadmapTypes";
export function TopicRow({
  topic,
  progress,
  onOpen,
  effortMinutes = topic.estimateMinutes,
  sessionSequence,
}: {
  topic: CurriculumItemData;
  progress?: TopicProgressData;
  onOpen?: (id: string) => void;
  effortMinutes?: number | null;
  sessionSequence?: number;
}) {
  const content = (
    <>
      <span
        className="flex size-4 shrink-0 items-center justify-center rounded-full border border-border text-foreground-muted"
        aria-label={
          progress?.status === "completed" ? "Completed" : "Not completed"
        }
      >
        {progress?.status === "completed" && <Check className="size-3" />}
      </span>
      <span className="min-w-0 flex-1 text-sm font-normal text-foreground">
        {topic.title}
      </span>
      <span className="shrink-0 text-xs font-normal text-foreground-subtle">
        {effortMinutes ? `${effortMinutes} min` : "Self paced"}
        {sessionSequence !== undefined
          ? ` · Session ${sessionSequence + 1}`
          : ""}
        {progress?.status === "in_progress" ? " · In progress" : ""}
      </span>
      {onOpen && (
        <ArrowUpRight className="size-3 shrink-0 text-foreground-muted" />
      )}
    </>
  );
  const className =
    "flex h-auto w-full items-center justify-start gap-3 whitespace-normal rounded-none border-b border-border-subtle px-1 py-3 text-left last:border-b-0";
  return onOpen ? (
    <Button
      variant="ghost"
      className={className}
      aria-label={`Open ${topic.title}`}
      onClick={() => onOpen(topic.id)}
    >
      {content}
    </Button>
  ) : (
    <div className={className}>{content}</div>
  );
}
