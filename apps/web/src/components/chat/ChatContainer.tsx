"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, ArrowDown } from "lucide-react";

import { getNodeChildren, getBranchLinearLeafNode, getAncestorPath, TreeNode } from "@graphmind/shared";




import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { BranchBreadcrumbs, BreadcrumbStep } from "./BranchBreadcrumbs";

import { ChatSidebar } from "./ChatSidebar";
import { GraphCanvas } from "../canvas/GraphCanvas";
import { FocusDrawer } from "../canvas/FocusDrawer";
import { CommandPalette } from "../canvas/CommandPalette";
import { WorkspaceModal } from "../workspace/WorkspaceModal";
import { ResizableSplitPane } from "./ResizableSplitPane";
import { BranchChatPane } from "./BranchChatPane";
import { Toast } from "@/components/ui/toast";
import { LogoBadge } from "@/components/ui/Logo";
import { useChatStream } from "@/hooks/useChatStream";
import { useScrollAnchor } from "@/hooks/useScrollAnchor";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { Navbar, ViewMode } from "../layout/Navbar";
import {
  buildWorkspaceUrl,
  buildChatUrl,
  buildCanvasUrl,
} from "@/lib/urls";
import {
  WorkspaceItem,
  ChatItem,
  fetchWorkspaces,
  createWorkspace,
  fetchWorkspaceChats,
  deleteWorkspaceChat,
  renameWorkspaceChat,
  togglePinWorkspaceChat,
  updateWorkspaceNodeMetadata,
  updateWorkspaceNodeContent,
  fetchGraphSnapshot,
  addNodeToWorkspace,

  snapshotToTree,
  seedDemoWorkspace,
} from "@/lib/workspaceApi";



interface ChatContainerProps {
  initialWorkspaceId?: string;
  initialChatId?: string;
  /** Optional node ID from ?node= query param — scrolls to that message on load. */
  initialNodeId?: string;
  initialViewMode?: ViewMode;
}

