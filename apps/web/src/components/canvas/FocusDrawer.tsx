"use client";

import React, { useRef, useState, useMemo, useEffect } from "react";
import {
  X,
  User,
  Sparkles,
  GitBranch,
  CornerDownLeft,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import { TreeNode, ConversationTree, getAncestorPath } from "@graphmind/shared";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "../chat/ChatMessage";

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
}

export function FocusDrawer({
  node,
  tree,
  isOpen,
  isStreaming = false,
  streamingNodeId = null,
  onClose,
  onSendFollowUp,
}: FocusDrawerProps) {
  const [copied, setCopied] = useState(false);
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

  const handleCopyThread = async () => {
    try {
      const fullText = threadMessages
        .map((m) => `${m.role === "user" ? "### You" : "### AI"}:\n${m.content}`)
        .join("\n\n---\n\n");
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore
    }
  };

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
          <Button
            variant="ghost"
            size="iconSm"
            onClick={handleCopyThread}
            className="h-7 w-7 text-zinc-500 hover:text-zinc-900 cursor-pointer"
            title="Copy entire thread to clipboard"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </Button>

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

      {/* Drawer Scrollable Content Body with Full Markdown Rendering */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-sm bg-zinc-50/40">
        {threadMessages.map((msg, _index) => {
          const isUser = msg.role === "user";
          const isAssistant = msg.role === "assistant";
          const isNodeStreaming = isAssistant && isStreaming && msg.id === streamingNodeId;

          return (
            <div
              key={msg.id}
              className={`p-4 rounded-2xl border transition-all ${
                isUser
                  ? "bg-zinc-100/90 border-zinc-200/90 ml-4 sm:ml-6"
                  : "bg-white border-zinc-200/90 shadow-2xs mr-2 sm:mr-4"
              }`}
            >
              {/* Message Header */}
              <div className="flex items-center space-x-2 mb-2">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                    isUser
                      ? "bg-zinc-200 text-zinc-700"
                      : "bg-zinc-900 text-white shadow-2xs"
                  }`}
                >
                  {isUser ? <User className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                </div>
                <span className="text-xs font-semibold text-zinc-900 capitalize">
                  {isUser ? "You" : "Assistant"}
                </span>
                {msg.model && (
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {msg.model.replace("gemini-", "").replace("gpt-", "")}
                  </span>
                )}
              </div>

              {/* Context Excerpt Badge if this message branched */}
              {msg.highlightedContext && (
                <div className="mb-2 inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-200/80 text-[11px] text-zinc-700">
                  <GitBranch className="w-3 h-3 text-zinc-500" />
                  <span className="font-semibold text-zinc-900">Branch:</span>
                  <span className="italic truncate max-w-[200px]">
                    &ldquo;{msg.highlightedContext}&rdquo;
                  </span>
                </div>
              )}

              {/* Message Content with Markdown & Math Rendering */}
              <div className="prose prose-zinc max-w-none text-zinc-800 text-xs sm:text-sm leading-relaxed">
                <MarkdownRenderer content={msg.content} />
              </div>

              {isNodeStreaming && (
                <div className="flex items-center space-x-1.5 mt-2 text-xs text-zinc-500 font-mono animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Thinking...</span>
                </div>
              )}
            </div>
          );
        })}
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
