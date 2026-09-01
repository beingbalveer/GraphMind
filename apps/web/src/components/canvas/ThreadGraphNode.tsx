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

export type ZoomMode = "orb" | "capsule" | "detailed";

export interface ThreadNodeData {
  thread: ConversationThread;
  zoomMode?: ZoomMode;
  onSelectThread?: (threadId: string) => void;
  onDeleteThread?: (threadId: string) => void;
  [key: string]: unknown;
}

export const ThreadGraphNode = memo(function ThreadGraphNode({
  data,
  targetPosition = Position.Left,
  sourcePosition = Position.Right,
}: NodeProps<Node<ThreadNodeData>>) {
  const { thread, zoomMode = "capsule" } = data;
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isRoot = !thread.parentThreadId;
  const isActive = thread.isActive;
  const isStreaming = thread.isStreaming;
  const messageCount = thread.messages.length;
  const lastMessage = thread.messages[thread.messages.length - 1];

  const handleClasses =
    "!w-2 !h-2 !bg-zinc-400 !border !border-white hover:!bg-zinc-900 transition-colors";

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
          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shadow-sm transition-all ${
            isStreaming
              ? "bg-zinc-900 text-white ring-4 ring-zinc-900/30 animate-pulse"
              : isActive
              ? "bg-zinc-950 text-white ring-4 ring-zinc-950/20 shadow-md"
              : isRoot
              ? "bg-zinc-900 text-white border border-zinc-800"
              : "bg-white text-zinc-800 hover:bg-zinc-50 border border-zinc-300 shadow-2xs"
          }`}
        >
          {isStreaming ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isRoot ? (
            <FileText className="w-3.5 h-3.5" />
          ) : (
            <GitBranch className="w-3.5 h-3.5 text-emerald-600" />
          )}
        </div>

        {/* Floating Tooltip on Hover in Orb Mode */}
        <div className="absolute left-1/2 -top-8 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 bg-zinc-900 text-white text-[11px] font-medium px-2.5 py-1 rounded-lg whitespace-nowrap shadow-md z-40 max-w-[200px] truncate flex items-center space-x-1.5">
          <span>{thread.title}</span>
          <span className="text-[10px] text-zinc-400 font-mono">({messageCount})</span>
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
      className={`group relative flex flex-col min-w-[180px] max-w-[260px] p-2.5 rounded-2xl border transition-all duration-150 select-none cursor-pointer shadow-2xs ${
        isStreaming
          ? "bg-white border-zinc-900 ring-2 ring-zinc-900/20 shadow-md animate-pulse z-20"
          : isActive
          ? "bg-white border-zinc-950 ring-2 ring-zinc-950/15 shadow-md z-10"
          : isRoot
          ? "bg-zinc-50/90 border-zinc-300 text-zinc-900 hover:border-zinc-400"
          : "bg-white border-zinc-200/90 text-zinc-900 hover:border-zinc-300 hover:shadow-xs"
      }`}
    >
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
                ? "bg-zinc-900 text-white"
                : isRoot
                ? "bg-zinc-900 text-white shadow-2xs"
                : "bg-emerald-100 text-emerald-800 border border-emerald-300/70"
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
                isActive ? "text-zinc-950 font-bold" : "text-zinc-800"
              }`}
            >
              {thread.title}
            </span>
            {thread.highlightedContext && thread.highlightedContext !== thread.title && (
              <span className="text-[10px] text-zinc-400 font-medium truncate block leading-tight">
                {thread.highlightedContext}
              </span>
            )}
          </div>
        </div>

        {/* Message Count Badge & Branch Menu Action */}
        <div className="flex items-center space-x-1.5 shrink-0">
          <div
            className="px-2 py-0.5 rounded-full bg-zinc-100 border border-zinc-200/80 text-[10px] font-mono text-zinc-600 font-medium"
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
                  <button
                    type="button"
                    className={`p-1 rounded-md transition-colors cursor-pointer flex items-center justify-center ${
                      isMenuOpen
                        ? "text-zinc-950 bg-zinc-200/80"
                        : "text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100"
                    }`}
                    title="Branch options"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
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
        <div className="mt-2 pt-2 border-t border-zinc-100 space-y-1">
          {thread.highlightedContext && (
            <div className="text-[10px] text-zinc-500 italic truncate">
              &ldquo;{thread.highlightedContext}&rdquo;
            </div>
          )}
          {lastMessage && (
            <div className="text-[11px] text-zinc-600 line-clamp-2 leading-relaxed font-sans">
              <span className="font-semibold text-zinc-800 mr-1">
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
