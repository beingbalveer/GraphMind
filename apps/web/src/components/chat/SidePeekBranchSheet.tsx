"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  GitBranch,
  CornerDownLeft,
  Loader2,
  Plus,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  MoreVertical,
  Lightbulb,
  Code2,
  Scale,
  AlertTriangle,
} from "lucide-react";
import {
  ConversationTree,
  TreeNode,
  getAncestorPath,
  getBranchLinearLeafNode,
  getSiblingSubBranches,
} from "@graphmind/shared";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ChatMessage } from "./ChatMessage";

export interface SidePeekEntry {
  nodeId: string;
  excerpt?: string;
}

export interface SiblingTab {
  id: string;
  rootId: string;
  leafId: string;
  title: string;
  prompt: string;
  pinned?: boolean;
}

interface SidePeekBranchSheetProps {
  tree: ConversationTree | null;
  isOpen: boolean;
  historyStack: SidePeekEntry[];
  historyIndex: number;
  isStreaming?: boolean;
  streamingNodeId?: string | null;
  onClose: () => void;
  onNavigateBack: () => void;
  onNavigateForward: () => void;
  onPushBranch: (nodeId: string, excerpt?: string) => void;
  onOpenBranch?: (nodeId: string, excerpt?: string) => void;
  onPromoteToPrimary: (nodeId: string) => void;
  onSendMessage: (prompt: string, parentNodeId: string) => void;
  onSendNewSiblingBranch?: (prompt: string, parentNodeId: string, highlightedContext: string) => void;
  onSelectSiblingTab?: (leafId: string) => void;
  onDeleteBranch?: (rootNodeId: string) => void;
  onRenameBranch?: (rootNodeId: string, newTitle: string) => void;
  onTogglePinBranch?: (rootNodeId: string, pinned: boolean) => void;
  onExploreBranch?: (parentNodeId: string, highlightedText: string) => void;
  onRegenerate?: (nodeId: string) => void;
  onEditUserMessage?: (userNodeId: string, newContent: string) => void;
  onSwitchBranch?: (nodeId: string) => void;
  onRateResponse?: (nodeId: string, rating: "up" | "down" | null) => void;
}

