"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CanvasItem } from "@/lib/canvas/types";

interface CanvasCardProps {
  item: CanvasItem;
  selected: boolean;
  streaming: boolean;
  onSelect: (id: string) => void;
}

/** One accessible selection surface shared by conversation and curriculum nodes. */
export function CanvasCard({ item, selected, streaming, onSelect }: CanvasCardProps) {
  return (
    <Button variant="ghost" aria-label={item.title.replace(/\s+/g, " ").trim()} aria-pressed={selected}
      onClick={(event) => { event.stopPropagation(); onSelect(item.selectionId); }}
      className={cn("nodrag h-auto min-h-24 w-full min-w-0 flex-col items-start justify-start gap-2 whitespace-normal rounded-xl border p-3 text-left shadow-2xs",
        item.lane === "spine" ? "bg-canvas-milestone" : "bg-canvas-topic",
        selected ? "border-foreground" : "border-border")}
    >
      <span className="line-clamp-2 w-full break-words text-sm font-medium leading-5 text-foreground">{item.title}</span>
      {item.summary && <span className="line-clamp-2 w-full break-words text-xs font-normal leading-5 text-foreground-muted">{item.summary}</span>}
      <span className="flex w-full items-center justify-between text-2xs font-normal text-foreground-subtle">
        <span>{item.kind === "conversation" ? `${item.itemIds.length} ${item.itemIds.length === 1 ? "message" : "messages"}` : item.kind}</span>
        {streaming && <span role="status">Writing…</span>}
      </span>
    </Button>
  );
}
