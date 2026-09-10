"use client";

import React, { memo, useState } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import {
  FileText,
  GitBranch,
  Loader2,
  Trash2,
  MoreVertical,
} from "lucide-react";
import { ConversationThread } from "@/lib/threadUtils";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { ConceptMasteryLevel } from "@graphmind/shared";

export type ZoomMode = "orb" | "capsule" | "detailed";

export interface ThreadMasteryInfo {
  level: ConceptMasteryLevel;
  score: number;
  primaryConcept?: string;
  totalConcepts?: number;
}

export interface ThreadNodeData {
  thread: ConversationThread;
  zoomMode?: ZoomMode;
  onSelectThread?: (threadId: string) => void;
  onDeleteThread?: (threadId: string) => void;
  masteryInfo?: ThreadMasteryInfo;
  isHeatmapMode?: boolean;
  [key: string]: unknown;
}

export const ThreadGraphNode = memo(function ThreadGraphNode({
  data,
  targetPosition = Position.Left,
  sourcePosition = Position.Right,
}: NodeProps<Node<ThreadNodeData>>) {
  const { thread, zoomMode = "capsule", masteryInfo, isHeatmapMode = false } = data;
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isRoot = !thread.parentThreadId;
  const isActive = thread.isActive;
  const isStreaming = thread.isStreaming;
  const messageCount = thread.messages.length;
  const lastMessage = thread.messages[thread.messages.length - 1];

  const handleClasses =
    "!w-2 !h-2 !bg-foreground-subtle !border !border-surface hover:!bg-foreground transition-colors";

  /* =========================================================================
     1. GALAXY ORB VIEW (Zoom < 0.6x - Obsidian Style Note Orb)
     ========================================================================= */
  if (zoomMode === "orb") {
    return (
      <div
        className={`group relative flex items-center justify-center transition-all duration-200 cursor-pointer ${
          isActive ? "scale-125 z-30" : "hover:scale-115 z-10"
        }`}
        title={`${thread.title} (${messageCount} message${messageCount > 1 ? "s" : ""})`}
      >
        {!isRoot && (
          <Handle
            type="target"
            position={targetPosition}
            className={`${handleClasses} !opacity-0 group-hover:!opacity-100`}
          />
        )}

        {/* Circular Note Orb */}
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shadow-xs transition-all ${
            isStreaming
              ? "bg-primary text-primary-foreground ring-4 ring-primary/30 animate-pulse"
              : isActive
              ? "bg-primary text-primary-foreground ring-4 ring-primary/20 shadow-md"
              : isHeatmapMode && masteryInfo
              ? masteryInfo.level === "mastered"
                ? "bg-success text-success-foreground ring-4 ring-success/30"
                : masteryInfo.level === "quizzed"
                ? "bg-foreground text-background ring-4 ring-foreground/20"
                : masteryInfo.level === "stale"
                ? "bg-warning text-warning-foreground ring-4 ring-warning/30"
                : "bg-info text-info-foreground ring-4 ring-info/30"
              : isRoot
              ? "bg-primary text-primary-foreground border border-border"
              : "bg-surface text-foreground hover:bg-surface-hover border border-border shadow-xs"
          }`}
        >
          {isStreaming ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isRoot ? (
            <FileText className="w-3.5 h-3.5" />
          ) : (
            <GitBranch className="w-3.5 h-3.5 text-foreground-muted" />
          )}
        </div>

        {/* Floating Tooltip on Hover in Orb Mode */}
        <div className="absolute left-1/2 -top-8 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 bg-foreground text-background text-2xs font-medium px-2.5 py-1 rounded-lg whitespace-nowrap shadow-md z-40 max-w-[200px] truncate flex items-center space-x-1.5">
          <span>{thread.title}</span>
          <span className="text-2xs opacity-75 font-mono">({messageCount})</span>
        </div>

        <Handle
          type="source"
          position={sourcePosition}
          className={`${handleClasses} !opacity-0 group-hover:!opacity-100`}
        />
      </div>
    );
  }

  /* =========================================================================
     2. OBSIDIAN NOTE CAPSULE VIEW (Standard & Detailed Zoom >= 0.6x)
     ========================================================================= */
  const isDetailed = zoomMode === "detailed";

  return (
    <div
      className={`group relative flex flex-col min-w-[180px] max-w-[260px] p-2.5 rounded-2xl border transition-all duration-150 select-none cursor-pointer shadow-xs ${
        isStreaming
          ? "bg-surface border-foreground ring-2 ring-foreground/20 shadow-md animate-pulse z-20"
          : isActive
          ? "bg-surface border-foreground ring-2 ring-foreground/15 shadow-md z-10"
          : isHeatmapMode && masteryInfo
          ? masteryInfo.level === "mastered"
            ? "bg-surface border-success ring-1 ring-success/30 shadow-[0_0_16px_rgba(16,185,129,0.14)] text-foreground"
            : masteryInfo.level === "quizzed"
            ? "bg-surface border-foreground ring-1 ring-foreground/30 shadow-xs text-foreground"
            : masteryInfo.level === "stale"
            ? "bg-surface border-warning ring-1 ring-warning/30 shadow-[0_0_16px_rgba(245,158,11,0.14)] text-foreground"
            : "bg-surface border-info ring-1 ring-info/20 shadow-[0_0_16px_rgba(14,165,233,0.14)] text-foreground"
          : isRoot
          ? "bg-surface-raised border-border-strong text-foreground hover:border-border"
          : "bg-surface border-border text-foreground hover:border-border-strong hover:shadow-xs"
      }`}
    >
      {/* Heatmap Mastery Pill */}
      {isHeatmapMode && masteryInfo && (
        <div
          className={`flex items-center justify-between px-2 py-0.5 mb-2 rounded-lg text-2xs font-semibold border select-none ${
            masteryInfo.level === "mastered"
              ? "bg-success-bg text-success border-success/30"
              : masteryInfo.level === "quizzed"
              ? "bg-muted text-foreground border-border"
              : masteryInfo.level === "stale"
              ? "bg-warning-bg text-warning border-warning/30"
              : "bg-info-bg text-info border-info/30"
          }`}
        >
          <span className="truncate max-w-[140px]">
            {masteryInfo.primaryConcept || masteryInfo.level.toUpperCase()}
          </span>
          <span className="font-mono ml-1">
            {Math.round(masteryInfo.score * 100)}%
          </span>
        </div>
      )}

      {!isRoot && (
        <Handle
          type="target"
          position={targetPosition}
          className={handleClasses}
        />
      )}

      {/* Note Header (Icon + Title + Message Count) */}
      <div className="flex items-center justify-between space-x-2">
        <div className="flex items-center space-x-2 min-w-0">
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-xs ${
              isStreaming
                ? "bg-primary text-primary-foreground"
                : isRoot
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "bg-muted text-foreground border border-border-subtle"
            }`}
          >
            {isStreaming ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isRoot ? (
              <FileText className="w-3.5 h-3.5" />
            ) : (
              <GitBranch className="w-3.5 h-3.5" />
            )}
          </div>

          <div className="min-w-0">
            <span
              className={`text-xs font-semibold truncate block ${
                isActive ? "text-foreground font-bold" : "text-foreground"
              }`}
            >
              {thread.title}
            </span>
            {thread.highlightedContext && thread.highlightedContext !== thread.title && (
              <span className="text-2xs text-foreground-subtle font-medium truncate block leading-tight">
                {thread.highlightedContext}
              </span>
            )}
          </div>
        </div>

        {/* Message Count Badge & Branch Menu Action */}
        <div className="flex items-center space-x-1.5 shrink-0">
          <div
            className="px-2 py-0.5 rounded-full bg-muted border border-border text-2xs font-mono text-foreground-muted font-medium"
            title={`${messageCount} messages in this thread`}
          >
            {messageCount} msg{messageCount > 1 ? "s" : ""}
          </div>

          {data.onDeleteThread && !isRoot && (
            <div
              className={`nodrag nopan transition-opacity ${
                isMenuOpen
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100"
              }`}
            >
              <DropdownMenu
                align="right"
                onOpenChange={setIsMenuOpen}
                trigger={
                  <Button
                    variant="ghost"
                    size="iconSm"
                    className={`size-6 p-0 text-foreground-muted hover:text-foreground hover:bg-surface-hover ${
                      isMenuOpen ? "text-foreground bg-surface-hover" : ""
                    }`}
                    title="Branch options"
                    aria-label="Branch options"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </Button>
                }
                items={[
                  {
                    label: "Delete branch",
                    icon: <Trash2 className="w-3.5 h-3.5" />,
                    variant: "destructive",
                    onClick: () => setIsConfirmOpen(true),
                  },
                ]}
              />
            </div>
          )}
        </div>
      </div>

      {/* Detailed Mode: Last message preview or branch excerpt */}
      {isDetailed && (
        <div className="mt-2 pt-2 border-t border-border-subtle space-y-1">
          {thread.highlightedContext && (
            <div className="text-2xs text-foreground-muted italic truncate">
              &ldquo;{thread.highlightedContext}&rdquo;
            </div>
          )}
          {lastMessage && (
            <div className="text-2xs text-foreground-muted line-clamp-2 leading-relaxed font-sans">
              <span className="font-semibold text-foreground mr-1">
                {lastMessage.role === "user" ? "You:" : "AI:"}
              </span>
              {lastMessage.content.slice(0, 90)}
            </div>
          )}
        </div>
      )}

      <Handle
        type="source"
        position={sourcePosition}
        className={handleClasses}
      />

      {/* Reusable Confirm Dialog */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => data.onDeleteThread?.(thread.id)}
        title="Delete branch"
        description="Are you sure you want to delete this branch and all its descendants? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
});
