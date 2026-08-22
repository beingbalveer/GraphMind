"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { GitBranch, ArrowDown } from "lucide-react";
import { getNodeChildren } from "@graphmind/shared";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { BranchBreadcrumbs } from "./BranchBreadcrumbs";
import { GraphCanvas } from "../canvas/GraphCanvas";
import { FocusDrawer } from "../canvas/FocusDrawer";
import { CommandPalette } from "../canvas/CommandPalette";
import { WorkspaceModal } from "../workspace/WorkspaceModal";
import { ResizableSplitPane } from "./ResizableSplitPane";
import { BranchChatPane } from "./BranchChatPane";
import { Toast } from "@/components/ui/toast";
import { useChatStream } from "@/hooks/useChatStream";
import { useScrollAnchor } from "@/hooks/useScrollAnchor";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { Navbar, ViewMode } from "../layout/Navbar";
import {
  WorkspaceItem,
  fetchWorkspaces,
  createWorkspace,
  fetchGraphSnapshot,
  saveGraphDelta,
  snapshotToTree,
} from "@/lib/workspaceApi";

interface ChatContainerProps {
  initialWorkspaceId?: string;
  initialViewMode?: ViewMode;
}

export function ChatContainer({
  initialWorkspaceId,
  initialViewMode = "chat",
}: ChatContainerProps = {}) {
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
    loadTree,
  } = useChatStream();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceItem | null>(null);
  const [syncStatus, setSyncStatus] = useState<"saved" | "syncing" | "offline">("saved");
  const [drawerNodeId, setDrawerNodeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);

  // Parallel Split-Pane Side Branch State
  const [sideBranchNodeId, setSideBranchNodeId] = useState<string | null>(null);
  const [sideBranchExcerpt, setSideBranchExcerpt] = useState<string | null>(null);

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

  // Initialize or fetch workspace from backend and sync URL
  useEffect(() => {
    async function initWorkspace() {
      try {
        if (initialWorkspaceId) {
          const snapshot = await fetchGraphSnapshot(initialWorkspaceId);
          if (snapshot) {
            setCurrentWorkspace(snapshot.workspace);
            const loadedTree = snapshotToTree(snapshot);
            if (loadedTree) {
              loadTree(loadedTree);
            }
            if (typeof window !== "undefined") {
              window.history.replaceState(null, "", `/graph/${snapshot.workspace.id}`);
            }
            return;
          }
        }

        const list = await fetchWorkspaces();
        if (list && list.length > 0) {
          const ws = list[0];
          setCurrentWorkspace(ws);
          const snapshot = await fetchGraphSnapshot(ws.id);
          if (snapshot) {
            const loadedTree = snapshotToTree(snapshot);
            if (loadedTree) {
              loadTree(loadedTree);
            }
          }
          if (typeof window !== "undefined") {
            window.history.replaceState(null, "", `/graph/${ws.id}`);
          }
        } else {
          const created = await createWorkspace("Main Workspace", "Default knowledge tree");
          setCurrentWorkspace(created);
          if (typeof window !== "undefined") {
            window.history.replaceState(null, "", `/graph/${created.id}`);
          }
        }
      } catch {
        setSyncStatus("offline");
      }
    }
    initWorkspace();
  }, [initialWorkspaceId, loadTree]);

  // Auto-scroll when user is at the bottom in chat mode
  useEffect(() => {
    if (isAtBottom && viewMode === "chat") {
      scrollToBottom(false);
    }
  }, [activeMessages, isStreaming, isAtBottom, scrollToBottom, viewMode]);

  // Debounced auto-save to PostgreSQL backend whenever tree changes
  useEffect(() => {
    if (!currentWorkspace || !tree || !tree.rootNodeId) return;

    setSyncStatus("syncing");
    const timeout = setTimeout(async () => {
      const success = await saveGraphDelta(currentWorkspace.id, {
        workspaceUpdate: {
          name: currentWorkspace.name,
        },
      });
      setSyncStatus(success ? "saved" : "offline");
    }, 800);

    return () => clearTimeout(timeout);
  }, [tree, currentWorkspace]);

  // Jump smoothly to a specific message card in the active feed
  const handleJumpToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-zinc-900/40", "bg-zinc-100/60");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-zinc-900/40", "bg-zinc-100/60");
      }, 1200);
    }
  }, []);

  // Handle opening of parallel split pane from inline Obsidian-style blue links
  const handleOpenSideBranch = useCallback((leafId: string, excerpt: string) => {
    setSideBranchNodeId(leafId);
    setSideBranchExcerpt(excerpt);
  }, []);

  // Handle "🌿 Explain this" action from text selection tooltip
  const handleExplainBranch = useCallback(
    async (parentNodeId: string, highlightedText: string) => {
      setSideBranchExcerpt(highlightedText);

      const branchPrompt = `Explain "${highlightedText}" in concise, direct detail with key takeaways.`;

      await sendMessage(
        branchPrompt,
        "gemini",
        "gemini-2.5-flash",
        {
          branchOverride: { parentNodeId, highlightedText },
          preserveActiveNodeId: true,
          onNodeCreated: ({ assistantNodeId }) => {
            setSideBranchNodeId(assistantNodeId);
          },
        }
      );
    },
    [sendMessage]
  );

  // Switch to canvas and focus drawer when selecting a node in the graph
  const handleSelectTreeNode = useCallback((nodeId: string) => {
    switchBranch(nodeId);
    setDrawerNodeId(nodeId);
    setIsDrawerOpen(true);
  }, [switchBranch]);

  // Transition smoothly from Canvas view to Chat view focusing on a specific node
  const handleSwitchToChat = useCallback(
    (nodeId: string) => {
      switchBranch(nodeId);
      setViewMode("chat");
      setTimeout(() => {
        handleJumpToMessage(nodeId);
      }, 100);
    },
    [switchBranch, handleJumpToMessage]
  );

  // Keyboard navigation helpers
  const handlePrevBranch = useCallback(() => {
    if (!tree || activeMessages.length === 0) return;
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
    if (!tree || activeMessages.length === 0) return;
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
    if (sideBranchNodeId) {
      setSideBranchNodeId(null);
    } else if (isWorkspaceModalOpen) {
      setIsWorkspaceModalOpen(false);
    } else if (isPaletteOpen) {
      setIsPaletteOpen(false);
    } else if (isDrawerOpen) {
      setIsDrawerOpen(false);
    } else if (activeBranch) {
      clearBranchContext();
    }
  }, [sideBranchNodeId, isWorkspaceModalOpen, isPaletteOpen, isDrawerOpen, activeBranch, clearBranchContext]);

  useKeyboardShortcuts({
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
      title: "Raft vs Paxos Consensus",
      subtitle: "Leader election, log replication, and split-brain safety",
      icon: GitBranch,
      prompt: "Compare Raft vs Paxos consensus mechanisms in distributed systems. Focus on leader election and split-brain mitigation.",
    },
    {
      title: "Database Vector Indexing (HNSW vs IVFFlat)",
      subtitle: "Trade-offs in approximate nearest neighbor search",
      icon: GitBranch,
      prompt: "Break down the architectural trade-offs between HNSW and IVFFlat vector indexing for pgvector semantic search.",
    },
  ];

  return (
    <div className="h-screen w-screen flex flex-col bg-white overflow-hidden select-text">
      {/* Top Main Navigation Bar */}
      <Navbar
        viewMode={viewMode}
        onViewModeChange={(mode) => setViewMode(mode)}
        syncStatus={syncStatus}
        workspaceName={currentWorkspace?.name || "Main Workspace"}
        onOpenWorkspaceModal={() => setIsWorkspaceModalOpen(true)}
        messageCount={activeMessages.length}
        onClearChat={() => {
          clearMessages();
          setIsDrawerOpen(false);
          setSideBranchNodeId(null);
        }}
        breadcrumbs={
          <BranchBreadcrumbs
            messages={activeMessages}
            onJumpToMessage={handleJumpToMessage}
          />
        }
      />

      {/* Main Content Area: Split-Pane Chat View OR 2D Spatial Canvas */}
      <div className="flex-1 min-h-0 flex relative overflow-hidden">
        {viewMode === "canvas" ? (
          /* 2D Spatial Mind Map & Knowledge Graph Canvas View */
          <div className="w-full h-full relative">
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
          /* Resizable Parallel Split-Pane Chat View */
          <ResizableSplitPane
            isOpen={Boolean(sideBranchNodeId)}
            onClose={() => setSideBranchNodeId(null)}
            leftPane={
              <div className="h-full flex flex-col min-w-0 relative">
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
                              type="button"
                              onClick={() => {
                                sendMessage(item.prompt, "gemini", "gemini-2.5-flash");
                                scrollToBottom(true);
                              }}
                              className="p-3 rounded-xl border border-zinc-200/80 bg-zinc-50/50 hover:bg-zinc-100/80 hover:border-zinc-300 text-left transition-all duration-150 group cursor-pointer shadow-2xs"
                            >
                              <div className="w-6 h-6 rounded-md bg-white border border-zinc-200 flex items-center justify-center mb-2 text-zinc-700 group-hover:text-zinc-950 transition-colors shadow-2xs">
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <h3 className="text-xs font-semibold text-zinc-800 group-hover:text-zinc-950 mb-1 leading-snug">
                                {item.title}
                              </h3>
                              <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">
                                {item.subtitle}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    /* Main Active Lineage Branch Message Stream */
                    <div className="w-full pb-4">
                      {activeMessages.map((node, index) => {
                        const isLastAssistant =
                          index === activeMessages.length - 1 &&
                          node.role === "assistant" &&
                          isStreaming &&
                          !sideBranchNodeId;

                        return (
                          <ChatMessage
                            key={node.id}
                            message={{
                              ...node,
                              isStreaming: isLastAssistant,
                            }}
                            tree={tree}
                            onRetry={retryLastMessage}
                            onExploreBranch={handleExplainBranch}
                            onOpenSideBranch={handleOpenSideBranch}
                          />
                        );
                      })}
                      <div ref={bottomRef} />
                    </div>
                  )}
                </main>

                {/* Left Main Chat Input Bar */}
                <div className="relative shrink-0 bg-gradient-to-t from-white via-white to-transparent pt-2 z-20">
                  {showScrollButton && activeMessages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => scrollToBottom(true)}
                      className="absolute -top-9 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white border border-zinc-200 shadow-md text-zinc-700 hover:text-zinc-950 hover:border-zinc-300 text-xs font-medium flex items-center space-x-1.5 transition-all animate-in fade-in-50 slide-in-from-bottom-2 duration-150 cursor-pointer select-none"
                    >
                      <span>Scroll to bottom</span>
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  )}

                  <ChatInput
                    onSendMessage={(prompt, provider, model) => {
                      sendMessage(prompt, provider, model);
                      scrollToBottom(true);
                    }}
                    onStopStreaming={stopStreaming}
                    isStreaming={isStreaming}
                    activeBranch={activeBranch}
                    onClearBranch={clearBranchContext}
                  />
                </div>
              </div>
            }
            rightPane={
              sideBranchNodeId ? (
                <BranchChatPane
                  tree={tree}
                  branchLeafNodeId={sideBranchNodeId}
                  highlightedContext={sideBranchExcerpt || undefined}
                  isStreaming={isStreaming}
                  onClose={() => setSideBranchNodeId(null)}
                  onSendBranchMessage={(prompt, parentNodeId) => {
                    sendMessage(prompt, "gemini", "gemini-2.5-flash", {
                      branchOverride: { parentNodeId, highlightedText: "" },
                      preserveActiveNodeId: true,
                      onNodeCreated: ({ assistantNodeId }) => {
                        setSideBranchNodeId(assistantNodeId);
                      },
                    });
                  }}
                />
              ) : null
            }
          />
        )}
      </div>

      {/* Global Command Palette (⌘K) */}
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
          setSideBranchNodeId(null);
        }}
      />

      {/* Workspace Switcher & Export Modal */}
      <WorkspaceModal
        isOpen={isWorkspaceModalOpen}
        onClose={() => setIsWorkspaceModalOpen(false)}
        currentWorkspace={currentWorkspace}
        onSelectWorkspace={async (ws) => {
          setCurrentWorkspace(ws);
          setSideBranchNodeId(null);
          if (typeof window !== "undefined") {
            window.history.replaceState(null, "", `/graph/${ws.id}`);
          }
          const snapshot = await fetchGraphSnapshot(ws.id);
          if (snapshot) {
            const loadedTree = snapshotToTree(snapshot);
            loadTree(loadedTree);
          }
        }}
        activeTree={tree}
      />

      {/* Non-intrusive Floating Toast Notification */}
      <Toast message={error} onDismiss={clearError} />
    </div>
  );
}
