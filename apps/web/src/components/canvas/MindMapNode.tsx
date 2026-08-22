"use client";

import React, { memo } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import {
  User,
  Sparkles,
  GitBranch,
  Loader2,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { CustomNodeData } from "@/lib/treeToGraph";

export type ZoomMode = "orb" | "capsule" | "detailed";

export interface MindMapNodeData extends CustomNodeData {
  zoomMode?: ZoomMode;
}

export const MindMapNode = memo(function MindMapNode({
  data,
  targetPosition = Position.Left,
  sourcePosition = Position.Right,
}: NodeProps<Node<MindMapNodeData>>) {
  const {
    node,
    isRoot,
    isActive,
    isStreaming = false,
    childCount = 0,
    zoomMode = "capsule",
    onRetry,
  } = data;

  const isUser = node.role === "user";
  const isError =
    node.content.startsWith("⚠️") ||
    node.content.includes("Cannot connect") ||
    node.content.includes("unavailable (503)");

  // Clean concise label for the node
  const displayTitle = React.useMemo(() => {
    if (node.highlightedContext) {
      return node.highlightedContext.trim();
    }
    const firstLine = node.content.split("\n")[0] || "";
    // Strip markdown headings or quotes
    const clean = firstLine.replace(/^[#>\s*-]+/, "").trim();
    return clean.length > 0 ? clean : isUser ? "User Question" : "AI Response";
  }, [node.content, node.highlightedContext, isUser]);

  // Handle position helper
  const handleClasses =
    "!w-2 !h-2 !bg-zinc-400 !border !border-white hover:!bg-zinc-900 transition-colors";

  /* =========================================================================
     1. GALAXY ORB VIEW (Zoom < 0.6x - Obsidian Style)
     ========================================================================= */
  if (zoomMode === "orb") {
    return (
      <div
        className={`group relative flex items-center justify-center transition-all duration-200 cursor-pointer ${
          isActive ? "scale-125 z-30" : "hover:scale-115 z-10"
        }`}
        title={`${isUser ? "You" : "Assistant"}: ${displayTitle}`}
      >
        {!isRoot && (
          <Handle
            type="target"
            position={targetPosition}
            className={`${handleClasses} !opacity-0 group-hover:!opacity-100`}
          />
        )}

        {/* Circular Orb Glow & Body */}
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-sm transition-all ${
            isError
              ? "bg-rose-500 text-white ring-4 ring-rose-400/30 animate-bounce"
              : isStreaming
              ? "bg-zinc-900 text-white ring-4 ring-zinc-900/30 animate-pulse"
              : isActive
              ? "bg-zinc-950 text-white ring-4 ring-zinc-950/20 shadow-md"
              : isUser
              ? "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 border border-zinc-300"
              : "bg-white text-zinc-800 hover:bg-zinc-50 border border-zinc-300 shadow-2xs"
          }`}
        >
          {isError ? (
            <AlertCircle className="w-3.5 h-3.5" />
          ) : isStreaming ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isUser ? (
            <User className="w-3.5 h-3.5" />
          ) : node.highlightedContext ? (
            <GitBranch className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
        </div>

        {/* Floating Tooltip Label on Hover in Orb Mode */}
        <div className="absolute left-1/2 -top-7 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 bg-zinc-900 text-white text-[10px] font-medium px-2 py-0.5 rounded-md whitespace-nowrap shadow-md z-40 max-w-[180px] truncate">
          {displayTitle}
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
     2. MIND MAP TOPIC CAPSULE VIEW (Standard & Detailed Zoom >= 0.6x)
     ========================================================================= */
  const isDetailed = zoomMode === "detailed";

  return (
    <div
      className={`group relative flex items-center min-w-[150px] max-w-[240px] px-2.5 py-1.5 rounded-xl border transition-all duration-150 select-none cursor-pointer shadow-2xs ${
        isError
          ? "bg-rose-50/80 border-rose-300 ring-2 ring-rose-500/20 text-rose-900"
          : isStreaming
          ? "bg-white border-zinc-900 ring-2 ring-zinc-900/20 shadow-md animate-pulse z-20"
          : isActive
          ? "bg-white border-zinc-950 ring-2 ring-zinc-950/15 shadow-md z-10"
          : isUser
          ? "bg-zinc-100/90 border-zinc-200/90 text-zinc-900 hover:border-zinc-300 hover:bg-zinc-200/80"
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

      {/* Role Glyph / Avatar */}
      <div
        className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 mr-2 text-[11px] font-bold ${
          isError
            ? "bg-rose-600 text-white"
            : isUser
            ? "bg-zinc-200 text-zinc-700"
            : node.highlightedContext
            ? "bg-emerald-100 text-emerald-800 border border-emerald-300/80"
            : "bg-zinc-900 text-white shadow-2xs"
        }`}
      >
        {isError ? (
          <AlertCircle className="w-3 h-3" />
        ) : isStreaming ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : isUser ? (
          <User className="w-3 h-3" />
        ) : node.highlightedContext ? (
          <GitBranch className="w-3 h-3" />
        ) : (
          <Sparkles className="w-3 h-3" />
        )}
      </div>

      {/* Topic Title & Excerpt */}
      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center space-x-1">
          <span
            className={`text-xs font-semibold truncate ${
              isError
                ? "text-rose-900"
                : isActive
                ? "text-zinc-950 font-bold"
                : "text-zinc-800"
            }`}
          >
            {displayTitle}
          </span>
        </div>

        {/* Detailed Metadata in High Zoom */}
        {isDetailed && node.highlightedContext && (
          <div className="text-[10px] text-zinc-400 italic truncate max-w-[170px]">
            &ldquo;{node.highlightedContext}&rdquo;
          </div>
        )}
      </div>

      {/* Sub-branch Count Pill */}
      {childCount > 1 && (
        <div
          className="ml-1 px-1.5 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-[9px] font-mono text-zinc-500 shrink-0 font-medium"
          title={`${childCount} sub-branches`}
        >
          +{childCount}
        </div>
      )}

      {/* Error 1-Click Retry */}
      {isError && onRetry && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRetry();
          }}
          className="ml-1 p-1 rounded-md bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] flex items-center space-x-0.5 cursor-pointer"
          title="Retry generation"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      )}

      <Handle
        type="source"
        position={sourcePosition}
        className={handleClasses}
      />
    </div>
  );
});
