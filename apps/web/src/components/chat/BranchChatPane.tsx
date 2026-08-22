"use client";

import React, { useRef, useEffect } from "react";
import { X, GitBranch, Sparkles, User, CornerDownLeft, Loader2 } from "lucide-react";
import { ConversationTree, TreeNode, getAncestorPath } from "@graphmind/shared";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "./ChatMessage";

interface BranchChatPaneProps {
  tree: ConversationTree | null;
  branchLeafNodeId: string;
  highlightedContext?: string;
  isStreaming?: boolean;
  onClose: () => void;
  onSendBranchMessage: (prompt: string, parentNodeId: string) => void;
}

export function BranchChatPane({
  tree,
  branchLeafNodeId,
  highlightedContext,
  isStreaming = false,
  onClose,
  onSendBranchMessage,
}: BranchChatPaneProps) {
  const [inputPrompt, setInputPrompt] = React.useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Compute full lineage for this branch
  const fullLineage: TreeNode[] = React.useMemo(() => {
    if (!tree || !branchLeafNodeId || !tree.nodes[branchLeafNodeId]) return [];
    return getAncestorPath(tree, branchLeafNodeId);
  }, [tree, branchLeafNodeId]);

  // Find the exact node where this branch was created (the first node with highlightedContext)
  const branchStartIndex = React.useMemo(() => {
    const idx = fullLineage.findIndex((n) => Boolean(n.highlightedContext));
    return idx !== -1 ? idx : Math.max(0, fullLineage.length - 2);
  }, [fullLineage]);

  // Only display messages belonging to this branch (isolated from parent main chat)
  const branchMessages: TreeNode[] = React.useMemo(() => {
    if (branchStartIndex === -1 || fullLineage.length === 0) return fullLineage;
    return fullLineage.slice(branchStartIndex);
  }, [fullLineage, branchStartIndex]);

  const branchStartNode = fullLineage[branchStartIndex];

  const displayContext =
    highlightedContext ||
    branchStartNode?.highlightedContext ||
    (branchStartNode ? branchStartNode.content.slice(0, 50) : "Sub-topic");

  // Auto-scroll on new tokens
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [branchMessages, isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPrompt.trim() || isStreaming) return;
    onSendBranchMessage(inputPrompt.trim(), branchLeafNodeId);
    setInputPrompt("");
  };

  return (
    <div className="w-full h-full flex flex-col bg-white font-sans select-text">
      {/* Clean Light Branch Header */}
      <div className="h-13 px-4 sm:px-5 border-b border-zinc-200/80 flex items-center justify-between shrink-0 bg-white/90 backdrop-blur-md z-10">
        <div className="flex items-center space-x-2 min-w-0 pr-2">
          <div className="w-6 h-6 rounded-md bg-zinc-100 border border-zinc-200/80 text-zinc-700 flex items-center justify-center shrink-0 shadow-2xs">
            <GitBranch className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-semibold text-zinc-950 truncate">
                Branch
              </span>
              {displayContext && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-100/90 border border-zinc-200/80 text-zinc-600 font-medium truncate max-w-[200px]">
                  {displayContext}
                </span>
              )}
            </div>
          </div>
        </div>

        <Button
          variant="ghost"
          size="iconSm"
          onClick={onClose}
          className="h-7 w-7 text-zinc-400 hover:text-zinc-900 shrink-0 cursor-pointer"
          title="Close branch view"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-sm bg-zinc-50/30"
      >
        {branchMessages.map((msg, index) => {
          const isUser = msg.role === "user";
          const isAssistant = msg.role === "assistant";
          const isLast = index === branchMessages.length - 1;
          const isNodeStreaming = isLast && isAssistant && isStreaming;

          return (
            <div
              key={msg.id}
              className={`p-4 rounded-xl border transition-all ${
                isUser
                  ? "bg-zinc-100/80 border-zinc-200/80 ml-4 sm:ml-8"
                  : "bg-white border-zinc-200/80 shadow-2xs mr-2 sm:mr-6"
              }`}
            >
              {/* Message Header */}
              <div className="flex items-center space-x-2 mb-2">
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center text-xs bg-zinc-100 border border-zinc-200/80 text-zinc-700 shadow-2xs"
                >
                  {isUser ? <User className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                </div>
                <span className="text-xs font-semibold text-zinc-950 capitalize">
                  {isUser ? "You" : "Assistant"}
                </span>
                {msg.model && (
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {msg.model.replace("gemini-", "").replace("gpt-", "")}
                  </span>
                )}
              </div>

              {/* Message Content */}
              <div className="prose prose-zinc max-w-none text-zinc-800 text-xs sm:text-sm leading-relaxed">
                <MarkdownRenderer content={msg.content} />
              </div>

              {isNodeStreaming && (
                <div className="flex items-center space-x-1.5 mt-2 text-xs text-zinc-500 font-mono animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating response...</span>
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Dedicated Branch Input Bar */}
      <div className="p-3 sm:p-4 border-t border-zinc-200/80 bg-white shrink-0">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            placeholder="Ask follow-up in this branch..."
            disabled={isStreaming}
            className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-zinc-200 bg-white text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 shadow-2xs disabled:bg-zinc-50 transition-all"
          />
          <button
            type="submit"
            disabled={!inputPrompt.trim() || isStreaming}
            className="absolute right-1.5 p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200/80 text-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            title="Send branch message"
          >
            {isStreaming ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-600" />
            ) : (
              <CornerDownLeft className="w-3.5 h-3.5 text-zinc-700" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
