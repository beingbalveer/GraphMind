"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import type { CanvasItem } from "@/lib/canvas/types";

interface CanvasCardProps {
  item: CanvasItem;
  selected: boolean;
  streaming: boolean;
  onSelect: (id: string) => void;
  compact?: boolean;
  expanded?: boolean;
  completed?: boolean;
}

/** One accessible selection surface shared by conversation and curriculum nodes. */
export function CanvasCard({
  item,
  selected,
  streaming,
  onSelect,
  compact = false,
  expanded,
  completed,
}: CanvasCardProps) {
  return (
    <Button
      variant="ghost"
      aria-label={item.title.replace(/\s+/g, " ").trim()}
      aria-pressed={selected}
      aria-description={item.summary}
      title={compact ? item.summary : undefined}
      aria-expanded={expanded}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(item.selectionId);
      }}
      className={cn(
        "w-full min-w-0 flex-col whitespace-normal border",
        compact
          ? "h-16 items-center justify-center gap-1 rounded-lg p-2 text-center"
          : "h-32 items-start justify-start gap-2 rounded-xl p-3 text-left shadow-2xs",
        item.lane === "spine" ? "bg-canvas-milestone" : "bg-canvas-topic",
        selected ? "border-foreground" : "border-border",
      )}
    >
      <span className="flex w-full items-center justify-center gap-1">
        <span
          className={cn(
            "line-clamp-2 break-words text-sm font-medium text-foreground",
            compact ? "leading-4" : "w-full leading-5",
          )}
        >
          {item.title}
        </span>
        {completed && (
          <Check aria-hidden className="size-3 shrink-0 text-success" />
        )}
        {compact &&
          expanded !== undefined &&
          (expanded ? (
            <ChevronDown aria-hidden className="size-3 shrink-0" />
          ) : (
            <ChevronRight aria-hidden className="size-3 shrink-0" />
          ))}
      </span>
      {!compact && item.summary && (
        <span className="canvas-card-summary line-clamp-2 w-full break-words text-xs font-normal leading-4 text-foreground-muted">
          {item.summary}
        </span>
      )}
      {(!compact || item.metaLabel) && (
        <span
          className={cn(
            "canvas-card-meta flex w-full items-center text-2xs font-normal text-foreground-muted",
            compact ? "justify-center leading-3" : "mt-auto justify-between",
          )}
        >
          <span>
            {item.kind === "conversation"
              ? `${item.itemIds.length} ${item.itemIds.length === 1 ? "message" : "messages"}`
              : (item.metaLabel ?? item.kind)}
          </span>
          {streaming && <span role="status">Writing…</span>}
        </span>
      )}
    </Button>
  );
}
