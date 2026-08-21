"use client";

import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import {
  User,
  Sparkles,
  GitBranch,
  MessageSquare,
  Plus,
  Loader2,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { CustomNodeData } from "@/lib/treeToGraph";

export const CustomMessageNode = memo(function CustomMessageNode({
  data,
}: {
  data: CustomNodeData;
}) {
  const {
    node,
    isRoot,
    isActive,
    isStreaming = false,
    totalSiblings = 1,
    siblingIndex = 0,
    childCount = 0,
    onExploreBranch,
    onSwitchToChat,
    onRetry,
  } = data;

  const isUser = node.role === "user";
  const isError =
    node.content.startsWith("⚠️") ||
    node.content.includes("Cannot connect") ||
    node.content.includes("unavailable (503)");

  const handleBranchClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onExploreBranch?.(node.id, node.content.slice(0, 100));
  };

  const handleChatClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSwitchToChat?.(node.id);
  };

  const handleRetryClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRetry?.();
  };

  return (
    <div
      className={`w-80 rounded-2xl bg-white p-4 shadow-sm transition-all duration-150 border select-none cursor-pointer transform-gpu will-change-transform group ${
        isError
          ? "border-rose-300 ring-2 ring-rose-500/20 bg-rose-50/10 shadow-md"
          : isStreaming
          ? "border-zinc-900 ring-2 ring-zinc-900/20 shadow-lg animate-pulse z-20"
          : isActive
          ? "border-zinc-900 ring-2 ring-zinc-900/10 shadow-lg z-10"
          : "border-zinc-200/90 hover:border-zinc-300 hover:shadow-md"
      }`}
    >
      {/* Top Connection Handle (Incoming) */}
      {!isRoot && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-2.5 !h-2.5 !bg-zinc-400 !border-2 !border-white"
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center space-x-2 min-w-0">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs ${
              isError
                ? "bg-rose-100 text-rose-700 border border-rose-200"
                : isStreaming
                ? "bg-zinc-900 text-white shadow-2xs"
                : isUser
                ? "bg-zinc-100 text-zinc-700 border border-zinc-200"
                : "bg-zinc-900 text-white shadow-2xs"
            }`}
          >
            {isError ? (
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            ) : isStreaming ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
            ) : isUser ? (
              <User className="w-3.5 h-3.5" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-zinc-900 capitalize truncate leading-none">
              {isError
                ? "Generation Error"
                : isStreaming
                ? "Generating Response..."
                : isRoot
                ? "Root Topic"
                : isUser
                ? "User Branch"
                : "Assistant"}
            </div>
            {node.model && !isError && (
              <div className="text-[10px] text-zinc-400 font-mono mt-0.5 truncate">
                {node.model.replace("gemini-", "").replace("gpt-", "")}
              </div>
            )}
          </div>
        </div>

        {/* Right Header Badges */}
        <div className="flex items-center space-x-1 shrink-0">
          {totalSiblings > 1 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 border border-zinc-200/80 text-zinc-600 font-medium">
              Branch {siblingIndex + 1}/{totalSiblings}
            </span>
          )}
          {childCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500 font-mono">
              {childCount} {childCount === 1 ? "branch" : "branches"}
            </span>
          )}
        </div>
      </div>

      {/* Sub-topic Excerpt Badge if present */}
      {node.highlightedContext && (
        <div className="mb-2.5 flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-zinc-50 border border-zinc-200/80 text-[11px] text-zinc-700">
          <GitBranch className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <span className="italic truncate">&ldquo;{node.highlightedContext}&rdquo;</span>
        </div>
      )}

      {/* Message Content Snippet */}
      <p
        className={`text-xs leading-relaxed break-words line-clamp-4 ${
          isError ? "text-rose-700 font-medium" : "text-zinc-600"
        }`}
      >
        {node.content || (node.role === "assistant" ? "Thinking..." : "Empty message")}
      </p>

      {/* Interactive Bottom Action Toolbar */}
      <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center justify-between text-xs">
        {isError ? (
          <button
            type="button"
            onClick={handleRetryClick}
            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer text-[11px] font-semibold"
            title="Retry Generation"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleBranchClick}
            className="inline-flex items-center space-x-1 px-2 py-1 rounded-md text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 transition-colors cursor-pointer text-[11px] font-medium"
            title="Branch from this node"
          >
            <Plus className="w-3 h-3" />
            <span>Branch</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleChatClick}
          className="inline-flex items-center space-x-1 px-2 py-1 rounded-md text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 transition-colors cursor-pointer text-[11px] font-medium"
          title="Open in Chat Feed"
        >
          <MessageSquare className="w-3 h-3" />
          <span>Open in Chat</span>
        </button>
      </div>

      {/* Bottom Connection Handle (Outgoing) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-zinc-400 !border-2 !border-white"
      />
    </div>
  );
});
