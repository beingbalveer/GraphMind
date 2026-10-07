"use client";

import React, { memo, useState } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CanvasCard } from "./CanvasCard";
import type { CanvasItem } from "@/lib/canvas/types";
import type { ConversationThread } from "@/lib/threadUtils";
import type { ConceptMasteryLevel } from "@graphmind/shared";

// Retain old projection type exports while its compatibility facade is available.
export type ZoomMode = "orb" | "capsule" | "detailed";
export interface ThreadMasteryInfo { level: ConceptMasteryLevel; score: number; primaryConcept?: string; totalConcepts?: number }
export interface ThreadNodeData extends Record<string, unknown> {
  thread: ConversationThread; zoomMode?: ZoomMode;
  onSelectThread?: (threadId: string) => void; onDeleteThread?: (threadId: string) => void;
  masteryInfo?: ThreadMasteryInfo; isHeatmapMode?: boolean;
}

export function ConversationCanvasCard({ item, selected, streaming, onSelect, onDelete, mastery }: {
  item: CanvasItem; selected: boolean; streaming: boolean;
  onSelect: (id: string) => void; onDelete?: (id: string) => void; mastery?: ThreadMasteryInfo;
}) {
  const [confirm, setConfirm] = useState(false);
  return <div className="relative">
    <CanvasCard item={item} selected={selected} streaming={streaming} onSelect={onSelect} />
    {onDelete && item.lane === "side" && <div className="nodrag absolute right-1 top-1" onClick={event => event.stopPropagation()}>
      <DropdownMenu trigger={<Button variant="ghost" size="iconSm" aria-label={`Actions for ${item.title}`}><MoreHorizontal /></Button>}
        items={[{ label: "Delete branch", icon: <Trash2 className="size-3.5" />, variant: "destructive", onClick: () => setConfirm(true) }]} />
    </div>}
    {mastery && <div className="pointer-events-none absolute bottom-3 right-3 max-w-3/5">
      <Badge variant={mastery.level === "mastered" ? "success" : mastery.level === "stale" ? "warning" : "secondary"}>
        {mastery.primaryConcept && <span className="truncate">{mastery.primaryConcept}</span>}
        <span>{mastery.level}</span><span>{Math.round(mastery.score * 100)}%</span>
      </Badge>
    </div>}
    <ConfirmDialog isOpen={confirm} onClose={() => setConfirm(false)} title="Delete branch?"
      description="This deletes this conversation branch and its nested branches. The main conversation stays available."
      confirmText="Delete branch" onConfirm={() => { if (onDelete) onDelete(item.threadId ?? item.selectionId); }} />
  </div>;
}

/** Compatibility renderer adopts the same cards; zoom never changes node identity. */
export const ThreadGraphNode = memo(function ThreadGraphNode({ data, targetPosition = Position.Top,
  sourcePosition = Position.Bottom }: NodeProps<Node<ThreadNodeData>>) {
  const { thread } = data;
  const item: CanvasItem = { id: `segment:${thread.id}`, kind: "conversation", title: thread.title,
    summary: thread.messages.at(-1)?.content.slice(0, 240), itemIds: thread.messages.map(message => message.id),
    selectionId: thread.leafNodeId, lane: thread.parentThreadId ? "side" : "spine",
    parentId: thread.parentThreadId ?? null, originId: thread.sourceMessageId ?? null, order: 0, threadId: thread.id };
  return <div className="w-72">
    <Handle type="target" position={targetPosition} className="!size-1 !bg-canvas-connector" />
    <ConversationCanvasCard item={item} selected={thread.isActive} streaming={Boolean(thread.isStreaming)}
      onSelect={id => data.onSelectThread?.(id)} onDelete={data.onDeleteThread}
      mastery={data.isHeatmapMode ? data.masteryInfo : undefined} />
    <Handle type="source" position={sourcePosition} className="!size-1 !bg-canvas-connector" />
  </div>;
});