export function SidePeekBranchSheet({
  tree,
  isOpen,
  historyStack,
  historyIndex,
  isStreaming = false,
  streamingNodeId = null,
  onClose,
  onNavigateBack,
  onNavigateForward,
  onPushBranch,
  onOpenBranch: _onOpenBranch,
  onPromoteToPrimary,
  onSendMessage,
  onSendNewSiblingBranch,
  onSelectSiblingTab,
  onDeleteBranch,
  onRenameBranch,
  onTogglePinBranch,
  onExploreBranch,
  onRegenerate,
  onEditUserMessage,
  onSwitchBranch,
  onRateResponse,
}: SidePeekBranchSheetProps) {
  const [inputPrompt, setInputPrompt] = useState("");
  const [isDraftingNewTab, setIsDraftingNewTab] = useState(false);
  const [openMenuTabId, setOpenMenuTabId] = useState<string | null>(null);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingTab, setDeletingTab] = useState<SiblingTab | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevNodeIdRef = useRef<string | null>(null);
  const scrollPositionsRef = useRef<Record<string, number>>({});

  // Smooth mount/unmount animation lifecycle
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);

  // Cache last active entry so content stays rendered while sliding out
  const [cachedEntry, setCachedEntry] = useState<SidePeekEntry | null>(null);

  const activeEntry = historyStack[historyIndex] || null;

  useEffect(() => {
    if (activeEntry) {
      setCachedEntry(activeEntry);
      setIsDraftingNewTab(false);
    }
  }, [activeEntry]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isOpen) {
      setIsMounted(true);
      timeout = setTimeout(() => {
        setIsVisible(true);
      }, 16);
    } else {
      setIsVisible(false);
      timeout = setTimeout(() => {
        setIsMounted(false);
      }, 320);
    }
    return () => clearTimeout(timeout);
  }, [isOpen]);

  const currentEntry = (isOpen && historyStack.length > 0)
    ? (historyStack[historyIndex] || historyStack[historyStack.length - 1] || null)
    : cachedEntry;
  const currentNodeId = currentEntry?.nodeId || null;

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < historyStack.length - 1;

  // Resolve active linear leaf for the current entry
  const activeLeafNodeId = useMemo(() => {
    if (!tree || !currentNodeId || !tree.nodes[currentNodeId]) return currentNodeId;
    return getBranchLinearLeafNode(tree, currentNodeId).id;
  }, [tree, currentNodeId]);

  // Compute the full ancestor path to the active leaf node
  const activeLineage: TreeNode[] = useMemo(() => {
    if (!tree || !activeLeafNodeId || !tree.nodes[activeLeafNodeId]) return [];
    return getAncestorPath(tree, activeLeafNodeId);
  }, [tree, activeLeafNodeId]);

  // Isolate branch root index and context based on active history level
  const { branchRootIndex, activeBranchRoot, parentNodeId, siblingMatchContext, displayContext } = useMemo(() => {
    if (!tree || activeLineage.length === 0) {
      return {
        branchRootIndex: 0,
        activeBranchRoot: null,
        parentNodeId: null,
        siblingMatchContext: null,
        displayContext: currentEntry?.excerpt || "Topic",
      };
    }

    // Determine the minimum lineage index for the current branch:
    // If we navigated here from a parent history entry, this branch must start AFTER that parent.
    let minSearchIndex = 0;
    if (historyIndex > 0 && historyStack[historyIndex - 1]) {
      const parentHistoryNodeId = historyStack[historyIndex - 1].nodeId;
      const parentIdx = activeLineage.findIndex((n) => n.id === parentHistoryNodeId);
      if (parentIdx !== -1) {
        minSearchIndex = parentIdx + 1;
      } else {
        // If the exact leaf ID wasn't directly in activeLineage, find ancestor intersection
        const parentAncestors = getAncestorPath(tree, parentHistoryNodeId);
        const parentAncestorIds = new Set(parentAncestors.map((n) => n.id));
        for (let i = activeLineage.length - 1; i >= 0; i--) {
          if (parentAncestorIds.has(activeLineage[i].id)) {
            minSearchIndex = i + 1;
            break;
          }
        }
      }
    }

    let rootIndex = 0;
    let rootNode: TreeNode | null = null;
    let pNodeId: string | null = null;
    let matchCtx: string | null = null;

    // 1. Search backwards in [minSearchIndex, activeLineage.length - 1] for highlightedContext
    for (let i = activeLineage.length - 1; i >= minSearchIndex; i--) {
      if (activeLineage[i].highlightedContext) {
        rootIndex = i;
        rootNode = activeLineage[i];
        pNodeId = rootNode.parentId || (i > 0 ? activeLineage[i - 1].id : null);
        matchCtx = rootNode.highlightedContext || null;
        break;
      }
    }

    // 2. If no highlightedContext in range, but minSearchIndex > 0
    if (!matchCtx && minSearchIndex > 0 && minSearchIndex < activeLineage.length) {
      rootIndex = minSearchIndex;
      rootNode = activeLineage[minSearchIndex];
      pNodeId = rootNode.parentId || activeLineage[minSearchIndex - 1].id;
      matchCtx = rootNode.highlightedContext || currentEntry?.excerpt || null;
    }

    // 3. Fallback when minSearchIndex === 0: scan whole lineage backwards
    if (!matchCtx && minSearchIndex === 0) {
      for (let i = activeLineage.length - 1; i >= 0; i--) {
        if (activeLineage[i].highlightedContext) {
          rootIndex = i;
          rootNode = activeLineage[i];
          pNodeId = rootNode.parentId || (i > 0 ? activeLineage[i - 1].id : null);
          matchCtx = rootNode.highlightedContext || null;
          break;
        }
      }
    }

    if (!rootNode) {
      rootNode = activeLineage[0];
      pNodeId = null;
    }

    const dispCtx =
      matchCtx ||
      currentEntry?.excerpt ||
      (rootNode ? rootNode.content.slice(0, 32) + "…" : "Topic");

    return {
      branchRootIndex: rootIndex,
      activeBranchRoot: rootNode,
      parentNodeId: pNodeId,
      siblingMatchContext: matchCtx,
      displayContext: dispCtx,
    };
  }, [tree, activeLineage, historyStack, historyIndex, currentEntry]);

  // Display only the messages belonging to this branch
  const branchMessages: TreeNode[] = useMemo(() => {
    if (branchRootIndex === -1 || activeLineage.length === 0) return activeLineage;
    return activeLineage.slice(branchRootIndex);
  }, [activeLineage, branchRootIndex]);

  // Discover all sibling sub-branches stemming from the same parent context
  const siblingTabs: SiblingTab[] = useMemo(() => {
    const customActiveTitle =
      typeof activeBranchRoot?.metadata?.title === "string"
        ? (activeBranchRoot.metadata.title as string)
        : undefined;
    const singleTabTitle: string =
      customActiveTitle ||
      activeBranchRoot?.highlightedContext ||
      currentEntry?.excerpt ||
      "Branch 1";
    const isPinned = Boolean(activeBranchRoot?.metadata?.pinned);

    if (!tree || !parentNodeId) {
      return [
        {
          id: activeLeafNodeId || currentNodeId || "tab-1",
          rootId: activeBranchRoot?.id || currentNodeId || "root-1",
          leafId: activeLeafNodeId || currentNodeId || "leaf-1",
          title: singleTabTitle,
          prompt: activeBranchRoot?.content || singleTabTitle,
          pinned: isPinned,
        },
      ];
    }

    const siblingRoots = getSiblingSubBranches(tree, parentNodeId, siblingMatchContext);
    if (siblingRoots.length === 0) {
      return [
        {
          id: activeLeafNodeId || currentNodeId || "tab-1",
          rootId: activeBranchRoot?.id || currentNodeId || "root-1",
          leafId: activeLeafNodeId || currentNodeId || "leaf-1",
          title: singleTabTitle,
          prompt: activeBranchRoot?.content || singleTabTitle,
          pinned: isPinned,
        },
      ];
    }

    return siblingRoots.map((rootNode, index) => {
      const linearLeaf = getBranchLinearLeafNode(tree, rootNode.id);
      const isTabPinned = Boolean(rootNode.metadata?.pinned);
      const customTitle = rootNode.metadata?.title as string | undefined;
      const defaultTitle =
        rootNode.highlightedContext ||
        (siblingRoots.length === 1 ? singleTabTitle : `Branch ${index + 1}`);

      return {
        id: rootNode.id,
        rootId: rootNode.id,
        leafId: linearLeaf.id,
        title: customTitle || defaultTitle,
        prompt: rootNode.content,
        pinned: isTabPinned,
      };
    });
  }, [tree, parentNodeId, siblingMatchContext, activeBranchRoot, activeLeafNodeId, currentNodeId, currentEntry]);

  // Tab Rename Handlers
  const startRename = useCallback((tab: SiblingTab) => {
    setRenamingTabId(tab.id);
    setRenameValue(tab.title);
    setTimeout(() => renameInputRef.current?.focus(), 50);
  }, []);

  const commitRename = useCallback(() => {
    if (!renamingTabId || !renameValue.trim()) {
      setRenamingTabId(null);
      return;
    }
    onRenameBranch?.(renamingTabId, renameValue.trim());
    setRenamingTabId(null);
  }, [renamingTabId, renameValue, onRenameBranch]);

  // Tab Switching
  const handleSelectTab = useCallback(
    (leafId: string) => {
      if (scrollRef.current && currentNodeId) {
        scrollPositionsRef.current[currentNodeId] = scrollRef.current.scrollTop;
      }
      setIsDraftingNewTab(false);
      onSelectSiblingTab?.(leafId);
    },
    [currentNodeId, onSelectSiblingTab]
  );

  const handleStartNewTab = useCallback(() => {
    if (scrollRef.current && currentNodeId) {
      scrollPositionsRef.current[currentNodeId] = scrollRef.current.scrollTop;
    }
    setIsDraftingNewTab(true);
    setInputPrompt("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [currentNodeId]);

  // Quick Starter Prompts
  const handleQuickPrompt = (template: string) => {
    if (!parentNodeId || isStreaming) return;
    const prompt = template.replace("{topic}", displayContext);
    onSendNewSiblingBranch?.(prompt, parentNodeId, displayContext);
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

  // Auto-scroll on new tokens or branch switch
  useEffect(() => {
    if (!scrollRef.current) return;
    const isNewNode = prevNodeIdRef.current !== currentNodeId;
    prevNodeIdRef.current = currentNodeId;

    if (isNewNode) {
      if (currentNodeId && scrollPositionsRef.current[currentNodeId] !== undefined) {
        scrollRef.current.scrollTop = scrollPositionsRef.current[currentNodeId];
      } else {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    } else if (isStreaming && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [branchMessages, isStreaming, currentNodeId]);

  // Keyboard navigation shortcuts: ⌘[ / ⌘] to go back/forward, Esc to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "[") {
        e.preventDefault();
        if (canGoBack) onNavigateBack();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "]") {
        e.preventDefault();
        if (canGoForward) onNavigateForward();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, canGoBack, canGoForward, onNavigateBack, onNavigateForward, onClose]);

  if (!isMounted || !currentEntry || !currentNodeId) return null;

  const fullText = branchMessages
    .map((m) => `${m.role === "user" ? "### You" : "### AI"}:\n${m.content}`)
    .join("\n\n---\n\n");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPrompt.trim() || isStreaming) return;

    if (isDraftingNewTab) {
      if (parentNodeId) {
        onSendNewSiblingBranch?.(inputPrompt.trim(), parentNodeId, displayContext);
        setIsDraftingNewTab(false);
      }
    } else if (activeLeafNodeId) {
      onSendMessage(inputPrompt.trim(), activeLeafNodeId);
    }
    setInputPrompt("");
  };

  return (
    <>
      {/* Invisible Click-Catcher Backdrop: allows clicking anywhere outside to dismiss */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-30 ${
          isVisible ? "block bg-transparent" : "hidden pointer-events-none"
        }`}
        title="Click outside to close (Esc)"
      />

      {/* Sliding Sheet Container */}
      <aside
        className={`fixed inset-y-0 right-0 z-40 w-full sm:w-[480px] md:w-[540px] lg:w-[580px] bg-white border-l border-zinc-200/90 shadow-2xl flex flex-col font-sans select-text transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
          isVisible ? "translate-x-0" : "translate-x-full pointer-events-none"
        }`}
      >
        {/* Top Bar: History Navigation + Excerpt Title Badge + Actions */}
        <div className="h-11 px-3 sm:px-4 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-white/95 backdrop-blur-md select-none">
          {/* Left: Back / Forward History Navigation Buttons */}
          <div className="flex items-center space-x-1 shrink-0">
            <Button
              variant="ghost"
              size="iconSm"
              disabled={!canGoBack}
              onClick={onNavigateBack}
              className="h-7 w-7 text-zinc-600 hover:text-zinc-950 disabled:opacity-30 disabled:hover:text-zinc-600 cursor-pointer"
              title="Go back (⌘[)"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="iconSm"
              disabled={!canGoForward}
              onClick={onNavigateForward}
              className="h-7 w-7 text-zinc-600 hover:text-zinc-950 disabled:opacity-30 disabled:hover:text-zinc-600 cursor-pointer"
              title="Go forward (⌘])"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>

            {/* Depth Counter Badge */}
            {historyStack.length > 1 && (
              <span className="text-[10px] font-mono text-zinc-400 px-1.5 py-0.5 rounded-md bg-zinc-100 border border-zinc-200/60 ml-0.5">
                {historyIndex + 1}/{historyStack.length}
              </span>
            )}
          </div>

          {/* Center: Branch Context Badge */}
          <div className="flex items-center space-x-1.5 min-w-0 mx-2 px-2 py-0.5 rounded-lg bg-zinc-100/90 border border-zinc-200/80 text-zinc-800">
            <GitBranch className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="text-xs font-semibold truncate max-w-[140px] sm:max-w-[200px]">
              {displayContext}
            </span>
          </div>

          {/* Right: Actions (Copy + Make Primary + Close) */}
          <div className="flex items-center space-x-1 shrink-0">
            <CopyButton
              text={fullText}
              title="Copy branch conversation"
            />

            {/* Promote to Primary Chat Button */}
            <Button
              variant="ghost"
              size="iconSm"
              disabled={!activeLeafNodeId || isDraftingNewTab}
              onClick={() => {
                if (activeLeafNodeId) onPromoteToPrimary(activeLeafNodeId);
              }}
              className="h-7 w-7 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 disabled:opacity-30 cursor-pointer"
              title="Make this the primary chat (Open full view)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </Button>

            <div className="w-px h-3.5 bg-zinc-200 mx-0.5" />

            <Button
              variant="ghost"
              size="iconSm"
              onClick={onClose}
              className="h-7 w-7 text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100 cursor-pointer"
              title="Close side peek (Esc)"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Sub-Header Sibling Sub-Branch Tabs Bar */}
        <div className="h-10 px-3 sm:px-4 border-b border-zinc-200/80 flex items-center justify-between shrink-0 bg-zinc-50/70 select-none overflow-x-auto no-scrollbar">
          <div className="flex items-center space-x-1.5 min-w-0 pr-2">
            {siblingTabs.map((tab) => {
              const isActive = !isDraftingNewTab && (tab.leafId === activeLeafNodeId || tab.rootId === currentNodeId);
              const isRenaming = renamingTabId === tab.id;

              return (
                <div
                  key={tab.id}
                  onClick={() => !isRenaming && handleSelectTab(tab.leafId)}
                  className={`group relative flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer select-none shrink-0 ${
                    isActive
                      ? "bg-white text-zinc-950 shadow-2xs border border-zinc-200 font-semibold"
                      : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60"
                  }`}
                  title={tab.prompt || tab.title}
                >
                  {tab.pinned && (
                    <Pin className="w-3 h-3 text-emerald-600 shrink-0 fill-emerald-600/20" />
                  )}

                  {isRenaming ? (
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitRename();
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setRenamingTabId(null);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-white border border-zinc-400 rounded px-1 py-0.5 text-xs text-zinc-950 outline-none max-w-[100px]"
                    />
                  ) : (
                    <span className="truncate max-w-[110px]">{tab.title}</span>
                  )}

                  {/* Context menu for tab actions */}
                  {!isRenaming && (
                    <div
                      className={`flex items-center justify-center transition-opacity shrink-0 ${
                        openMenuTabId === tab.id
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100"
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu
                        align="right"
                        onOpenChange={(isOpen) => setOpenMenuTabId(isOpen ? tab.id : null)}
                        trigger={
                          <div className="p-0.5 rounded hover:bg-zinc-200 text-zinc-400 hover:text-zinc-800 transition-colors cursor-pointer flex items-center justify-center">
                            <MoreVertical className="w-3 h-3" />
                          </div>
                        }
                        items={[
                          {
                            label: tab.pinned ? "Unpin" : "Pin",
                            icon: tab.pinned ? (
                              <PinOff className="w-3.5 h-3.5" />
                            ) : (
                              <Pin className="w-3.5 h-3.5" />
                            ),
                            onClick: () => onTogglePinBranch?.(tab.rootId, !tab.pinned),
                          },
                          {
                            label: "Rename",
                            icon: <Pencil className="w-3.5 h-3.5" />,
                            onClick: () => startRename(tab),
                          },
                          {
                            label: "Delete",
                            icon: <Trash2 className="w-3.5 h-3.5" />,
                            variant: "destructive",
                            onClick: () => setDeletingTab(tab),
                          },
                        ]}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Plus Button: Add New Sibling Sub-Branch Tab */}
            <button
              type="button"
              onClick={handleStartNewTab}
              className={`flex items-center justify-center p-1 rounded-md transition-colors cursor-pointer select-none shrink-0 ${
                isDraftingNewTab
                  ? "bg-zinc-900 text-white shadow-2xs"
                  : "text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200/60"
              }`}
              title="Create new sub-branch exploration on this topic"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Messages Scroll Area or New Tab Starter View */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2 bg-white"
        >
          {isDraftingNewTab ? (
            /* Blank Draft Tab Starter View */
            <div className="flex-1 flex flex-col justify-center max-w-xl mx-auto py-6 space-y-4 animate-in fade-in duration-150">
              <div className="rounded-2xl border border-zinc-200/90 bg-zinc-50/50 p-4 shadow-2xs space-y-3.5">
                <div className="flex items-center justify-between border-b border-zinc-200/60 pb-2.5">
                  <h3 className="text-xs font-semibold text-zinc-900">
                    Explore &ldquo;{displayContext}&rdquo;
                  </h3>
                  <span className="text-[10px] text-zinc-400 font-medium">Quick Starters</span>
                </div>

                {/* 2-Column Quick Starter Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {starterTemplates.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleQuickPrompt(item.prompt)}
                        className="p-2.5 rounded-xl border border-zinc-200/80 bg-white hover:bg-zinc-50 hover:border-zinc-300 text-left transition-all duration-150 group cursor-pointer shadow-2xs"
                      >
                        <div className="flex items-center space-x-2 mb-1">
                          <div className="p-1 rounded bg-zinc-100 text-zinc-700 group-hover:text-zinc-950">
                            <Icon className="w-3 h-3" />
                          </div>
                          <h4 className="text-xs font-semibold text-zinc-900 leading-snug">
                            {item.title}
                          </h4>
                        </div>
                        <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">
                          {item.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {(() => {
                const lastUserIndex = branchMessages.map((m) => m.role).lastIndexOf("user");
                const lastAssistantIndex = branchMessages.map((m) => m.role).lastIndexOf("assistant");

                return branchMessages.map((msg, index) => {
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
                      isLastUserMessage={index === lastUserIndex}
                      isLastAssistantMessage={index === lastAssistantIndex}
                      onRegenerate={onRegenerate}
                      onEditUserMessage={onEditUserMessage}
                      onSwitchBranch={onSwitchBranch}
                      onExploreBranch={onExploreBranch}
                      onOpenSideBranch={(childLeafId, excerpt) => {
                        onPushBranch(childLeafId, excerpt);
                      }}
                      onRateResponse={onRateResponse}
                    />
                  );
                });
              })()}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Interactive In-Sheet Chat Input Bar */}
        <div className="p-3 sm:p-4 border-t border-zinc-200/80 bg-white shrink-0">
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder={
                isDraftingNewTab
                  ? `Ask a new question about "${displayContext}"...`
                  : `Reply to "${displayContext}"...`
              }
              disabled={isStreaming}
              className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-zinc-200 bg-white text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 shadow-2xs disabled:bg-zinc-50 transition-all"
            />
            <button
              type="submit"
              disabled={!inputPrompt.trim() || isStreaming}
              className="absolute right-1.5 p-1.5 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
              title={isDraftingNewTab ? "Start new branch exploration" : "Send follow-up in this branch"}
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

      {/* Confirm Delete Branch Dialog */}
      {deletingTab && (
        <ConfirmDialog
          isOpen={Boolean(deletingTab)}
          onClose={() => setDeletingTab(null)}
          onConfirm={() => {
            if (deletingTab) {
              onDeleteBranch?.(deletingTab.rootId);
              setDeletingTab(null);
            }
          }}
          title="Delete Branch"
          description={`Are you sure you want to delete "${deletingTab.title}"? All messages in this branch will be permanently removed.`}
          confirmText="Delete"
          variant="destructive"
        />
      )}
    </>
  );
}
