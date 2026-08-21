"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Terminal, Cpu, GitBranch, ArrowDown } from "lucide-react";
import { getNodeChildren } from "@graphmind/shared";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { BranchBreadcrumbs } from "./BranchBreadcrumbs";
import { TreeSidebar } from "../tree/TreeSidebar";
import { GraphCanvas } from "../canvas/GraphCanvas";
import { FocusDrawer } from "../canvas/FocusDrawer";
import { CommandPalette } from "../canvas/CommandPalette";
import { Toast } from "@/components/ui/toast";
import { useChatStream } from "@/hooks/useChatStream";
import { useScrollAnchor } from "@/hooks/useScrollAnchor";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { Navbar, ViewMode } from "../layout/Navbar";

export function ChatContainer() {
  const {
    tree,
    activeMessages,
    isStreaming,
    error,
    activeBranch,
    setBranchContext,
    clearBranchContext,
    switchBranch,
    clearError,
    sendMessage,
    retryLastMessage,
    stopStreaming,
    clearMessages,
  } = useChatStream();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [drawerNodeId, setDrawerNodeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("chat");

  const fitViewRef = useRef<(() => void) | null>(null);
  const centerActiveRef = useRef<(() => void) | null>(null);
  const autoLayoutRef = useRef<(() => void) | null>(null);

  const {
    scrollRef,
    bottomRef,
    isAtBottom,
    showScrollButton,
    scrollToBottom,
  } = useScrollAnchor({ threshold: 80 });

  // Auto-scroll when user is at the bottom in chat mode
  useEffect(() => {
    if (isAtBottom && viewMode === "chat") {
      scrollToBottom(false);
    }
  }, [activeMessages, isStreaming, isAtBottom, scrollToBottom, viewMode]);

  const handleJumpToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(messageId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const handleSelectTreeNode = useCallback(
    (nodeId: string) => {
      switchBranch(nodeId);
      setDrawerNodeId(nodeId);
      if (viewMode === "canvas") {
        setIsDrawerOpen(true);
      } else {
        setTimeout(() => {
          handleJumpToMessage(nodeId);
        }, 50);
      }
    },
    [switchBranch, handleJumpToMessage, viewMode]
  );

  const handleSwitchToChat = useCallback(
    (nodeId: string) => {
      switchBranch(nodeId);
      setViewMode("chat");
      setIsDrawerOpen(false);
      setTimeout(() => {
        handleJumpToMessage(nodeId);
      }, 50);
    },
    [switchBranch, handleJumpToMessage]
  );

  // Power-user Keyboard navigation
  const handlePrevBranch = useCallback(() => {
    if (!tree) return;
    for (let i = activeMessages.length - 1; i >= 0; i--) {
      const node = activeMessages[i];
      if (node.parentId) {
        const siblings = getNodeChildren(tree, node.parentId);
        if (siblings.length > 1) {
          const currentIndex = siblings.findIndex((s) => s.id === node.id);
          const prevIndex = (currentIndex - 1 + siblings.length) % siblings.length;
          switchBranch(siblings[prevIndex].id);
          setDrawerNodeId(siblings[prevIndex].id);
          return;
        }
      }
    }
  }, [tree, activeMessages, switchBranch]);

  const handleNextBranch = useCallback(() => {
    if (!tree) return;
    for (let i = activeMessages.length - 1; i >= 0; i--) {
      const node = activeMessages[i];
      if (node.parentId) {
        const siblings = getNodeChildren(tree, node.parentId);
        if (siblings.length > 1) {
          const currentIndex = siblings.findIndex((s) => s.id === node.id);
          const nextIndex = (currentIndex + 1) % siblings.length;
          switchBranch(siblings[nextIndex].id);
          setDrawerNodeId(siblings[nextIndex].id);
          return;
        }
      }
    }
  }, [tree, activeMessages, switchBranch]);

  const handleJumpToRoot = useCallback(() => {
    if (!tree) return;
    switchBranch(tree.rootNodeId);
    setDrawerNodeId(tree.rootNodeId);
    if (viewMode === "chat") {
      setTimeout(() => {
        handleJumpToMessage(tree.rootNodeId);
      }, 50);
    }
  }, [tree, switchBranch, handleJumpToMessage, viewMode]);

  const handleEscape = useCallback(() => {
    if (isPaletteOpen) {
      setIsPaletteOpen(false);
    } else if (isDrawerOpen) {
      setIsDrawerOpen(false);
    } else if (isSidebarOpen) {
      setIsSidebarOpen(false);
    } else if (activeBranch) {
      clearBranchContext();
    }
  }, [isPaletteOpen, isDrawerOpen, isSidebarOpen, activeBranch, clearBranchContext]);

  useKeyboardShortcuts({
    onToggleSidebar: () => setIsSidebarOpen((prev) => !prev),
    onPrevBranch: handlePrevBranch,
    onNextBranch: handleNextBranch,
    onJumpToRoot: handleJumpToRoot,
    onEscape: handleEscape,
    onFitView: () => fitViewRef.current?.(),
    onCenterActive: () => centerActiveRef.current?.(),
    onAutoLayout: () => autoLayoutRef.current?.(),
    onCommandPalette: () => setIsPaletteOpen((prev) => !prev),
  });

  const activeDrawerNode = (tree && drawerNodeId && tree.nodes[drawerNodeId])
    ? tree.nodes[drawerNodeId]
    : (tree && tree.nodes[tree.activeNodeId]) || null;

  const starterPrompts = [
    {
      title: "Explain LangGraph & State Machines",
      subtitle: "How cyclical graph workflows differ from DAGs in AI systems",
      icon: GitBranch,
      prompt: "Explain how LangGraph state machines manage cyclical multi-agent workflows and how they differ from linear DAG execution.",
    },
    {
      title: "FastAPI Dependency Injection & Async Architecture",
      subtitle: "Best practices for high-concurrency streaming APIs",
      icon: Terminal,
      prompt: "Explain the architecture of FastAPI dependency injection (`Depends`), async generators, and how to stream Server-Sent Events (SSE) efficiently.",
    },
    {
      title: "Graph-Native Knowledge Trees",
      subtitle: "Why linear chat is insufficient for deep technical learning",
      icon: Cpu,
      prompt: "Why is linear chat insufficient for complex knowledge exploration, and how does graph-based conversation branching improve learning retention?",
    },
  ];

  return (
    <div className="w-screen h-screen flex flex-col bg-white overflow-hidden font-sans selection:bg-zinc-200 selection:text-zinc-900">
      <Navbar
        onClearChat={() => {
          clearMessages();
          setIsDrawerOpen(false);
          setIsPaletteOpen(false);
        }}
        messageCount={activeMessages.length}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        breadcrumbs={
          <BranchBreadcrumbs
            messages={activeMessages}
            onJumpToMessage={handleJumpToMessage}
          />
        }
      />

      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Collapsible Tree Sidebar */}
        <TreeSidebar
          tree={tree}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onSelectNode={handleSelectTreeNode}
        />

        {/* Main Content Area (Chat View or 2D Spatial Canvas) */}
        <div className="flex-1 flex flex-col min-w-0 bg-white relative">
          {viewMode === "canvas" ? (
            /* Infinite 2D Spatial Graph Canvas View */
            <div className="flex-1 min-h-0 relative">
              <GraphCanvas
                tree={tree}
                isStreaming={isStreaming}
                onSelectNode={handleSelectTreeNode}
                onExploreBranch={(nodeId, text) => {
                  setBranchContext(nodeId, text || "");
                  setIsDrawerOpen(true);
                }}
                onSwitchToChat={handleSwitchToChat}
                onRetry={retryLastMessage}
                onFitViewRef={fitViewRef}
                onCenterActiveRef={centerActiveRef}
                onAutoLayoutRef={autoLayoutRef}
              />

              {/* Side Focus Reader Drawer */}
              <FocusDrawer
                node={activeDrawerNode}
                tree={tree}
                isOpen={isDrawerOpen}
                isStreaming={isStreaming}
                onClose={() => setIsDrawerOpen(false)}
                onSelectBranch={(childId) => {
                  switchBranch(childId);
                  setDrawerNodeId(childId);
                }}
                onExploreBranch={(parentId, highlightedText) => {
                  setBranchContext(parentId, highlightedText);
                }}
                onSendFollowUp={(prompt, parentId, highlightedText) => {
                  sendMessage(prompt, "gemini", "gemini-2.5-flash", {
                    parentNodeId: parentId,
                    highlightedText: highlightedText || "",
                  });
                }}
              />
            </div>
          ) : (
            /* Dedicated Scrollable Feed for Active Lineage Branch */
            <main
              ref={scrollRef}
              className="flex-1 overflow-y-auto min-h-0 flex flex-col bg-white"
            >
              {activeMessages.length === 0 ? (
                /* Clean Empty State */
                <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto px-4 py-8 text-center space-y-8 my-auto">
                  <div className="space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center font-bold text-lg mx-auto shadow-xs">
                      🧠
                    </div>
                    <h2 className="text-xl font-semibold text-zinc-900 tracking-tight">
                      Where knowledge connects
                    </h2>
                    <p className="text-xs sm:text-sm text-zinc-500 max-w-sm mx-auto leading-relaxed">
                      Ask a technical question, explore system architecture, or test streaming.
                    </p>
                  </div>

                  {/* Quick Starter Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full text-left">
                    {starterPrompts.map((item, index) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={index}
                          onClick={() => {
                            sendMessage(item.prompt);
                            scrollToBottom(true);
                          }}
                          className="p-3.5 rounded-xl border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/70 transition-all text-left group flex flex-col justify-between space-y-2 cursor-pointer"
                        >
                          <Icon className="w-4 h-4 text-zinc-400 group-hover:text-zinc-700 transition-colors" />
                          <div>
                            <div className="text-xs font-semibold text-zinc-800">
                              {item.title}
                            </div>
                            <div className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">
                              {item.subtitle}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Active Lineage Branch Message Stream */
                <div className="w-full pb-4">
                  {activeMessages.map((node, index) => {
                    const nextActiveNode = activeMessages[index + 1];
                    const isLastAssistant =
                      index === activeMessages.length - 1 &&
                      node.role === "assistant" &&
                      isStreaming;

                    return (
                      <ChatMessage
                        key={node.id}
                        message={{
                          ...node,
                          isStreaming: isLastAssistant,
                        }}
                        tree={tree}
                        activeChildId={nextActiveNode?.id}
                        onRetry={retryLastMessage}
                        onExploreBranch={(id, text) => {
                          setBranchContext(id, text);
                          scrollToBottom(true);
                        }}
                        onSelectBranch={(childId) => {
                          switchBranch(childId);
                        }}
                      />
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
              )}
            </main>
          )}

          {/* Permanently Static Bottom Input Bar with Floating Jump Button */}
          <div className="relative shrink-0 bg-gradient-to-t from-white via-white to-transparent pt-2 z-20">
            {viewMode === "chat" && showScrollButton && activeMessages.length > 0 && (
              <button
                type="button"
                onClick={() => scrollToBottom(true)}
                className="absolute -top-9 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white border border-zinc-200 shadow-md text-zinc-700 hover:text-zinc-950 hover:border-zinc-300 text-xs font-medium flex items-center space-x-1.5 transition-all animate-in fade-in-50 slide-in-from-bottom-2 duration-150 cursor-pointer select-none"
                title="Scroll to bottom"
              >
                <ArrowDown className="w-3.5 h-3.5" />
                <span>Latest messages</span>
              </button>
            )}

            <ChatInput
              onSendMessage={(prompt, provider, model) => {
                sendMessage(prompt, provider, model);
                if (viewMode === "chat") {
                  scrollToBottom(true);
                }
              }}
              onStopStreaming={stopStreaming}
              isStreaming={isStreaming}
              activeBranch={activeBranch}
              onClearBranch={clearBranchContext}
            />
          </div>
        </div>
      </div>

      {/* Command Palette (⌘K) */}
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        tree={tree}
        viewMode={viewMode}
        onSelectNode={handleSelectTreeNode}
        onToggleViewMode={() => setViewMode((prev) => (prev === "chat" ? "canvas" : "chat"))}
        onFitView={() => fitViewRef.current?.()}
        onCenterActive={() => centerActiveRef.current?.()}
        onAutoLayout={() => autoLayoutRef.current?.()}
        onClearChat={() => {
          clearMessages();
          setIsDrawerOpen(false);
        }}
      />

      {/* Non-intrusive Floating Toast Notification */}
      <Toast message={error} onDismiss={clearError} />
    </div>
  );
}
