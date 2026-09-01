"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  GitBranch,
  CornerDownLeft,
  Loader2,
} from "lucide-react";
import {
  ConversationTree,
  TreeNode,
  getAncestorPath,
  getBranchLinearLeafNode,
} from "@graphmind/shared";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { ChatMessage } from "./ChatMessage";

export interface SidePeekEntry {
  nodeId: string;
  excerpt?: string;
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
  onPromoteToPrimary: (nodeId: string) => void;
  onSendMessage: (prompt: string, parentNodeId: string) => void;
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
  onPromoteToPrimary,
  onSendMessage,
  onExploreBranch,
  onRegenerate,
  onEditUserMessage,
  onSwitchBranch,
  onRateResponse,
}: SidePeekBranchSheetProps) {
  const [inputPrompt, setInputPrompt] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevNodeIdRef = useRef<string | null>(null);

  // Smooth mount/unmount animation lifecycle
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);

  // Cache last active entry so content stays rendered while sliding out
  const [cachedEntry, setCachedEntry] = useState<SidePeekEntry | null>(null);

  const activeEntry = historyStack[historyIndex] || null;

  useEffect(() => {
    if (activeEntry) {
      setCachedEntry(activeEntry);
    }
  }, [activeEntry]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isOpen) {
      setIsMounted(true);
      // Double rAF / short timeout ensures the initial translate-x-full is painted before transitioning to 0
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

  const currentEntry = activeEntry || cachedEntry;
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

  // Extract branch root index where this sub-branch diverged
  const branchRootIndex = useMemo(() => {
    for (let i = activeLineage.length - 1; i >= 0; i--) {
      if (activeLineage[i].highlightedContext) return i;
    }
    return 0;
  }, [activeLineage]);

  // Display only the messages belonging to this branch
  const branchMessages: TreeNode[] = useMemo(() => {
    if (branchRootIndex === -1 || activeLineage.length === 0) return activeLineage;
    return activeLineage.slice(branchRootIndex);
  }, [activeLineage, branchRootIndex]);

  const activeBranchRoot = activeLineage[branchRootIndex];
  const displayTitle =
    currentEntry?.excerpt ||
    activeBranchRoot?.highlightedContext ||
    (activeBranchRoot ? activeBranchRoot.content.slice(0, 32) + "…" : "Sub-branch");

  // Auto-scroll on new tokens or branch switch
  useEffect(() => {
    if (!scrollRef.current) return;
    const isNewNode = prevNodeIdRef.current !== currentNodeId;
    prevNodeIdRef.current = currentNodeId;

    if (isNewNode) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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
    if (!inputPrompt.trim() || isStreaming || !activeLeafNodeId) return;
    onSendMessage(inputPrompt.trim(), activeLeafNodeId);
    setInputPrompt("");
  };

  return (
    <>
      {/* Background Click-Catcher Backdrop: smoothly fades in/out and dismisses sheet on click */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-30 transition-opacity duration-300 ease-out ${
          isVisible ? "opacity-100 bg-black/10 backdrop-blur-[0.5px]" : "opacity-0 pointer-events-none"
        }`}
        title="Click outside to close (Esc)"
      />

      {/* Sliding Sheet Container */}
      <aside
        className={`fixed inset-y-0 right-0 z-40 w-full sm:w-[480px] md:w-[540px] lg:w-[580px] bg-white border-l border-zinc-200/90 shadow-2xl flex flex-col font-sans select-text transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
          isVisible ? "translate-x-0" : "translate-x-full pointer-events-none"
        }`}
      >
        {/* Top Navigation Header: Stack History Controls + Title + Make Primary + Close */}
        <div className="h-13 px-3 sm:px-4 border-b border-zinc-200/80 flex items-center justify-between shrink-0 bg-white/95 backdrop-blur-md select-none">
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
            <span className="text-xs font-semibold truncate max-w-[160px] sm:max-w-[220px]">
              {displayTitle}
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
              disabled={!activeLeafNodeId}
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

        {/* Messages Scroll Area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2 bg-white"
        >
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
          </div>
          <div ref={bottomRef} />
        </div>

        {/* Interactive In-Sheet Chat Input Bar */}
        <div className="p-3 sm:p-4 border-t border-zinc-200/80 bg-white shrink-0">
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder={`Reply to "${displayTitle}"...`}
              disabled={isStreaming}
              className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-zinc-200 bg-white text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 shadow-2xs disabled:bg-zinc-50 transition-all"
            />
            <button
              type="submit"
              disabled={!inputPrompt.trim() || isStreaming}
              className="absolute right-1.5 p-1.5 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
              title="Send follow-up in this branch"
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
    </>
  );
}
