"use client";

import React from "react";
import { ChevronRight, GitBranch, MessageSquare } from "lucide-react";
import { Message } from "@/hooks/useChatStream";

interface BranchBreadcrumbsProps {
  messages: Message[];
  onJumpToMessage?: (messageId: string) => void;
}

export function BranchBreadcrumbs({
  messages,
  onJumpToMessage,
}: BranchBreadcrumbsProps) {
  // Extract key milestone nodes for breadcrumb display
  const rootMessage = messages.find((m) => m.role === "user");
  const branchMessages = messages.filter(
    (m) => m.role === "user" && m.highlightedContext
  );

  if (!rootMessage || branchMessages.length === 0) {
    return null;
  }

  return (
    <nav className="flex items-center space-x-1.5 text-xs text-zinc-500 max-w-xl truncate animate-in fade-in duration-150">
      {/* Root Node */}
      <button
        type="button"
        onClick={() => onJumpToMessage?.(rootMessage.id)}
        className="flex items-center space-x-1 hover:text-zinc-900 transition-colors truncate max-w-[140px] cursor-pointer"
        title={`Root prompt: ${rootMessage.content}`}
      >
        <MessageSquare className="w-3 h-3 text-zinc-400 shrink-0" />
        <span className="truncate font-medium text-zinc-700">
          {rootMessage.content}
        </span>
      </button>

      {/* Branch Steps */}
      {branchMessages.map((msg, index) => (
        <React.Fragment key={msg.id}>
          <ChevronRight className="w-3 h-3 text-zinc-300 shrink-0" />
          <button
            type="button"
            onClick={() => onJumpToMessage?.(msg.id)}
            className={`flex items-center space-x-1 transition-colors truncate max-w-[150px] cursor-pointer ${
              index === branchMessages.length - 1
                ? "text-zinc-900 font-semibold"
                : "text-zinc-500 hover:text-zinc-800 font-medium"
            }`}
            title={`Sub-topic: "${msg.highlightedContext}" — ${msg.content}`}
          >
            <GitBranch className="w-3 h-3 text-zinc-400 shrink-0" />
            <span className="truncate">
              &ldquo;{msg.highlightedContext}&rdquo;
            </span>
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
}
