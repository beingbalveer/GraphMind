"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  X,
  GitBranch,
  Sparkles,
  User,
  CornerDownLeft,
  Loader2,
  Plus,
  Code2,
  Scale,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import {
  ConversationTree,
  TreeNode,
  getAncestorPath,
  getSiblingSubBranches,
  getBranchLeafNode,
} from "@graphmind/shared";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "./ChatMessage";

interface BranchChatPaneProps {
  tree: ConversationTree | null;
  branchLeafNodeId: string;
  highlightedContext?: string;
  isStreaming?: boolean;
  streamingNodeId?: string | null;
  onClose: () => void;
  onSelectBranchLeaf: (leafId: string) => void;
  onSendBranchMessage: (prompt: string, parentNodeId: string) => void;
  onSendNewSiblingBranch: (prompt: string, parentNodeId: string, highlightedContext: string) => void;
}

export function BranchChatPane({
  tree,
  branchLeafNodeId,
  highlightedContext,
  isStreaming = false,
  streamingNodeId = null,
  onClose,
  onSelectBranchLeaf,
  onSendBranchMessage,
  onSendNewSiblingBranch,
}: BranchChatPaneProps) {
  const [inputPrompt, setInputPrompt] = useState("");
  const [isDraftingNewTab, setIsDraftingNewTab] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevBranchLeafIdRef = useRef<string | null>(null);

  // Compute full lineage for the currently active leaf node
  const activeLineage: TreeNode[] = useMemo(() => {
    if (!tree || !branchLeafNodeId || !tree.nodes[branchLeafNodeId]) return [];
    return getAncestorPath(tree, branchLeafNodeId);
  }, [tree, branchLeafNodeId]);

  // Find the branch root node (the node containing the highlighted context or prompt start)
  const branchRootIndex = useMemo(() => {
    const idx = activeLineage.findIndex((n) => Boolean(n.highlightedContext));
    return idx !== -1 ? idx : Math.max(0, activeLineage.length - 2);
  }, [activeLineage]);

  const activeBranchRoot = activeLineage[branchRootIndex];
  const parentNodeId =
    activeBranchRoot?.parentId ||
    (branchRootIndex > 0 ? activeLineage[branchRootIndex - 1].id : null);

  const displayContext =
    highlightedContext ||
    activeBranchRoot?.highlightedContext ||
    (activeBranchRoot ? activeBranchRoot.content.slice(0, 45) : "Topic");

  // Discover all sibling sub-branches stemming from the same parent context
  const siblingTabs = useMemo(() => {
    if (!tree || !parentNodeId) {
      return [
        {
          id: branchLeafNodeId,
          rootId: activeBranchRoot?.id || branchLeafNodeId,
          leafId: branchLeafNodeId,
          title: "Branch 1",
          prompt: activeBranchRoot?.content || "Branch 1",
        },
      ];
    }

    const siblingRoots = getSiblingSubBranches(tree, parentNodeId, displayContext);
    if (siblingRoots.length === 0) {
      return [
        {
          id: branchLeafNodeId,
          rootId: activeBranchRoot?.id || branchLeafNodeId,
          leafId: branchLeafNodeId,
          title: "Branch 1",
          prompt: activeBranchRoot?.content || "Branch 1",
        },
      ];
    }

    return siblingRoots.map((root, idx) => {
      const leaf = getBranchLeafNode(tree, root.id);

      // Clean semantic title from user prompt
      let title = `Tab ${idx + 1}`;
      const content = root.content.trim().toLowerCase();
      if (content.startsWith("explain")) {
        title = "Explain";
      } else if (content.includes("code") || content.includes("example")) {
        title = "Code";
      } else if (content.includes("pros") || content.includes("tradeoff") || content.includes("compare")) {
        title = "Tradeoffs";
      } else if (content.includes("pitfall") || content.includes("edge case") || content.includes("mistake")) {
        title = "Pitfalls";
      } else if (root.content.trim().length > 0) {
        const raw = root.content.trim();
        title = raw.length > 16 ? raw.slice(0, 14) + "…" : raw;
      }

      return {
        id: root.id,
        rootId: root.id,
        leafId: leaf.id,
        title,
        prompt: root.content,
      };
    });
  }, [tree, parentNodeId, displayContext, branchLeafNodeId, activeBranchRoot]);

  // Active branch messages
  const branchMessages: TreeNode[] = useMemo(() => {
    if (isDraftingNewTab) return [];
    if (branchRootIndex === -1 || activeLineage.length === 0) return activeLineage;
    return activeLineage.slice(branchRootIndex);
  }, [activeLineage, branchRootIndex, isDraftingNewTab]);

  // Auto-scroll on new streaming tokens
  useEffect(() => {
    if (bottomRef.current) {
      const isNewBranch = prevBranchLeafIdRef.current !== branchLeafNodeId;
      bottomRef.current.scrollIntoView({ 
        behavior: isNewBranch ? "auto" : "smooth" 
      });
      prevBranchLeafIdRef.current = branchLeafNodeId;
    }
  }, [branchMessages, isStreaming, branchLeafNodeId]);

  // Focus input when opening draft tab
  useEffect(() => {
    if (isDraftingNewTab) {
      inputRef.current?.focus();
    }
  }, [isDraftingNewTab]);

  const handleSelectTab = useCallback(
    (leafId: string) => {
      setIsDraftingNewTab(false);
      onSelectBranchLeaf(leafId);
    },
    [onSelectBranchLeaf]
  );

  const handleStartNewTab = useCallback(() => {
    setIsDraftingNewTab(true);
    setInputPrompt("");
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPrompt.trim() || isStreaming) return;

    if (isDraftingNewTab) {
      if (parentNodeId) {
        onSendNewSiblingBranch(inputPrompt.trim(), parentNodeId, displayContext);
        setIsDraftingNewTab(false);
      }
    } else {
      onSendBranchMessage(inputPrompt.trim(), branchLeafNodeId);
    }
    setInputPrompt("");
  };

  const handleQuickPrompt = (template: string) => {
    if (!parentNodeId || isStreaming) return;
    const prompt = template.replace("{topic}", displayContext);
    onSendNewSiblingBranch(prompt, parentNodeId, displayContext);
    setIsDraftingNewTab(false);
    setInputPrompt("");
  };

  const starterTemplates = [
    {
      icon: Lightbulb,
      title: "Deep Dive",
      desc: "Detailed explanation with core principles",
      prompt: `Explain the deep architectural principles of "${displayContext}" in detail.`,
    },
    {
      icon: Code2,
      title: "Code Example",
      desc: "Practical implementation with code snippets",
      prompt: `Provide a clear, production-ready code example demonstrating "${displayContext}".`,
    },
    {
      icon: Scale,
      title: "Trade-offs & Alternatives",
      desc: "Compare pros, cons, and alternatives",
      prompt: `What are the key trade-offs, pros/cons, and alternatives for "${displayContext}"?`,
    },
    {
      icon: AlertTriangle,
      title: "Edge Cases & Pitfalls",
      desc: "Common bugs and production gotchas",
      prompt: `What are the common pitfalls, edge cases, and mistakes when dealing with "${displayContext}"?`,
    },
  ];

  return (
    <div className="w-full h-full flex flex-col bg-white font-sans select-text">
      {/* Tabbed Header with Sibling Sub-Branches */}
      <div className="h-13 px-3 sm:px-4 border-b border-zinc-200/80 flex items-center justify-between shrink-0 bg-zinc-50/70 z-10">
        <div className="flex items-center space-x-1.5 min-w-0 pr-2 overflow-x-auto no-scrollbar">
          {/* Main Excerpt Identifier Badge */}
          <div className="flex items-center space-x-1.5 px-2 py-1 rounded-md bg-zinc-200/60 text-zinc-800 text-xs font-semibold shrink-0">
            <GitBranch className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
            <span className="max-w-[120px] truncate text-[11.5px]">{displayContext}</span>
          </div>

          {/* Sibling Sub-Branch Tabs */}
          {siblingTabs.map((tab) => {
            const isActive = !isDraftingNewTab && tab.leafId === branchLeafNodeId;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectTab(tab.leafId)}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer select-none shrink-0 ${
                  isActive
                    ? "bg-white text-zinc-950 font-semibold shadow-2xs border border-zinc-200/90"
                    : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/50"
                }`}
                title={tab.prompt || tab.title}
              >
                <span className="truncate max-w-[90px]">{tab.title}</span>
              </button>
            );
          })}

          {/* Plus Button: Add New Sibling Sub-Branch Tab */}
          <button
            type="button"
            onClick={handleStartNewTab}
            className={`p-1 rounded-md text-xs transition-all cursor-pointer select-none shrink-0 ${
              isDraftingNewTab
                ? "bg-white text-zinc-950 font-medium shadow-2xs border border-zinc-200/90"
                : "text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200/50"
            }`}
            title="Create new sub-branch query on this topic"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Close Side Branch View */}
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

      {/* Messages Scroll Area or New Tab Starter View */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-sm bg-zinc-50/30"
      >
        {isDraftingNewTab ? (
          /* Blank Draft Tab Starter View */
          <div className="flex-1 flex flex-col justify-center max-w-md mx-auto py-6 space-y-5 animate-in fade-in-50 duration-150">
            <div className="text-center space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200/80 text-zinc-700 flex items-center justify-center mx-auto shadow-2xs">
                <Plus className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-900">
                New exploration on &ldquo;{displayContext}&rdquo;
              </h3>
              <p className="text-xs text-zinc-500">
                Query this topic from a different perspective or choose a quick starter below:
              </p>
            </div>

            {/* Quick Template Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {starterTemplates.map((tpl, i) => {
                const Icon = tpl.icon;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleQuickPrompt(tpl.prompt)}
                    disabled={isStreaming}
                    className="p-3 rounded-xl bg-white border border-zinc-200/80 hover:border-zinc-300 hover:bg-zinc-50/80 text-left transition-all group shadow-2xs cursor-pointer"
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      <Icon className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-950" />
                      <span className="text-xs font-semibold text-zinc-900">
                        {tpl.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-snug">
                      {tpl.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Active Branch Conversation Messages */
          branchMessages.map((msg, _index) => {
            const isUser = msg.role === "user";
            const isAssistant = msg.role === "assistant";
            const isNodeStreaming = isAssistant && isStreaming && msg.id === streamingNodeId;

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
                  <div className="w-5 h-5 rounded-md flex items-center justify-center text-xs bg-zinc-100 border border-zinc-200/80 text-zinc-700 shadow-2xs">
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
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Dedicated Branch Input Bar */}
      <div className="p-3 sm:p-4 border-t border-zinc-200/80 bg-white shrink-0">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            placeholder={
              isDraftingNewTab
                ? `Ask anything about "${displayContext}"...`
                : "Ask follow-up in this tab..."
            }
            disabled={isStreaming}
            className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-zinc-200 bg-white text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 shadow-2xs disabled:bg-zinc-50 transition-all"
          />
          <button
            type="submit"
            disabled={!inputPrompt.trim() || isStreaming}
            className="absolute right-1.5 p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200/80 text-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            title={isDraftingNewTab ? "Start new sub-branch tab" : "Send follow-up"}
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
