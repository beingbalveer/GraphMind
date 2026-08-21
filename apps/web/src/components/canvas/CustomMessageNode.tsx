"use client";

import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { User, Sparkles, GitBranch } from "lucide-react";
import { CustomNodeData } from "@/lib/treeToGraph";

export const CustomMessageNode = memo(function CustomMessageNode({
  data,
}: {
  data: CustomNodeData;
}) {
  const { node, isRoot, isActive } = data;
  const isUser = node.role === "user";

  return (
    <div
      className={`w-72 rounded-2xl bg-white p-3.5 shadow-sm transition-all duration-150 border select-none cursor-pointer ${
        isActive
          ? "border-zinc-900 ring-2 ring-zinc-900/10 shadow-md"
          : "border-zinc-200/90 hover:border-zinc-300 hover:shadow-md"
      }`}
    >
      {/* Top Connection Handle (Incoming) */}
      {!isRoot && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-2 !h-2 !bg-zinc-400 !border-2 !border-white"
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center space-x-1.5 min-w-0">
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs ${
              isUser
                ? "bg-zinc-100 text-zinc-700 border border-zinc-200"
                : "bg-zinc-900 text-white shadow-2xs"
            }`}
          >
            {isUser ? (
              <User className="w-3 h-3" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
          </div>
          <span className="text-[11px] font-semibold text-zinc-800 capitalize truncate">
            {isRoot ? "Root Topic" : isUser ? "User Branch" : "Assistant"}
          </span>
        </div>

        {node.model && (
          <span className="text-[9.5px] px-1.5 py-0.2 rounded-full bg-zinc-100 text-zinc-500 font-mono shrink-0 truncate max-w-[90px]">
            {node.model.replace("gemini-", "").replace("gpt-", "")}
          </span>
        )}
      </div>

      {/* Sub-topic Excerpt Badge if present */}
      {node.highlightedContext && (
        <div className="mb-2 flex items-center space-x-1 px-2 py-0.5 rounded-md bg-zinc-100/90 border border-zinc-200/80 text-[10.5px] text-zinc-700 truncate">
          <GitBranch className="w-3 h-3 text-zinc-500 shrink-0" />
          <span className="italic truncate">&ldquo;{node.highlightedContext}&rdquo;</span>
        </div>
      )}

      {/* Message Content Snippet */}
      <p className="text-xs text-zinc-600 line-clamp-3 leading-relaxed break-words">
        {node.content || (node.role === "assistant" ? "Thinking..." : "Empty message")}
      </p>

      {/* Bottom Connection Handle (Outgoing) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-zinc-400 !border-2 !border-white"
      />
    </div>
  );
});
