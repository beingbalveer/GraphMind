"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { GitBranch, ArrowDown } from "lucide-react";

import {
  getNodeChildren,
  getBranchLinearLeafNode,
  getAncestorPath,
  TreeNode,
  FileAttachment,
} from "@graphmind/shared";

import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { BranchBreadcrumbs, BreadcrumbStep } from "./BranchBreadcrumbs";

import { ChatSidebar } from "./ChatSidebar";
import { GraphCanvas } from "../canvas/GraphCanvas";
import { CommandPalette } from "../canvas/CommandPalette";
import { WorkspaceModal } from "../workspace/WorkspaceModal";
import { SettingsModal } from "../settings/SettingsModal";
import { FileLibraryModal } from "../library/FileLibraryModal";
import { SidePeekBranchSheet, SidePeekEntry } from "./SidePeekBranchSheet";
import { Toast } from "@/components/ui/toast";
import { LogoBadge } from "@/components/ui/Logo";
import { useChatStream } from "@/hooks/useChatStream";
import { useModelConfig } from "@/hooks/useModelConfig";
import { useScrollAnchor } from "@/hooks/useScrollAnchor";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { safeGetItem, safeSetItem } from "@/lib/storage";

import { Navbar, ViewMode } from "../layout/Navbar";
import {
  buildWorkspaceUrl,
  buildChatUrl,
  buildCanvasUrl,
  buildNodeUrl,
  buildBranchUrl,
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
  /** Optional branch leaf ID from ?branch= query param — opens split-pane on load. */
  initialBranchId?: string;
  initialViewMode?: ViewMode;
}

