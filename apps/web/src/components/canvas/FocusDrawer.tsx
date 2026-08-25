"use client";

import React, { useRef, useState, useMemo, useEffect } from "react";
import {
  X,
  Sparkles,
  GitBranch,
  CornerDownLeft,
  Loader2,
} from "lucide-react";
import { TreeNode, ConversationTree, getAncestorPath } from "@graphmind/shared";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { ChatMessage } from "../chat/ChatMessage";

interface FocusDrawerProps {
  node: TreeNode | null;
  tree: ConversationTree | null;
  isOpen: boolean;
  isStreaming?: boolean;
  streamingNodeId?: string | null;
  onClose: () => void;
  onSelectBranch: (childNodeId: string) => void;
  onExploreBranch: (parentNodeId: string, highlightedText: string) => void;
  onSendFollowUp: (prompt: string, parentNodeId: string, highlightedText?: string) => void;
  onRegenerate?: (nodeId: string) => void;
  onEditUserMessage?: (userNodeId: string, newContent: string) => void;
  onSwitchBranch?: (nodeId: string) => void;
}

export function FocusDrawer({
  node,
  tree,
  isOpen,
  isStreaming = false,
  streamingNodeId = null,
  onClose,
  onSelectBranch,
  onExploreBranch,
  onSendFollowUp,
  onRegenerate,
  onEditUserMessage,
  onSwitchBranch,
}: FocusDrawerProps) {


  const [drawerPrompt, setDrawerPrompt] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevNodeIdRef = useRef<string | null>(null);

  // Compute all messages on this thread's lineage path
  const threadMessages: TreeNode[] = useMemo(() => {
    if (!tree || !node) return [];
    return getAncestorPath(tree, node.id);
  }, [tree, node]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (bottomRef.current) {
      const isNewNode = prevNodeIdRef.current !== node?.id;
      bottomRef.current.scrollIntoView({ 
        behavior: isNewNode ? "auto" : "smooth" 
      });
      prevNodeIdRef.current = node?.id || null;
    }
  }, [threadMessages, isStreaming, node?.id]);

  if (!isOpen || !node) return null;

  const fullText = threadMessages
    .map((m) => `${m.role === "user" ? "### You" : "### AI"}:\n${m.content}`)
    .join("\n\n---\n\n");

  const handleSubmitFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!drawerPrompt.trim() || isStreaming) return;
    onSendFollowUp(drawerPrompt.trim(), node.id);
    setDrawerPrompt("");
  };

  return (
    <aside
      className="fixed inset-y-0 right-0 z-40 w-full sm:w-[480px] md:w-[540px] bg-white border-l border-zinc-200/90 shadow-2xl flex flex-col animate-in slide-in-from-right duration-250 font-sans select-text"
    >
      {/* Drawer Top Header */}
      <div className="h-14 px-5 border-b border-zinc-200/80 flex items-center justify-between shrink-0 bg-white/95 backdrop-blur-md">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-zinc-900 text-white flex items-center justify-center shrink-0 text-xs shadow-2xs">
            {node.highlightedContext ? (
              <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-xs tracking-tight text-zinc-900 truncate block">
              {node.highlightedContext
                ? `Branch: "${node.highlightedContext}"`
                : "Conversation Thread"}
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">
              {threadMessages.length} message{threadMessages.length > 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0">
          <CopyButton
            text={fullText}
            title="Copy entire thread to clipboard"
          />

          <Button
            variant="ghost"
            size="iconSm"
            onClick={onClose}
            className="h-7 w-7 text-zinc-400 hover:text-zinc-900 cursor-pointer"
            title="Close Focus Drawer (Esc)"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Drawer Scrollable Content Body with Full Markdown Rendering using global ChatMessage */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-1 bg-white">
        {(() => {
          const lastUserIndex = threadMessages.map((m) => m.role).lastIndexOf("user");
          const lastAssistantIndex = threadMessages.map((m) => m.role).lastIndexOf("assistant");

          return threadMessages.map((msg, index) => {
            const isLastAssistant =
              index === threadMessages.length - 1 &&
              msg.role === "assistant" &&
              isStreaming &&
              msg.id === streamingNodeId;

            return (
              <ChatMessage
                key={msg.id}
                message={{
                  ...msg,
                  isStreaming: isLastAssistant,
                }}
                tree={tree}
                isLastUserMessage={index === lastUserIndex}
                isLastAssistantMessage={index === lastAssistantIndex}
                onRegenerate={onRegenerate}
                onEditUserMessage={onEditUserMessage}
                onSwitchBranch={onSwitchBranch}
                onExploreBranch={onExploreBranch}
                onOpenSideBranch={onSelectBranch}
              />
            );
          });
        })()}
        <div ref={bottomRef} />
      </div>


      {/* In-Drawer Follow-up Prompt Bar */}
      <div className="p-4 border-t border-zinc-200/80 bg-white shrink-0">
        <form onSubmit={handleSubmitFollowUp} className="relative flex items-center">
          <input
            type="text"
            value={drawerPrompt}
            onChange={(e) => setDrawerPrompt(e.target.value)}
            placeholder="Ask follow-up in this thread..."
            disabled={isStreaming}
            className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-zinc-200 bg-white text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 shadow-2xs disabled:bg-zinc-50"
          />
          <button
            type="submit"
            disabled={!drawerPrompt.trim() || isStreaming}
            className="absolute right-1.5 p-1.5 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Send follow-up"
          >
            {isStreaming ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CornerDownLeft className="w-3.5 h-3.5" />
            )}
          </button>
        </form>
      </div>
    </aside>
  );
}
