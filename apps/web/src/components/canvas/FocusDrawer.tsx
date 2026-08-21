"use client";

import React, { useRef, useState } from "react";
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
import { TreeNode, ConversationTree } from "@graphmind/shared";
import { Button } from "@/components/ui/button";
import { SelectionTooltip } from "../chat/SelectionTooltip";
import { BranchSwitcher } from "../chat/BranchSwitcher";
import { useTextSelection } from "@/hooks/useTextSelection";

interface FocusDrawerProps {
  node: TreeNode | null;
  tree: ConversationTree | null;
  isOpen: boolean;
  isStreaming?: boolean;
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
  onClose,
  onSelectBranch,
  onExploreBranch,
  onSendFollowUp,
}: FocusDrawerProps) {
  const [copied, setCopied] = useState(false);
  const [drawerPrompt, setDrawerPrompt] = useState("");
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);
  const drawerBodyRef = useRef<HTMLDivElement>(null);

  const { selection, clearSelection } = useTextSelection(drawerBodyRef);

  if (!isOpen || !node) return null;

  const isUser = node.role === "user";
  const isAssistant = node.role === "assistant";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(node.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore
    }
  };

  const handleExploreSelection = (text: string) => {
    setActiveHighlight(text);
    onExploreBranch(node.id, text);
    clearSelection();
  };

  const handleSubmitFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!drawerPrompt.trim() || isStreaming) return;
    onSendFollowUp(drawerPrompt.trim(), node.id, activeHighlight || undefined);
    setDrawerPrompt("");
    setActiveHighlight(null);
  };

  return (
    <aside
      className="fixed inset-y-0 right-0 z-40 w-full sm:w-[480px] md:w-[540px] bg-white border-l border-zinc-200/90 shadow-2xl flex flex-col animate-in slide-in-from-right duration-250 font-sans select-text"
    >
      {/* Drawer Top Header */}
      <div className="h-14 px-5 border-b border-zinc-200/80 flex items-center justify-between shrink-0 bg-white/95 backdrop-blur-md">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs ${
              isUser
                ? "bg-zinc-100 text-zinc-700 border border-zinc-200"
                : "bg-zinc-900 text-white shadow-2xs"
            }`}
          >
            {isUser ? <User className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-xs tracking-tight text-zinc-900 capitalize">
              {isUser ? "User Prompt" : "Assistant Response"}
            </span>
            {node.model && (
              <span className="text-[10px] text-zinc-400 font-mono ml-2">
                {node.model}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0">
          <Button
            variant="ghost"
            size="iconSm"
            onClick={handleCopy}
            className="h-7 w-7 text-zinc-500 hover:text-zinc-900"
            title="Copy content"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>

          <Button
            variant="ghost"
            size="iconSm"
            onClick={onClose}
            className="h-7 w-7 text-zinc-400 hover:text-zinc-900"
            title="Close Focus Drawer (Esc)"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Sibling Branch Switcher Bar if node has siblings */}
      {tree && node.parentId && (
        <div className="px-5 py-2 bg-zinc-50/70 border-b border-zinc-200/80 flex items-center justify-between text-xs">
          <span className="text-[11px] text-zinc-500 font-medium">Branch Lineage</span>
          <BranchSwitcher
            tree={tree}
            parentNodeId={node.parentId}
            activeChildId={node.id}
            onSelectBranch={onSelectBranch}
          />
        </div>
      )}

      {/* Drawer Scrollable Content Body */}
      <div
        ref={drawerBodyRef}
        className="flex-1 overflow-y-auto p-5 sm:p-6 relative prose prose-zinc max-w-none text-zinc-800 text-sm leading-relaxed"
      >
        {/* Context Excerpt Badge */}
        {node.highlightedContext && (
          <div className="mb-4 not-prose flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-zinc-100/90 border border-zinc-200/80 text-xs text-zinc-700">
            <GitBranch className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span className="font-medium">Focusing on:</span>
            <span className="italic truncate">&ldquo;{node.highlightedContext}&rdquo;</span>
          </div>
        )}

        {/* Text Content */}
        <div className="whitespace-pre-wrap font-sans break-words">
          {node.content || (isAssistant ? "Generating response..." : "Empty message")}
        </div>

        {/* Floating Selection Tooltip inside Drawer */}
        {isAssistant && selection && (
          <SelectionTooltip
            selection={selection}
            onExplore={handleExploreSelection}
          />
        )}
      </div>

      {/* Drawer Footer: Inline Branch Composer */}
      <div className="p-4 border-t border-zinc-200/80 bg-zinc-50/60 shrink-0">
        {activeHighlight && (
          <div className="mb-2 flex items-center justify-between px-2.5 py-1 rounded-md bg-zinc-200/70 text-xs text-zinc-800">
            <div className="flex items-center space-x-1.5 truncate">
              <GitBranch className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
              <span className="truncate italic">&ldquo;{activeHighlight}&rdquo;</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveHighlight(null)}
              className="text-zinc-500 hover:text-zinc-900 cursor-pointer ml-2"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmitFollowUp} className="relative flex items-center">
          <input
            type="text"
            value={drawerPrompt}
            onChange={(e) => setDrawerPrompt(e.target.value)}
            placeholder={
              activeHighlight
                ? "Ask a follow-up about the selected text..."
                : "Branch a follow-up from this message..."
            }
            className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-zinc-200 bg-white text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 shadow-2xs"
            disabled={isStreaming}
          />
          <button
            type="submit"
            disabled={!drawerPrompt.trim() || isStreaming}
            className="absolute right-1.5 p-1.5 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Send Branch Prompt"
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