export function ChatContainer({
  initialWorkspaceId,
  initialChatId,
  initialNodeId,
  initialBranchId,
  initialViewMode = "chat",
}: ChatContainerProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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




  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [isModelConfigOpen, setIsModelConfigOpen] = useState(false);
  const [isFileLibraryOpen, setIsFileLibraryOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Centralized Model & AI Generation Configuration (BYOK)
  const {
    config: llmConfig,
    updateConfig: updateLLMConfig,
    resetDefaults: resetLLMDefaults,
    getEffectiveApiKey,
    getEffectiveBaseUrl,
  } = useModelConfig();

  // Two-Tier State: Workspaces (Outer Vault) and Chats (Inner Trees)
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceItem | null>(null);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(initialChatId || null);

  const [syncStatus, setSyncStatus] = useState<"saved" | "syncing" | "offline">("saved");
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);

  // Notion-Style Side-Peek History Stack State
  const [sidePeekState, setSidePeekState] = useState<{
    stack: SidePeekEntry[];
    index: number;
  }>(() => ({
    stack: initialBranchId ? [{ nodeId: initialBranchId }] : [],
    index: 0,
  }));

  const sidePeekStack = sidePeekState.stack;
  const sidePeekIndex = sidePeekState.index;
  const isSidePeekOpen = sidePeekStack.length > 0;


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
  const initialBranchIdRef = useRef(initialBranchId);
  const initialNodeIdRef = useRef(initialNodeId);
  const initialViewModeRef = useRef(initialViewMode);
  const lastProcessedBranchRef = useRef<string | null>(initialBranchId || null);
  const lastProcessedNodeRef = useRef<string | null>(initialNodeId || null);

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

  // Initialize workspace & load initial chat — runs EXACTLY ONCE on mount.
  useEffect(() => {
    if (initializedWorkspaceIdRef.current) return; // already ran

    async function initWorkspace() {
      const wsId = initialWorkspaceIdRef.current;
      const chatId = initialChatIdRef.current;
      const branchId = initialBranchIdRef.current;
      const nodeId = initialNodeIdRef.current;
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
            const hasSeeded = safeGetItem("graphmind_demo_seeded") === "true";
            if (!hasSeeded) {
              try {
                const seedResult = await seedDemoWorkspace();
                safeSetItem("graphmind_demo_seeded", "true");
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
                if (branchId && loadedTree.nodes[branchId]) {
                  const node = loadedTree.nodes[branchId];
                  lastProcessedBranchRef.current = branchId;
                  setSidePeekState({
                    stack: [{ nodeId: branchId, excerpt: node.highlightedContext || undefined }],
                    index: 0,
                  });
                }
              }
            }
          }

          if (nodeId) {
            lastProcessedNodeRef.current = nodeId;
            if (viewMode === "canvas") {
              setSidePeekState({ stack: [{ nodeId }], index: 0 });
            }
          }

          if (typeof window !== "undefined" && !targetChatId) {
            // Only replace URL when no chatId is in the path yet
            router.replace(buildWorkspaceUrl(ws.id), { scroll: false });
          } else if (typeof window !== "undefined" && targetChatId && ws) {
            const url = viewMode === "canvas"
              ? buildCanvasUrl(ws.id, targetChatId, nodeId ? { node: nodeId } : undefined)
              : buildChatUrl(ws.id, targetChatId, branchId ? { branch: branchId } : nodeId ? { node: nodeId } : undefined);
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

  // Reactive URL listener for browser Back/Forward navigation and external route changes
  useEffect(() => {
    if (!currentWorkspace) return;

    // 1. Sync viewMode from path: /canvas vs standard chat
    const targetViewMode: ViewMode = pathname.endsWith("/canvas") ? "canvas" : "chat";
    setViewMode((prev) => (prev !== targetViewMode ? targetViewMode : prev));

    // 2. Sync chatId from path: /w/{workspaceId}/chat/{chatId}
    const chatIdMatch = pathname.match(/\/chat\/([^/]+)/);
    const targetChatId = chatIdMatch ? chatIdMatch[1] : null;

    if (targetChatId && targetChatId !== loadedChatIdRef.current) {
      loadedChatIdRef.current = targetChatId;
      setActiveChatId(targetChatId);
      fetchGraphSnapshot(currentWorkspace.id, targetChatId).then((snapshot) => {
        if (snapshot) {
          const loadedTree = snapshotToTree(snapshot);
          if (loadedTree) {
            loadTree(loadedTree);
          }
        }
      });
    } else if (!targetChatId && loadedChatIdRef.current && pathname === buildWorkspaceUrl(currentWorkspace.id)) {
      loadedChatIdRef.current = null;
      setActiveChatId(null);
      clearMessages();
      lastProcessedBranchRef.current = null;
      lastProcessedNodeRef.current = null;
      setSidePeekState({ stack: [], index: 0 });
    }

    if (targetViewMode === "canvas") {
      // 3. Sync ?node= query parameter from URL changes in canvas mode
      const nodeParam = searchParams.get("node");
      if (nodeParam !== lastProcessedNodeRef.current) {
        lastProcessedNodeRef.current = nodeParam;
        if (nodeParam) {
          setSidePeekState({ stack: [{ nodeId: nodeParam }], index: 0 });
        } else {
          setSidePeekState({ stack: [], index: 0 });
        }
      }
    } else {
      // 3. Sync ?branch= query parameter from URL changes in chat mode
      const branchParam = searchParams.get("branch");
      if (branchParam !== lastProcessedBranchRef.current) {
        lastProcessedBranchRef.current = branchParam;
        if (branchParam) {
          setSidePeekState({ stack: [{ nodeId: branchParam }], index: 0 });
        } else {
          setSidePeekState({ stack: [], index: 0 });
        }
      }

      // 4. Sync ?node= query parameter (scroll-to + highlight) in chat mode
      const nodeParam = searchParams.get("node");
      if (nodeParam && nodeParam !== lastProcessedNodeRef.current) {
        lastProcessedNodeRef.current = nodeParam;
        setTimeout(() => {
          handleJumpToMessage(nodeParam);
        }, 150);
      }
    }
  }, [pathname, searchParams, currentWorkspace, loadTree, clearMessages, handleJumpToMessage]);


  // Start a completely fresh chat tree inside the current workspace
  const handleNewChat = useCallback(() => {
    clearMessages();
    setActiveChatId(null);
    loadedChatIdRef.current = null;
    lastProcessedBranchRef.current = null;
    lastProcessedNodeRef.current = null;
    setSidePeekState({ stack: [], index: 0 });
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
      lastProcessedBranchRef.current = null;
      lastProcessedNodeRef.current = null;
      setSidePeekState({ stack: [], index: 0 });

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
      lastProcessedBranchRef.current = null;
      lastProcessedNodeRef.current = null;
      setSidePeekState({ stack: [], index: 0 });

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
    async (prompt: string, attachments?: FileAttachment[]) => {
      if (!currentWorkspace) return;

      const isFirstMessageInNewChat = !activeChatId || !tree || Object.keys(tree.nodes).length === 0;

      let createdUserNodeId: string | null = null;
      let createdAssistantNodeId: string | null = null;

      const provider = llmConfig.provider;
      const model = llmConfig.model;
      const effectiveApiKey = getEffectiveApiKey(provider);
      const effectiveBaseUrl = getEffectiveBaseUrl(provider);

      // Determine the target parent ID based on the currently active visible thread:
      // If the user has an active highlighted branch context, use its parentNodeId.
      // Otherwise, append strictly to the leaf of the active visible conversation messages.
      const currentActiveLeaf = activeMessages.length > 0 ? activeMessages[activeMessages.length - 1].id : null;
      const targetParentId = isFirstMessageInNewChat
        ? null
        : (activeBranch?.parentNodeId || currentActiveLeaf || tree?.activeNodeId || null);

      const result = await sendMessage(prompt, provider, model, {
        apiKey: effectiveApiKey,
        baseUrl: effectiveBaseUrl,
        temperature: llmConfig.temperature,
        maxTokens: llmConfig.maxTokens,
        systemPrompt: llmConfig.systemPrompt || undefined,
        attachments: attachments && attachments.length > 0 ? attachments : undefined,
        targetParentId,
        onNodeCreated: ({ userNodeId, assistantNodeId, parentId }) => {
          createdUserNodeId = userNodeId;
          createdAssistantNodeId = assistantNodeId;

          if (isFirstMessageInNewChat) {
            setActiveChatId(userNodeId);
            loadedChatIdRef.current = userNodeId;
            router.replace(buildChatUrl(currentWorkspace.id, userNodeId), { scroll: false });
          }

          // Persist user node immediately to backend with exact parentId
          addNodeToWorkspace(currentWorkspace.id, {
            id: userNodeId,
            parentId: isFirstMessageInNewChat ? null : parentId,
            role: "user",
            content: prompt.trim(),
            provider,
            model,
            metadata: attachments && attachments.length > 0 ? { attachments } : {},
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
        }, 1000);
      }
    },
    [currentWorkspace, activeChatId, tree, activeMessages, activeBranch, llmConfig, getEffectiveApiKey, getEffectiveBaseUrl, sendMessage, scrollToBottom, refreshChats, router]
  );

  // Synchronize sync status
  useEffect(() => {
    if (!currentWorkspace) return;
    setSyncStatus("saved");
  }, [currentWorkspace, tree]);

  // Helper to synchronize the URL when navigating/switching side-peek branches without losing viewMode (chat vs canvas)
  const syncSidePeekUrl = useCallback(
    (nodeId: string) => {
      if (!currentWorkspace || !activeChatId) return;
      if (viewMode === "canvas") {
        router.replace(buildCanvasUrl(currentWorkspace.id, activeChatId, { node: nodeId }), { scroll: false });
      } else {
        router.replace(buildBranchUrl(currentWorkspace.id, activeChatId, nodeId), { scroll: false });
      }
    },
    [currentWorkspace, activeChatId, viewMode, router]
  );

  // Open / Push into Notion-style Side-Peek History Stack
  const handleOpenSidePeek = useCallback(
    (nodeId: string, excerpt?: string) => {
      lastProcessedBranchRef.current = nodeId;
      lastProcessedNodeRef.current = nodeId;
      setSidePeekState({ stack: [{ nodeId, excerpt }], index: 0 });
      syncSidePeekUrl(nodeId);
    },
    [syncSidePeekUrl]
  );

  const handlePushSidePeekBranch = useCallback(
    (nodeId: string, excerpt?: string) => {
      lastProcessedBranchRef.current = nodeId;
      lastProcessedNodeRef.current = nodeId;
      setSidePeekState((prev) => {
        const nextStack = [...prev.stack.slice(0, prev.index + 1), { nodeId, excerpt }];
        return { stack: nextStack, index: nextStack.length - 1 };
      });
      syncSidePeekUrl(nodeId);
    },
    [syncSidePeekUrl]
  );

  const handleSwitchSidePeekSiblingTab = useCallback(
    (leafId: string) => {
      lastProcessedBranchRef.current = leafId;
      lastProcessedNodeRef.current = leafId;
      setSidePeekState((prev) => {
        const nextStack = [...prev.stack];
        if (nextStack[prev.index]) {
          nextStack[prev.index] = { ...nextStack[prev.index], nodeId: leafId };
        }
        return { stack: nextStack, index: prev.index };
      });
      syncSidePeekUrl(leafId);
    },
    [syncSidePeekUrl]
  );

  // Sync URL after back/forward navigation via a separate effect-driven approach
  // by reading the current state after the update settles
  const handleNavigateSidePeekBack = useCallback(() => {
    let targetNodeId: string | undefined;
    setSidePeekState((prev) => {
      const nextIndex = Math.max(0, prev.index - 1);
      targetNodeId = prev.stack[nextIndex]?.nodeId;
      if (targetNodeId) {
        lastProcessedBranchRef.current = targetNodeId;
        lastProcessedNodeRef.current = targetNodeId;
      }
      return { ...prev, index: nextIndex };
    });
    // Schedule URL update outside the updater / render cycle
    queueMicrotask(() => {
      if (targetNodeId) {
        syncSidePeekUrl(targetNodeId);
      }
    });
  }, [syncSidePeekUrl]);

  const handleNavigateSidePeekForward = useCallback(() => {
    let targetNodeId: string | undefined;
    setSidePeekState((prev) => {
      const nextIndex = Math.min(prev.stack.length - 1, prev.index + 1);
      targetNodeId = prev.stack[nextIndex]?.nodeId;
      if (targetNodeId) {
        lastProcessedBranchRef.current = targetNodeId;
        lastProcessedNodeRef.current = targetNodeId;
      }
      return { ...prev, index: nextIndex };
    });
    queueMicrotask(() => {
      if (targetNodeId) {
        syncSidePeekUrl(targetNodeId);
      }
    });
  }, [syncSidePeekUrl]);

  const handleCloseSidePeek = useCallback(() => {
    lastProcessedBranchRef.current = null;
    lastProcessedNodeRef.current = null;
    setSidePeekState({ stack: [], index: 0 });
    if (currentWorkspace && activeChatId) {
      router.replace(
        viewMode === "canvas"
          ? buildCanvasUrl(currentWorkspace.id, activeChatId)
          : buildChatUrl(currentWorkspace.id, activeChatId),
        { scroll: false }
      );
    }
  }, [currentWorkspace, activeChatId, viewMode, router]);

  // "Make Primary": Promotes active side-peek branch to replace the center primary chat
  const handlePromoteSidePeekToPrimary = useCallback(
    (leafNodeId: string) => {
      lastProcessedBranchRef.current = null;
      lastProcessedNodeRef.current = null;
      switchBranch(leafNodeId);
      setSidePeekState({ stack: [], index: 0 });
      if (viewMode === "canvas") {
        setViewMode("chat");
      }
      if (currentWorkspace && activeChatId) {
        router.replace(buildNodeUrl(currentWorkspace.id, activeChatId, leafNodeId), { scroll: false });
      }
      setTimeout(() => {
        handleJumpToMessage(leafNodeId);
      }, 100);
    },
    [switchBranch, viewMode, currentWorkspace, activeChatId, router, handleJumpToMessage]
  );

  // Send branch message and persist both user and assistant nodes to PostgreSQL
  const handleSendBranchStream = useCallback(
    async (
      prompt: string,
      parentNodeId: string,
      highlightedText = "",
      options?: { mode?: "open" | "push" | "replace_current" | "none" }
    ) => {
      if (!currentWorkspace) return;

      let createdUserNodeId: string | null = null;
      let createdAssistantNodeId: string | null = null;

      const provider = llmConfig.provider;
      const model = llmConfig.model;
      const effectiveApiKey = getEffectiveApiKey(provider);
      const effectiveBaseUrl = getEffectiveBaseUrl(provider);

      const result = await sendMessage(
        prompt,
        provider,
        model,
        {
          branchOverride: { parentNodeId, highlightedText },
          preserveActiveNodeId: true,
          apiKey: effectiveApiKey,
          baseUrl: effectiveBaseUrl,
          temperature: llmConfig.temperature,
          maxTokens: llmConfig.maxTokens,
          systemPrompt: llmConfig.systemPrompt || undefined,
          onNodeCreated: ({ userNodeId, assistantNodeId }) => {
            createdUserNodeId = userNodeId;
            createdAssistantNodeId = assistantNodeId;

            if (options?.mode === "push") {
              handlePushSidePeekBranch(assistantNodeId, highlightedText || undefined);
            } else if (options?.mode === "replace_current") {
              handleSwitchSidePeekSiblingTab(assistantNodeId);
            } else if (options?.mode === "none") {
              // in-branch follow-up: leave stack intact
            } else {
              handleOpenSidePeek(assistantNodeId, highlightedText || undefined);
            }

            // Persist user branch node immediately to backend
            addNodeToWorkspace(currentWorkspace.id, {
              id: userNodeId,
              parentId: parentNodeId,
              role: "user",
              content: prompt.trim(),
              highlightedContext: highlightedText || null,
              provider,
              model,
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
            provider,
            model,
          });
          await refreshChats(currentWorkspace.id);
        }, 500);
      }
    },
    [currentWorkspace, handleOpenSidePeek, handlePushSidePeekBranch, handleSwitchSidePeekSiblingTab, llmConfig, getEffectiveApiKey, getEffectiveBaseUrl, sendMessage, refreshChats]
  );

  // Handle "🌿 Explain this" action from text selection tooltip in Main Chat
  const handleExplainBranchFromMain = useCallback(
    async (parentNodeId: string, highlightedText: string) => {
      const branchPrompt = `Explain "${highlightedText}" in concise, direct detail with key takeaways.`;
      await handleSendBranchStream(branchPrompt, parentNodeId, highlightedText, {
        mode: "open",
      });
    },
    [handleSendBranchStream]
  );

  // Handle response rating (👍 / 👎) with real-time PostgreSQL persistence
  const handleRateResponse = useCallback(
    async (nodeId: string, rating: "up" | "down" | null) => {
      updateNodeMetadata(nodeId, { rating });
      if (currentWorkspace) {
        await updateWorkspaceNodeMetadata(currentWorkspace.id, nodeId, { rating });
      }
    },
    [currentWorkspace, updateNodeMetadata]
  );

  // Track all branch points along the active lineage for breadcrumbs
  const activeLineage = useMemo(() => {
    if (!tree || !tree.activeNodeId) return [];
    return getAncestorPath(tree, tree.activeNodeId);
  }, [tree]);

  const breadcrumbSteps = useMemo(() => {
    if (!tree || !tree.rootNodeId || !tree.nodes[tree.rootNodeId]) return [];
    const rootMessage = tree.nodes[tree.rootNodeId];
    const rawPrompt = rootMessage?.content || "New Chat";
    const rootTitle = rawPrompt.length > 20 ? rawPrompt.slice(0, 18) + "…" : rawPrompt;

    const rootLeaf = getBranchLinearLeafNode(tree, tree.rootNodeId);
    const rootLeafId = rootLeaf ? rootLeaf.id : tree.rootNodeId;

    const steps: BreadcrumbStep[] = [
      {
        id: tree.rootNodeId,
        leafId: rootLeafId,
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

  const handleEditUserMessage = useCallback(
    async (userNodeId: string, newContent: string) => {
      await editUserMessage(userNodeId, newContent);
      if (currentWorkspace) {
        await updateWorkspaceNodeContent(currentWorkspace.id, userNodeId, newContent);
      }
    },
    [currentWorkspace, editUserMessage]
  );


  const handleSendNewSiblingBranch = useCallback(
    async (prompt: string, parentNodeId: string, highlightedText: string) => {
      await handleSendBranchStream(prompt, parentNodeId, highlightedText, { mode: "replace_current" });
    },
    [handleSendBranchStream]
  );

  // Switch to canvas node and open side peek
  const handleSelectTreeNode = useCallback((nodeId: string) => {
    switchBranch(nodeId);
    handleOpenSidePeek(nodeId);
  }, [switchBranch, handleOpenSidePeek]);

  // Transition smoothly from Canvas view to Chat view focusing on a specific node
  const handleSwitchToChat = useCallback(
    (nodeId: string) => {
      switchBranch(nodeId);
      setViewMode("chat");
      if (currentWorkspace && activeChatId) {
        router.push(buildNodeUrl(currentWorkspace.id, activeChatId, nodeId), { scroll: false });
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
          return;
        }
      }
    }
  }, [tree, activeMessages, switchBranch]);

  const handleJumpToRoot = useCallback(() => {
    if (!tree) return;
    switchBranch(tree.rootNodeId);
    if (viewMode === "chat") {
      setTimeout(() => {
        handleJumpToMessage(tree.rootNodeId);
      }, 50);
    }
  }, [tree, switchBranch, handleJumpToMessage, viewMode]);

  const handleEscape = useCallback(() => {
    if (isSidePeekOpen) {
      handleCloseSidePeek();
    } else if (isWorkspaceModalOpen) {
      setIsWorkspaceModalOpen(false);
    } else if (isPaletteOpen) {
      setIsPaletteOpen(false);
    } else if (activeBranch) {
      clearBranchContext();
    }
  }, [isSidePeekOpen, handleCloseSidePeek, isWorkspaceModalOpen, isPaletteOpen, activeBranch, clearBranchContext]);


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
        onOpenModelConfig={() => setIsModelConfigOpen(true)}
        onOpenFileLibrary={() => setIsFileLibraryOpen(true)}
        activeModelName={llmConfig.model}
        messageCount={activeMessages.length}

        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        onNewChat={handleNewChat}
        onClearChat={() => {
          clearMessages();
          handleCloseSidePeek();
        }}
        breadcrumbs={
          <BranchBreadcrumbs
            steps={breadcrumbSteps}
            onSelectStep={(step) => {
              lastProcessedBranchRef.current = null;
              lastProcessedNodeRef.current = null;
              switchBranch(step.leafId);
              setSidePeekState({ stack: [], index: 0 });
              if (currentWorkspace && activeChatId) {
                router.replace(buildChatUrl(currentWorkspace.id, activeChatId), { scroll: false });
              }
            }}
          />
        }
      />

      {/* Main App Layout: Workspace Chats Sidebar + Canvas / Primary Chat + Side-Peek */}
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
          onOpenSettings={() => setIsModelConfigOpen(true)}
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
                  handleOpenSidePeek(nodeId, text || undefined);
                }}
                onSwitchToChat={handleSwitchToChat}
                onRetry={retryLastMessage}
                onFitViewRef={fitViewRef}
                onCenterActiveRef={centerActiveRef}
                onAutoLayoutRef={autoLayoutRef}
                onPaneClick={handleCloseSidePeek}
                isSidePeekOpen={isSidePeekOpen}
              />
            </div>
          ) : (
            /* Linear Mainline Stream Chat View */
            <div className="w-full h-full flex flex-col min-w-0 relative">
              <main
                ref={scrollRef}
                className="flex-1 overflow-y-auto min-h-0 flex flex-col bg-white"
              >
                {activeMessages.length === 0 ? (
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
                              handleSendMessage(item.prompt);
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
                  /* Active Lineage Message Stream */
                  <div className="w-full pb-4 max-w-3xl mx-auto">
                    {(() => {
                      const lastUserIndex = activeMessages.map((m) => m.role).lastIndexOf("user");
                      const lastAssistantIndex = activeMessages.map((m) => m.role).lastIndexOf("assistant");

                      return activeMessages.map((node, index) => {
                        const isLastAssistant =
                          index === activeMessages.length - 1 &&
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
                            onExploreBranch={handleExplainBranchFromMain}
                            onOpenSideBranch={(leafId, excerpt) => handleOpenSidePeek(leafId, excerpt)}
                            onRateResponse={handleRateResponse}
                          />
                        );
                      });
                    })()}
                    <div ref={bottomRef} />
                  </div>
                )}
              </main>

              {/* Chat Input Bar */}
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
                  workspaceId={currentWorkspace?.id}
                  onSendMessage={handleSendMessage}
                  onStopStreaming={stopStreaming}
                  isStreaming={isStreaming}
                  activeBranch={activeBranch}
                  onClearBranch={clearBranchContext}
                />
              </div>
            </div>
          )}

          {/* Interactive Notion-Style Side-Peek Branch Sheet */}
          <SidePeekBranchSheet
            isOpen={isSidePeekOpen}
            hasBackdrop={viewMode !== "canvas"}
            tree={tree}
            historyStack={sidePeekStack}
            historyIndex={sidePeekIndex}
            isStreaming={isStreaming}
            streamingNodeId={streamingNodeId}
            onClose={handleCloseSidePeek}
            onNavigateBack={handleNavigateSidePeekBack}
            onNavigateForward={handleNavigateSidePeekForward}
            onPushBranch={handlePushSidePeekBranch}
            onOpenBranch={handleOpenSidePeek}
            onPromoteToPrimary={handlePromoteSidePeekToPrimary}
            onSendMessage={(prompt, parentNodeId) => {
              handleSendBranchStream(prompt, parentNodeId, "", { mode: "none" });
            }}
            onSendNewSiblingBranch={handleSendNewSiblingBranch}
            onSelectSiblingTab={handleSwitchSidePeekSiblingTab}
            onDeleteBranch={(nodeId) => currentWorkspace && deleteBranch(nodeId, currentWorkspace.id)}
            onRenameBranch={handleRenameBranch}
            onTogglePinBranch={handleTogglePinBranch}
            onExploreBranch={(parentNodeId, highlightedText) => {
              handleSendBranchStream(
                `Explain "${highlightedText}" in concise, direct detail with key takeaways.`,
                parentNodeId,
                highlightedText,
                { mode: "push" }
              );
            }}
            onRegenerate={regenerateResponse}
            onEditUserMessage={handleEditUserMessage}
            onSwitchBranch={switchBranch}
            onRateResponse={handleRateResponse}
          />
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
          handleCloseSidePeek();
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

      {/* Comprehensive Multi-Tab Master-Detail Settings Modal */}
      <SettingsModal
        isOpen={isModelConfigOpen}
        onClose={() => setIsModelConfigOpen(false)}
        config={llmConfig}
        onSaveConfig={updateLLMConfig}
        onResetDefaults={resetLLMDefaults}
        currentWorkspace={currentWorkspace}
      />

      {/* Workspace File Library Modal */}
      {currentWorkspace && (
        <FileLibraryModal
          isOpen={isFileLibraryOpen}
          onClose={() => setIsFileLibraryOpen(false)}
          workspaceId={currentWorkspace.id}
        />
      )}

      {/* Non-intrusive Floating Toast Notification */}
      <Toast message={error} onDismiss={clearError} />
    </div>
  );

}
