"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  X,
  GitBranch,
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
import { ChatMessage } from "./ChatMessage";

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
  const prevDraftingRef = useRef<boolean>(isDraftingNewTab);
  const scrollPositionsRef = useRef<Record<string, number>>({});

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

  // Track scroll position per tab
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const currentKey = isDraftingNewTab ? "__draft__" : branchLeafNodeId;
    if (currentKey) {
      scrollPositionsRef.current[currentKey] = scrollRef.current.scrollTop;
    }
  }, [isDraftingNewTab, branchLeafNodeId]);

  // Scroll position restoration on tab switch or follow during streaming
  useEffect(() => {
    const currentKey = isDraftingNewTab ? "__draft__" : branchLeafNodeId;
    const wasDrafting = prevDraftingRef.current;
    const isNewBranch = prevBranchLeafIdRef.current !== branchLeafNodeId;
    const isTabSwitch = isNewBranch || wasDrafting !== isDraftingNewTab;

    prevBranchLeafIdRef.current = branchLeafNodeId;
    prevDraftingRef.current = isDraftingNewTab;

    if (!scrollRef.current) return;

    if (isTabSwitch) {
      // Restore previously saved scroll position for this specific tab
      if (currentKey && typeof scrollPositionsRef.current[currentKey] === "number") {
        scrollRef.current.scrollTop = scrollPositionsRef.current[currentKey];
      } else {
        // Default to bottom for a new branch view, or top for draft view
        scrollRef.current.scrollTop = isDraftingNewTab ? 0 : scrollRef.current.scrollHeight;
      }
    } else if (isStreaming && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [branchMessages, isStreaming, branchLeafNodeId, isDraftingNewTab]);

  // Focus input when opening draft tab
  useEffect(() => {
    if (isDraftingNewTab) {
      inputRef.current?.focus();
    }
  }, [isDraftingNewTab]);

  const handleSelectTab = useCallback(
    (leafId: string) => {
      // Save scroll state before switching
      if (scrollRef.current) {
        const currentKey = isDraftingNewTab ? "__draft__" : branchLeafNodeId;
        if (currentKey) {
          scrollPositionsRef.current[currentKey] = scrollRef.current.scrollTop;
        }
      }
      setIsDraftingNewTab(false);
      onSelectBranchLeaf(leafId);
    },
    [isDraftingNewTab, branchLeafNodeId, onSelectBranchLeaf]
  );

  const handleStartNewTab = useCallback(() => {
    // Save scroll state before opening draft
    if (scrollRef.current) {
      const currentKey = isDraftingNewTab ? "__draft__" : branchLeafNodeId;
      if (currentKey) {
        scrollPositionsRef.current[currentKey] = scrollRef.current.scrollTop;
      }
    }
    setIsDraftingNewTab(true);
    setInputPrompt("");
  }, [isDraftingNewTab, branchLeafNodeId]);

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
      <div className="h-13 px-3 sm:px-5 border-b border-zinc-200 flex items-end justify-between shrink-0 bg-white z-10">
        <div className="flex items-end space-x-2 min-w-0 pr-2 overflow-x-auto no-scrollbar">
          {/* Main Excerpt Identifier Badge */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-800 text-xs font-medium shrink-0 mb-2 mr-2">
            <GitBranch className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
            <span className="max-w-[130px] truncate text-xs">{displayContext}</span>
          </div>

          {/* Sibling Sub-Branch Tabs */}
          {siblingTabs.map((tab) => {
            const isActive = !isDraftingNewTab && tab.leafId === branchLeafNodeId;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectTab(tab.leafId)}
                className={`flex items-center space-x-2 px-3 pb-2.5 pt-1 text-[13px] font-medium transition-colors cursor-pointer select-none shrink-0 border-b-2 -mb-px ${
                  isActive
                    ? "border-zinc-950 text-zinc-950 font-semibold"
                    : "border-transparent text-zinc-500 hover:text-zinc-900 hover:border-zinc-300"
                }`}
                title={tab.prompt || tab.title}
              >
                <span className="truncate max-w-[120px]">{tab.title}</span>
              </button>
            );
          })}

          {/* Plus Button: Add New Sibling Sub-Branch Tab */}
          <button
            type="button"
            onClick={handleStartNewTab}
            className={`flex items-center justify-center px-2 pb-2.5 pt-1 text-[13px] font-medium transition-colors cursor-pointer select-none shrink-0 border-b-2 -mb-px ${
              isDraftingNewTab
                ? "border-zinc-950 text-zinc-950 font-semibold"
                : "border-transparent text-zinc-400 hover:text-zinc-900 hover:border-zinc-300"
            }`}
            title="Create new sub-branch query on this topic"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Close Side Branch View */}
        <div className="mb-2">
          <Button
            variant="ghost"
            size="iconSm"
            onClick={onClose}
            className="h-8 w-8 text-zinc-400 hover:text-zinc-900 shrink-0 cursor-pointer"
            title="Close branch view"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages Scroll Area or New Tab Starter View */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-sm bg-white"
      >
        {isDraftingNewTab ? (
          /* Blank Draft Tab Starter View - Coursera 2-Column Card Style */
          <div className="flex-1 flex flex-col justify-center max-w-xl mx-auto py-8 space-y-5 animate-in fade-in duration-150">
            <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <h3 className="text-sm font-semibold text-zinc-900">
                  Explorations for &ldquo;{displayContext}&rdquo;
                </h3>
                <span className="text-[11px] text-zinc-400 font-medium">Quick Starters</span>
              </div>

              {/* 2-Column Template Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {starterTemplates.map((tpl, i) => {
                  const Icon = tpl.icon;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleQuickPrompt(tpl.prompt)}
                      disabled={isStreaming}
                      className="p-3 rounded-xl border border-zinc-200/80 hover:border-zinc-400 hover:bg-zinc-50/50 text-left transition-all group flex items-start space-x-2.5 cursor-pointer shadow-2xs"
                    >
                      <div className="p-1.5 rounded-lg bg-zinc-100 text-zinc-600 group-hover:text-zinc-950 group-hover:bg-zinc-200/60 shrink-0 transition-colors">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-zinc-900 group-hover:text-zinc-950">
                          {tpl.title}
                        </div>
                        <p className="text-[11px] text-zinc-500 leading-snug mt-0.5">
                          {tpl.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Active Branch Conversation Messages - Rendered using single global ChatMessage component */
          <div className="space-y-1">
            {branchMessages.map((msg, index) => {
              const isLastAssistant =
                index === branchMessages.length - 1 &&
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
                />
              );
            })}
          </div>
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