export function ChatContainer({
  initialWorkspaceId,
  initialChatId,
  initialNodeId,
  initialViewMode = "chat",
}: ChatContainerProps = {}) {
  const router = useRouter();
  const {
    tree,
    activeMessages,
    isStreaming,
    streamingNodeId,
    error,
    activeBranch,
    setBranchContext,
    clearBranchContext,
    switchBranch,
    clearError,
    sendMessage,
    retryLastMessage,
    regenerateResponse,
    editUserMessage,
    stopStreaming,
    clearMessages,
    deleteBranch,
    updateNodeMetadata,
    loadTree,
  } = useChatStream();




  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Two-Tier State: Workspaces (Outer Vault) and Chats (Inner Trees)
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceItem | null>(null);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(initialChatId || null);

  const [syncStatus, setSyncStatus] = useState<"saved" | "syncing" | "offline">("saved");
  const [drawerNodeId, setDrawerNodeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);

  // Parallel Split-Pane Side Branch State
  const [leftPaneBranchNodeId, setLeftPaneBranchNodeId] = useState<string | null>(null);
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

  // References to prevent duplicate re-initialization and route flicker
  const loadedChatIdRef = useRef<string | null>(initialChatId || null);
  const initializedWorkspaceIdRef = useRef<string | null>(null);
  // Capture initial values in refs so they never change across re-renders
  const initialWorkspaceIdRef = useRef(initialWorkspaceId);
  const initialChatIdRef = useRef(initialChatId);
  const initialViewModeRef = useRef(initialViewMode);

  // Refresh chats for current workspace
  const refreshChats = useCallback(async (wsId: string) => {
    try {
      const list = await fetchWorkspaceChats(wsId);
      setChats(list);
      return list;
    } catch {
      return [];
    }
  }, []);

  // Initialize workspace & load initial chat — runs EXACTLY ONCE on mount.
  // We intentionally read from frozen refs (not reactive props) so that
  // router.replace() URL updates never cause this effect to re-fire.
  useEffect(() => {
    if (initializedWorkspaceIdRef.current) return; // already ran

    async function initWorkspace() {
      const wsId = initialWorkspaceIdRef.current;
      const chatId = initialChatIdRef.current;
      const viewMode = initialViewModeRef.current;

      try {
        let ws: WorkspaceItem | null = null;

        if (wsId) {
          const snapshot = await fetchGraphSnapshot(wsId);
          if (snapshot) {
            ws = snapshot.workspace;
          }
        }

        if (!ws) {
          const list = await fetchWorkspaces();
          if (list && list.length > 0) {
            ws = list[0];
          } else {
            const hasSeeded = localStorage.getItem("graphmind_demo_seeded") === "true";
            if (!hasSeeded) {
              try {
                const seedResult = await seedDemoWorkspace();
                localStorage.setItem("graphmind_demo_seeded", "true");
                const snapshot = await fetchGraphSnapshot(seedResult.workspaceId);
                if (snapshot) {
                  ws = snapshot.workspace;
                }
              } catch (seedErr) {
                console.error("Failed to seed demo workspace, falling back to blank", seedErr);
                ws = await createWorkspace("Main Workspace", "Default knowledge vault");
              }
            }
            if (!ws) {
              ws = await createWorkspace("Main Workspace", "Default knowledge vault");
            }
          }
        }

        setCurrentWorkspace(ws);

        if (ws) {
          initializedWorkspaceIdRef.current = ws.id;
          await refreshChats(ws.id);

          const targetChatId = chatId || null;
          loadedChatIdRef.current = targetChatId;
          setActiveChatId(targetChatId);

          if (targetChatId) {
            const snapshot = await fetchGraphSnapshot(ws.id, targetChatId);
            if (snapshot) {
              const loadedTree = snapshotToTree(snapshot);
              if (loadedTree) {
                loadTree(loadedTree);
              }
            }
          }

          if (typeof window !== "undefined" && !targetChatId) {
            // Only replace URL when no chatId is in the path yet
            router.replace(buildWorkspaceUrl(ws.id), { scroll: false });
          } else if (typeof window !== "undefined" && targetChatId && ws) {
            const url = viewMode === "canvas"
              ? buildCanvasUrl(ws.id, targetChatId)
              : buildChatUrl(ws.id, targetChatId);
            router.replace(url, { scroll: false });
          }
        }
      } catch {
        setSyncStatus("offline");
      }
    }
    initWorkspace();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps = run once on mount only

  // Start a completely fresh chat tree inside the current workspace
  const handleNewChat = useCallback(() => {
    clearMessages();
    setActiveChatId(null);
    loadedChatIdRef.current = null;
    setLeftPaneBranchNodeId(null);
    setSideBranchNodeId(null);
    setIsDrawerOpen(false);
    if (currentWorkspace) {
      router.push(buildWorkspaceUrl(currentWorkspace.id), { scroll: false });
    }
  }, [clearMessages, currentWorkspace, router]);

  // Select an existing chat inside the current workspace
  const handleSelectChat = useCallback(
    async (chat: ChatItem) => {
      if (!currentWorkspace) return;
      if (activeChatId === chat.id) return;

      // Update active state immediately so sidebar reflects selection
      setActiveChatId(chat.id);
      loadedChatIdRef.current = chat.id;
      setLeftPaneBranchNodeId(null);
      setSideBranchNodeId(null);
      setIsDrawerOpen(false);


      // Use replace (not push) with scroll:false so Next.js syncs the URL
      // WITHOUT triggering a full RSC page re-fetch or unmounting ChatContainer.
      router.replace(buildChatUrl(currentWorkspace.id, chat.id), { scroll: false });

      // Fetch snapshot in background — tree swaps without clearing visible messages
      const snapshot = await fetchGraphSnapshot(currentWorkspace.id, chat.id);
      if (snapshot) {
        const loadedTree = snapshotToTree(snapshot);
        if (loadedTree) {
          loadTree(loadedTree);
        }
      }
    },
    [currentWorkspace, activeChatId, loadTree, router]
  );

  // Delete a chat from the workspace
  const handleDeleteChat = useCallback(
    async (chatId: string) => {
      if (!currentWorkspace) return;
      await deleteWorkspaceChat(currentWorkspace.id, chatId);
      const remaining = await refreshChats(currentWorkspace.id);
      if (activeChatId === chatId) {
        if (remaining.length > 0) {
          handleSelectChat(remaining[0]);
        } else {
          handleNewChat();
        }
      }
    },
    [currentWorkspace, activeChatId, refreshChats, handleSelectChat, handleNewChat]
  );

  // Rename a chat in the sidebar — updates metadata title on the backend then refreshes list
  const handleRenameChat = useCallback(
    async (chatId: string, newTitle: string) => {
      if (!currentWorkspace || !newTitle.trim()) return;
      await renameWorkspaceChat(currentWorkspace.id, chatId, newTitle.trim());
      await refreshChats(currentWorkspace.id);
    },
    [currentWorkspace, refreshChats]
  );

  // Pin or unpin a chat in the sidebar — updates metadata on the backend then refreshes list
  const handleTogglePinChat = useCallback(
    async (chatId: string, pinned: boolean) => {
      if (!currentWorkspace) return;
      await togglePinWorkspaceChat(currentWorkspace.id, chatId, pinned);
      await refreshChats(currentWorkspace.id);
    },
    [currentWorkspace, refreshChats]
  );

  // Rename a branch tab — updates local state and persists to backend
  const handleRenameBranch = useCallback(
    async (rootNodeId: string, newTitle: string) => {
      updateNodeMetadata(rootNodeId, { title: newTitle });
      if (currentWorkspace) {
        await updateWorkspaceNodeMetadata(currentWorkspace.id, rootNodeId, { title: newTitle });
      }
    },
    [currentWorkspace, updateNodeMetadata]
  );

  // Pin or unpin a branch tab — updates local state and persists to backend
  const handleTogglePinBranch = useCallback(
    async (rootNodeId: string, pinned: boolean) => {
      updateNodeMetadata(rootNodeId, { pinned });
      if (currentWorkspace) {
        await updateWorkspaceNodeMetadata(currentWorkspace.id, rootNodeId, { pinned });
      }
    },
    [currentWorkspace, updateNodeMetadata]
  );



  // Switch active workspace from Workspace Modal
  const handleSelectWorkspace = useCallback(
    async (ws: WorkspaceItem) => {
      setCurrentWorkspace(ws);
      setSideBranchNodeId(null);
      setIsDrawerOpen(false);

      const workspaceChats = await refreshChats(ws.id);
      const targetChat = workspaceChats.length > 0 ? workspaceChats[0] : null;
      setActiveChatId(targetChat?.id || null);

      if (targetChat) {
        const snapshot = await fetchGraphSnapshot(ws.id, targetChat.id);
        if (snapshot) {
          const loadedTree = snapshotToTree(snapshot);
          loadTree(loadedTree);
        }
      } else {
        clearMessages();
      }

      const url = targetChat
        ? buildChatUrl(ws.id, targetChat.id)
        : buildWorkspaceUrl(ws.id);
      router.push(url);
    },
    [refreshChats, loadTree, clearMessages, router]
  );

  // Auto-scroll when user is at the bottom in chat mode
  useEffect(() => {
    if (isAtBottom && viewMode === "chat") {
      scrollToBottom(false);
    }
  }, [activeMessages, isStreaming, isAtBottom, scrollToBottom, viewMode]);

  // Scroll to a deep-linked node once messages are populated (?node= query param)
  useEffect(() => {
    if (!initialNodeId || activeMessages.length === 0) return;
    const timeout = setTimeout(() => handleJumpToMessage(initialNodeId), 300);
    return () => clearTimeout(timeout);
  // Only run once when messages first populate
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNodeId, activeMessages.length > 0]);

  // Send message, persist nodes to PostgreSQL, and update chat list
  const handleSendMessage = useCallback(
    async (prompt: string, provider = "gemini", model = "gemini-2.5-flash") => {
      if (!currentWorkspace) return;

      const isFirstMessageInNewChat = !activeChatId || !tree || Object.keys(tree.nodes).length === 0;

      let createdUserNodeId: string | null = null;
      let createdAssistantNodeId: string | null = null;

      const result = await sendMessage(prompt, provider, model, {
        onNodeCreated: ({ userNodeId, assistantNodeId }) => {
          createdUserNodeId = userNodeId;
          createdAssistantNodeId = assistantNodeId;

          if (isFirstMessageInNewChat) {
            setActiveChatId(userNodeId);
            // We NO LONGER redirect here, because redirecting unmounts the component and cancels the streaming state!
            // We wait until streaming finishes.
          }

          // Persist user node immediately to backend
          addNodeToWorkspace(currentWorkspace.id, {
            id: userNodeId,
            parentId: isFirstMessageInNewChat ? null : (tree?.activeNodeId || null),
            role: "user",
            content: prompt.trim(),
            provider,
            model,
          }).then(() => refreshChats(currentWorkspace.id));
        },
      });

      scrollToBottom(true);

      const targetAssistantId = result?.assistantNodeId || createdAssistantNodeId;
      const targetUserId = result?.userNodeId || createdUserNodeId;
      const assistantContent = result?.content || "";

      // When streaming finishes, persist final assistant response node
      if (targetAssistantId && targetUserId) {
        setTimeout(async () => {
          await addNodeToWorkspace(currentWorkspace.id, {
            id: targetAssistantId,
            parentId: targetUserId,
            role: "assistant",
            content: assistantContent, // Pass the FULL content
            provider,
            model,
          });
          await refreshChats(currentWorkspace.id);
          
          if (isFirstMessageInNewChat && targetUserId) {
            router.replace(buildChatUrl(currentWorkspace.id, targetUserId));
          }
        }, 1000);
      }
    },
    [currentWorkspace, activeChatId, tree, sendMessage, scrollToBottom, refreshChats, router]
  );

  // Synchronize sync status
  useEffect(() => {
    if (!currentWorkspace) return;
    setSyncStatus("saved");
  }, [currentWorkspace, tree]);

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

  // Scroll to deep-linked target node if provided via URL
  useEffect(() => {
    if (initialNodeId && activeMessages.length > 0) {
      setTimeout(() => {
        handleJumpToMessage(initialNodeId);
      }, 200);
    }
  }, [initialNodeId, activeMessages.length, handleJumpToMessage]);

  // Handle opening of parallel split pane from inline Obsidian-style blue links
  const handleOpenSideBranchFromLeft = useCallback((leafId: string, excerpt: string) => {

    setSideBranchExcerpt(excerpt);
    setSideBranchNodeId(leafId);
  }, []);

  const handleOpenSideBranchFromRight = useCallback((leafId: string, excerpt: string) => {
    if (sideBranchNodeId) {
      setLeftPaneBranchNodeId(sideBranchNodeId);
    }
    setSideBranchExcerpt(excerpt);
    setSideBranchNodeId(leafId);
  }, [sideBranchNodeId]);

  // Send branch message and persist both user and assistant nodes to PostgreSQL
  const handleSendBranchStream = useCallback(
    async (
      prompt: string,
      parentNodeId: string,
      highlightedText = "",
      options?: { shiftRightToLeft?: boolean }
    ) => {
      if (!currentWorkspace) return;
      if (highlightedText) {
        setSideBranchExcerpt(highlightedText);
      }

      const prevRightPane = sideBranchNodeId;

      let createdUserNodeId: string | null = null;
      let createdAssistantNodeId: string | null = null;

      const result = await sendMessage(
        prompt,
        "gemini",
        "gemini-2.5-flash",
        {
          branchOverride: { parentNodeId, highlightedText },
          preserveActiveNodeId: true,
          onNodeCreated: ({ userNodeId, assistantNodeId }) => {
            createdUserNodeId = userNodeId;
            createdAssistantNodeId = assistantNodeId;

            if (options?.shiftRightToLeft && prevRightPane) {
              setLeftPaneBranchNodeId(prevRightPane);
            }
            setSideBranchNodeId(assistantNodeId);

            // Persist user branch node immediately to backend
            addNodeToWorkspace(currentWorkspace.id, {
              id: userNodeId,
              parentId: parentNodeId,
              role: "user",
              content: prompt.trim(),
              highlightedContext: highlightedText || null,
              provider: "gemini",
              model: "gemini-2.5-flash",
            }).then(() => refreshChats(currentWorkspace.id));
          },
        }
      );

      const targetAssistantId = result?.assistantNodeId || createdAssistantNodeId;
      const targetUserId = result?.userNodeId || createdUserNodeId;
      const assistantContent = result?.content || "";

      // When streaming finishes, persist final assistant response node
      if (targetAssistantId && targetUserId) {
        setTimeout(async () => {
          await addNodeToWorkspace(currentWorkspace.id, {
            id: targetAssistantId,
            parentId: targetUserId,
            role: "assistant",
            content: assistantContent,
            provider: "gemini",
            model: "gemini-2.5-flash",
          });
          await refreshChats(currentWorkspace.id);
        }, 500);
      }
    },
    [currentWorkspace, sideBranchNodeId, sendMessage, refreshChats]
  );

  // Handle "🌿 Explain this" action from text selection tooltip in Left Pane
  const handleExplainBranchFromLeft = useCallback(
    async (parentNodeId: string, highlightedText: string) => {
      const branchPrompt = `Explain "${highlightedText}" in concise, direct detail with key takeaways.`;
      await handleSendBranchStream(branchPrompt, parentNodeId, highlightedText, {
        shiftRightToLeft: false,
      });
    },
    [handleSendBranchStream]
  );

  // Handle "🌿 Explain this" action from text selection tooltip in Right Pane (shifts right to left!)
  const handleExplainBranchFromRight = useCallback(
    async (parentNodeId: string, highlightedText: string) => {
      const branchPrompt = `Explain "${highlightedText}" in concise, direct detail with key takeaways.`;
      await handleSendBranchStream(branchPrompt, parentNodeId, highlightedText, {
        shiftRightToLeft: true,
      });
    },
    [handleSendBranchStream]
  );

  // Track all branch points along the active lineage for breadcrumbs
  const activeDeepestNodeId = sideBranchNodeId || leftPaneBranchNodeId;
  const activeLineage = useMemo(() => {
    if (!tree || !activeDeepestNodeId) return [];
    return getAncestorPath(tree, activeDeepestNodeId);
  }, [tree, activeDeepestNodeId]);

  // Unified top navigation breadcrumbs
  const breadcrumbSteps = useMemo(() => {
    if (!tree || activeMessages.length === 0) return [];
    const rootMessage = activeMessages[0];
    const rawPrompt = rootMessage?.content || "New Chat";
    const rootTitle = rawPrompt.length > 20 ? rawPrompt.slice(0, 18) + "…" : rawPrompt;

    const steps: BreadcrumbStep[] = [
      {
        id: tree.rootNodeId,
        leafId: tree.rootNodeId,
        title: rootTitle,
        isRoot: true,
      },
    ];

    activeLineage.forEach((n) => {
      if (n.highlightedContext) {
        const linearLeaf = tree ? getBranchLinearLeafNode(tree, n.id) : n;
        steps.push({
          id: n.id,
          leafId: linearLeaf.id,
          title: n.highlightedContext,
        });
      }
    });

    return steps;
  }, [tree, activeMessages, activeLineage]);

  // Left pane displays either the mainline trunk or a specific pinned branch
  const leftPaneMessages: TreeNode[] = useMemo(() => {
    if (!leftPaneBranchNodeId || !tree) {
      return activeMessages;
    }
    const path = getAncestorPath(tree, leftPaneBranchNodeId);
    const rootIdx = path.findIndex((n) => Boolean(n.highlightedContext));
    return rootIdx !== -1 ? path.slice(rootIdx) : path;
  }, [leftPaneBranchNodeId, tree, activeMessages]);

  // Handle starting a new sibling sub-branch query from the BranchChatPane tab bar
  const handleSendNewSiblingBranch = useCallback(
    async (prompt: string, parentNodeId: string, highlightedText: string) => {
      await handleSendBranchStream(prompt, parentNodeId, highlightedText);
    },
    [handleSendBranchStream]
  );

  const handleEditUserMessage = useCallback(

    async (userNodeId: string, newContent: string) => {
      await editUserMessage(userNodeId, newContent);
      if (currentWorkspace) {
        await updateWorkspaceNodeContent(currentWorkspace.id, userNodeId, newContent);
      }
    },
    [currentWorkspace, editUserMessage]
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
      if (currentWorkspace && activeChatId) {
        router.push(buildChatUrl(currentWorkspace.id, activeChatId));
      }
      setTimeout(() => {
        handleJumpToMessage(nodeId);
      }, 100);
    },
    [switchBranch, handleJumpToMessage, currentWorkspace, activeChatId, router]
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
    onToggleSidebar: () => setIsSidebarOpen((prev) => !prev),
    onNewChat: handleNewChat,
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
        onViewModeChange={(mode) => {
          setViewMode(mode);
          if (currentWorkspace && activeChatId) {
            const url = mode === "canvas"
              ? buildCanvasUrl(currentWorkspace.id, activeChatId)
              : buildChatUrl(currentWorkspace.id, activeChatId);
            router.push(url);
          }
        }}
        syncStatus={syncStatus}
        workspaceName={currentWorkspace?.name || "Main Workspace"}
        onOpenWorkspaceModal={() => setIsWorkspaceModalOpen(true)}
        messageCount={activeMessages.length}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        onNewChat={handleNewChat}
        onClearChat={() => {
          clearMessages();
          setIsDrawerOpen(false);
          setSideBranchNodeId(null);
        }}
        breadcrumbs={
          <BranchBreadcrumbs
            steps={breadcrumbSteps}
            onSelectStep={(step) => {
              const stepIdx = breadcrumbSteps.findIndex((s) => s.id === step.id);
              if (stepIdx <= 0) {
                setLeftPaneBranchNodeId(null);
                setSideBranchNodeId(null);
              } else if (stepIdx === 1) {
                setLeftPaneBranchNodeId(null);
                setSideBranchNodeId(step.leafId);
              } else {
                setLeftPaneBranchNodeId(breadcrumbSteps[stepIdx - 1].leafId);
                setSideBranchNodeId(step.leafId);
              }
            }}
          />
        }
      />



      {/* Main App Layout: Workspace Chats Sidebar + Canvas / Split-Pane Chat */}
      <div className="flex-1 min-h-0 flex relative overflow-hidden bg-white">
        {/* Left Workspace Chats History Sidebar */}
        <ChatSidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen((prev) => !prev)}
          workspaceName={currentWorkspace?.name || "Main Workspace"}
          chats={chats}
          activeChatId={activeChatId}
          onSelectChat={handleSelectChat}
          onDeleteChat={handleDeleteChat}
          onRenameChat={handleRenameChat}
          onTogglePinChat={handleTogglePinChat}
          onOpenWorkspaceModal={() => setIsWorkspaceModalOpen(true)}
        />


        {/* Content Area */}
        <div className="flex-1 min-w-0 flex relative bg-white overflow-hidden">
          {viewMode === "canvas" ? (
            /* 2D Spatial Mind Map & Knowledge Graph Canvas View */
            <div className="w-full h-full relative">
              <GraphCanvas
                tree={tree}
                isStreaming={isStreaming}
                onSelectNode={handleSelectTreeNode}
                onDeleteBranch={(nodeId) => currentWorkspace && deleteBranch(nodeId, currentWorkspace.id)}
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
                streamingNodeId={streamingNodeId}
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
                onRegenerate={regenerateResponse}
                onEditUserMessage={editUserMessage}
                onSwitchBranch={(nodeId) => {
                  switchBranch(nodeId);
                  setDrawerNodeId(nodeId);
                }}
              />
            </div>
          ) : (
            /* Resizable Parallel Split-Pane Chat View */
            <ResizableSplitPane

              isOpen={Boolean(sideBranchNodeId)}
              onClose={() => {
                setSideBranchNodeId(null);
                setLeftPaneBranchNodeId(null);
              }}
              leftPane={
                <div className="h-full flex flex-col min-w-0 relative">
                  <main
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto min-h-0 flex flex-col bg-white"
                  >
                    {leftPaneMessages.length === 0 ? (
                      /* Clean Empty State */
                      <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto px-4 py-8 text-center space-y-8 my-auto">
                        <div className="space-y-3">
                          <LogoBadge size="lg" className="mx-auto" />
                          <h2 className="text-xl font-semibold text-zinc-900 tracking-tight">
                            {currentWorkspace?.name || "Where knowledge connects"}
                          </h2>
                          <p className="text-xs sm:text-sm text-zinc-500 max-w-sm mx-auto leading-relaxed">
                            Ask a technical question, explore system architecture, or create new branches in this workspace.
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
                                  handleSendMessage(item.prompt, "gemini", "gemini-2.5-flash");
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
                      /* Active Lineage Branch Message Stream */
                      <div className="w-full pb-4">
                        {(() => {
                          const lastUserIndex = leftPaneMessages.map((m) => m.role).lastIndexOf("user");
                          const lastAssistantIndex = leftPaneMessages.map((m) => m.role).lastIndexOf("assistant");

                          return leftPaneMessages.map((node, index) => {
                            const isLastAssistant =
                              index === leftPaneMessages.length - 1 &&
                              node.role === "assistant" &&
                              isStreaming &&
                              streamingNodeId === node.id;

                            return (
                              <ChatMessage
                                key={node.id}
                                message={{
                                  ...node,
                                  isStreaming: isLastAssistant,
                                }}
                                tree={tree}
                                isLastUserMessage={index === lastUserIndex}
                                isLastAssistantMessage={index === lastAssistantIndex}
                                onRetry={retryLastMessage}
                                onRegenerate={regenerateResponse}
                                onEditUserMessage={handleEditUserMessage}
                                onSwitchBranch={switchBranch}
                                onExploreBranch={handleExplainBranchFromLeft}
                                onOpenSideBranch={handleOpenSideBranchFromLeft}
                              />
                            );
                          });
                        })()}
                        <div ref={bottomRef} />
                      </div>
                    )}
                  </main>

                  {/* Left Chat Input Bar */}
                  <div className="relative shrink-0 bg-gradient-to-t from-white via-white to-transparent pt-2 z-20">
                    {showScrollButton && leftPaneMessages.length > 0 && (
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
                        if (leftPaneBranchNodeId) {
                          handleSendBranchStream(prompt, leftPaneBranchNodeId, "");
                        } else {
                          handleSendMessage(prompt, provider, model);
                        }
                      }}
                      onStopStreaming={stopStreaming}
                      isStreaming={isStreaming}
                      activeBranch={leftPaneBranchNodeId ? null : activeBranch}
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
                    streamingNodeId={streamingNodeId}
                    onClose={() => {
                      setSideBranchNodeId(null);
                      setLeftPaneBranchNodeId(null);
                    }}
                    onSelectBranchLeaf={(leafId) => setSideBranchNodeId(leafId)}
                    onSendBranchMessage={(prompt, parentNodeId) => {
                      handleSendBranchStream(prompt, parentNodeId, "");
                    }}
                    onSendNewSiblingBranch={handleSendNewSiblingBranch}
                    onDeleteBranch={(nodeId) => currentWorkspace && deleteBranch(nodeId, currentWorkspace.id)}
                    onRenameBranch={handleRenameBranch}
                    onTogglePinBranch={handleTogglePinBranch}
                    onRegenerate={regenerateResponse}
                    onEditUserMessage={handleEditUserMessage}
                    onSwitchBranch={switchBranch}
                    onExploreBranch={handleExplainBranchFromRight}
                    onOpenSideBranch={handleOpenSideBranchFromRight}
                  />
                ) : null
              }
            />
          )}


        </div>
      </div>

      {/* Global Command Palette (⌘K) */}
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        tree={tree}
        viewMode={viewMode}
        onSelectNode={handleSelectTreeNode}
        onToggleViewMode={() => {
          const nextMode = viewMode === "chat" ? "canvas" : "chat";
          setViewMode(nextMode);
          if (currentWorkspace && activeChatId) {
            const url = nextMode === "canvas"
              ? buildCanvasUrl(currentWorkspace.id, activeChatId)
              : buildChatUrl(currentWorkspace.id, activeChatId);
            router.push(url);
          }
        }}
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
        onSelectWorkspace={handleSelectWorkspace}
        activeTree={tree}
      />

      {/* Non-intrusive Floating Toast Notification */}
      <Toast message={error} onDismiss={clearError} />
    </div>
  );
}
