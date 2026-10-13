"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { GitBranch, ArrowDown, ListFilter } from "lucide-react";

import {
  getNodeChildren,
  getBranchLinearLeafNode,
  getAncestorPath,
  FileAttachment,
} from "@graphmind/shared";

import { ChatMessage } from "./ChatMessage";
import {
  buildLearningActionPrompt,
  getLearningActionDisplayPrompt,
  type LearningActionId,
} from "./LearningActions";
import { ChatInput } from "./ChatInput";
import { BranchBreadcrumbs, BreadcrumbStep } from "./BranchBreadcrumbs";

import { ChatSidebar } from "./ChatSidebar";
import { NewWorkspaceChatModal, type NewWorkspaceChatCreated } from "./NewWorkspaceChatModal";
import { RightSidebar } from "./RightSidebar";
import { useTopicSession } from "@/hooks/useTopicSession";
import { TopicBriefDrawer } from "@/components/roadmap/TopicBriefDrawer";
import { BranchPromotionModal } from "@/components/roadmap/BranchPromotionModal";
import { TutorLearningBar } from "@/components/roadmap/TutorLearningBar";
import { openTopicSession, recordTopicCheck } from "@/lib/roadmapApi";
import { useRoadmap } from "@/hooks/useRoadmap";
import { RoadmapWorkspace } from "@/components/roadmap/RoadmapWorkspace";
import { RoadmapHeader } from "@/components/roadmap/RoadmapHeader";
import { roadmapRouteMode } from "@/lib/urls";
import { GraphCanvas } from "../canvas/GraphCanvas";
import { CommandPalette } from "../canvas/CommandPalette";
import { SettingsPage } from "../settings/SettingsPage";
import { FileLibraryView } from "../library/FileLibraryView";
import { SidePeekBranchSheet, SidePeekEntry } from "./SidePeekBranchSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { InlineFeedback } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/skeleton";
import { Toast } from "@/components/ui/toast";
import { LogoBadge } from "@/components/ui/Logo";
import {
  isRetryableAssistantResponse,
  useChatStream,
} from "@/hooks/useChatStream";
import { useModelConfig } from "@/hooks/useModelConfig";
import { useScrollAnchor } from "@/hooks/useScrollAnchor";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { safeGetItem, safeSetItem } from "@/lib/storage";

import {
  ChatHeader,
  LibraryHeader,
  SettingsHeader,
  ViewMode,
} from "../layout/Navbar";
import { WorkspaceShell } from "../layout/WorkspaceShell";
import {
  buildWorkspaceUrl,
  buildLibraryUrl,
  buildChatUrl,
  buildCanvasUrl,
  buildSettingsUrl,
  buildNodeUrl,
  buildBranchUrl,
} from "@/lib/urls";
import {
  WorkspaceItem,
  ChatItem,
  fetchWorkspaces,
  fetchWorkspace,
  createWorkspace,
  fetchWorkspaceChats,
  deleteWorkspaceChat,
  renameWorkspaceChat,
  togglePinWorkspaceChat,
  updateWorkspaceNodeMetadata,
  updateWorkspaceNodeContent,
  fetchGraphSnapshot,
  addNodeToWorkspace,
  persistWorkspaceChatNode,
  snapshotToTree,
  seedDemoWorkspace,
} from "@/lib/workspaceApi";
import type { FlashcardGenerationConfig } from "@/lib/flashcardApi";

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(() => {
    const saved = safeGetItem("graphmind_right_sidebar_open_v1");
    return saved === "true";
  });

  const handleToggleRightSidebar = useCallback(() => {
    setIsRightSidebarOpen((prev) => {
      const next = !prev;
      safeSetItem("graphmind_right_sidebar_open_v1", String(next));
      return next;
    });
  }, []);

  // Centralized Model & AI Generation Configuration (BYOK)
  const {
    config: llmConfig,
    updateConfig: updateLLMConfig,
    resetDefaults: resetLLMDefaults,
    getEffectiveApiKey,
    getEffectiveBaseUrl,
  } = useModelConfig();

  const flashcardGenerationConfig: FlashcardGenerationConfig = useMemo(() => {
    const apiKey = getEffectiveApiKey(llmConfig.provider);
    return {
      provider: llmConfig.provider,
      model: llmConfig.model,
      baseUrl: getEffectiveBaseUrl(llmConfig.provider),
      apiKey: apiKey || undefined,
    };
  }, [
    llmConfig.provider,
    llmConfig.model,
    getEffectiveApiKey,
    getEffectiveBaseUrl,
  ]);

  // Two-Tier State: Workspaces (Outer Vault) and Chats (Inner Trees)
  const [currentWorkspace, setCurrentWorkspace] =
    useState<WorkspaceItem | null>(null);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(
    initialChatId || null,
  );
  // While a chat tree is being fetched (deep link, sidebar click, history
  // navigation) the main pane shows a skeleton instead of stale/empty content.
  const [loadingChatId, setLoadingChatId] = useState<string | null>(
    initialChatId || null,
  );
  const isLoadingChat =
    loadingChatId !== null && loadingChatId === activeChatId;

  const [syncStatus, setSyncStatus] = useState<"saved" | "syncing" | "offline">(
    "saved",
  );
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);

  const handleOpenSettings = useCallback(() => {
    if (currentWorkspace) {
      router.push(buildSettingsUrl(currentWorkspace.id));
    }
  }, [currentWorkspace, router]);

  const handleOpenRoadmap = useCallback(() => {
    if (currentWorkspace) {
      router.push(buildWorkspaceUrl(currentWorkspace.id));
    }
  }, [currentWorkspace, router]);

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

  const { scrollRef, bottomRef, isAtBottom, showScrollButton, scrollToBottom } =
    useScrollAnchor({ threshold: 80 });

  // References to prevent duplicate re-initialization and route flicker
  const roadmap = useRoadmap(
    process.env.NEXT_PUBLIC_ROADMAP_GENERATOR_ENABLED === "true"
      ? (currentWorkspace?.id ?? initialWorkspaceId ?? null)
      : null,
  );
  const roadmapMode = roadmapRouteMode(pathname, roadmap.view);
  const waitingForRoadmap =
    process.env.NEXT_PUBLIC_ROADMAP_GENERATOR_ENABLED === "true" &&
    (pathname ===
      buildWorkspaceUrl(currentWorkspace?.id ?? initialWorkspaceId ?? "") ||
      pathname.endsWith("/canvas")) &&
    (roadmap.loading || Boolean(roadmap.error));

  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [openingTopic, setOpeningTopic] = useState(false);
  const [isNewWorkspaceChatOpen, setIsNewWorkspaceChatOpen] = useState(false);
  const [pendingPreparedChat, setPendingPreparedChat] =
    useState<NewWorkspaceChatCreated | null>(null);
  const [isRoadmapContextOpen, setIsRoadmapContextOpen] = useState(false);
  const [selectedRoadmapTopicIds, setSelectedRoadmapTopicIds] = useState<string[]>([]);
  const [roadmapContextError, setRoadmapContextError] = useState<string | null>(null);
  const [isSavingRoadmapContext, setIsSavingRoadmapContext] = useState(false);
  const [promotionSource, setPromotionSource] = useState<{
    chatId: string;
    nodeId: string;
    title: string;
    excerpt: string;
  } | null>(null);
  const [promotionJobId, setPromotionJobId] = useState<string | null>(null);
  const [promotionJobsBySource, setPromotionJobsBySource] = useState<Record<string, string>>({});
  const [isPromotionOpen, setIsPromotionOpen] = useState(false);
  type UnsavedAssistant = {
    workspaceId: string;
    id: string;
    parentId: string;
    content: string;
    provider: string;
    model: string;
    responseState: string;
    generation?: number;
  };
  const [unsavedAssistant, setUnsavedAssistantState] =
    useState<UnsavedAssistant | null>(null);
  const unsavedAssistantRef = useRef<UnsavedAssistant | null>(null);
  const setUnsavedAssistant = useCallback(
    (
      update:
        | UnsavedAssistant
        | null
        | ((current: UnsavedAssistant | null) => UnsavedAssistant | null),
    ) => {
      const next =
        typeof update === "function" ? update(unsavedAssistantRef.current) : update;
      unsavedAssistantRef.current = next;
      setUnsavedAssistantState(next);
    },
    [],
  );
  const currentWorkspaceIdRef = useRef<string | null>(null);
  const activeChatIdRef = useRef<string | null>(initialChatId || null);
  currentWorkspaceIdRef.current = currentWorkspace?.id ?? null;
  activeChatIdRef.current = activeChatId;
  const contextSaveInFlight = useRef(false);
  const [learningError, setLearningError] = useState<string | null>(null);
  const [assessing, setAssessing] = useState(false);
  const openingRef = useRef(false);
  const startKeys = useRef(new Map<string, string>());
  const routeRef = useRef(pathname);
  routeRef.current = pathname;
  const newChatOriginRouteRef = useRef<string | null>(null);
  const rootSessionId =
    tree?.rootNodeId === activeChatId
      ? tree?.nodes[tree.rootNodeId]?.metadata?.topicSessionId
      : null;
  const activeTopicSessionId =
    typeof rootSessionId === "string" ? rootSessionId : null;
  const persistedRoadmapTopicIds = useMemo(() => {
    if (!tree || tree.rootNodeId !== activeChatId) return [] as string[];
    const value = tree.nodes[tree.rootNodeId]?.metadata?.roadmapTopicIds;
    return Array.isArray(value)
      ? value.filter((id): id is string => typeof id === "string").slice(0, 3)
      : [];
  }, [tree, activeChatId]);
  useEffect(() => {
    setSelectedRoadmapTopicIds(persistedRoadmapTopicIds);
    setRoadmapContextError(null);
  }, [activeChatId, persistedRoadmapTopicIds]);
  const activeRoadmapTopics = useMemo(
    () =>
      roadmap.view?.candidate.items.filter(
        (item) => item.kind === "topic" && item.participation === "active",
      ) ?? [],
    [roadmap.view],
  );
  const activeRoadmapTopicIds = useMemo(
    () => new Set(activeRoadmapTopics.map((topic) => topic.id)),
    [activeRoadmapTopics],
  );
  const selectedActiveRoadmapTopicIds = useMemo(
    () => selectedRoadmapTopicIds.filter((id) => activeRoadmapTopicIds.has(id)),
    [selectedRoadmapTopicIds, activeRoadmapTopicIds],
  );
  const handleRoadmapTopicSelection = useCallback(
    async (topicId: string, selected: boolean) => {
      if (contextSaveInFlight.current) return;
      if (!currentWorkspace || !activeChatId || !roadmap.view || activeTopicSessionId)
        return;
      if (!roadmap.view.canWrite) return;
      const next = selected
        ? [...new Set([...selectedRoadmapTopicIds, topicId])]
        : selectedRoadmapTopicIds.filter((id) => id !== topicId);
      if (next.length > 3) {
        setRoadmapContextError("Choose up to three topics for this conversation.");
        return;
      }
      const rootId = tree?.rootNodeId;
      if (!rootId || rootId !== activeChatId) return;
      setRoadmapContextError(null);
      contextSaveInFlight.current = true;
      setIsSavingRoadmapContext(true);
      let saved = false;
      try {
        saved = await updateWorkspaceNodeMetadata(currentWorkspace.id, rootId, {
          roadmapTopicIds: next,
        });
      } catch {
        saved = false;
      } finally {
        contextSaveInFlight.current = false;
        if (
          currentWorkspaceIdRef.current === currentWorkspace.id &&
          activeChatIdRef.current === rootId
        ) setIsSavingRoadmapContext(false);
      }
      if (
        currentWorkspaceIdRef.current !== currentWorkspace.id ||
        activeChatIdRef.current !== rootId
      )
        return;
      if (!saved) {
        setRoadmapContextError("Could not save topic context. Try again.");
        return;
      }
      updateNodeMetadata(rootId, { roadmapTopicIds: next });
      setSelectedRoadmapTopicIds(next);
    },
    [
      currentWorkspace,
      activeChatId,
      roadmap.view,
      activeTopicSessionId,
      selectedRoadmapTopicIds,
      tree,
      updateNodeMetadata,
    ],
  );
  const topicSession = useTopicSession(
    currentWorkspace?.id ?? null,
    activeTopicSessionId,
  );
  const refreshTopicSession = topicSession.refresh;
  const currentLessonProgress = topicSession.session?.progress;
  const updateRoadmapProgress = roadmap.updateProgress;
  useEffect(() => {
    if (currentLessonProgress) updateRoadmapProgress(currentLessonProgress);
  }, [currentLessonProgress, updateRoadmapProgress]);
  const attemptedLessons = useRef(new Set<string>());
  useEffect(() => {
    if (!roadmapMode) setSelectedTopicId(null);
  }, [roadmapMode]);
  const startTopic = async (topicId: string) => {
    if (!roadmap.view || openingRef.current) return;
    openingRef.current = true;
    setOpeningTopic(true);
    setLearningError(null);
    const startPath = pathname;
    const workspaceId = roadmap.view.workspaceId;
    let key = startKeys.current.get(topicId);
    if (!key) {
      key = crypto.randomUUID();
      startKeys.current.set(topicId, key);
    }
    try {
      const lesson = await openTopicSession(workspaceId, topicId, key, false);
      if (routeRef.current === startPath)
        router.push(buildChatUrl(workspaceId, lesson.chatId));
      // Refresh the sidebar list in the background — never block navigation.
      void refreshChats(workspaceId);
    } catch (error) {
      setLearningError(
        error instanceof Error
          ? error.message
          : "Could not open your lesson. Try again.",
      );
    } finally {
      openingRef.current = false;
      setOpeningTopic(false);
    }
  };

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

  useEffect(() => {
    if (currentWorkspace?.id && activeChatId)
      void refreshChats(currentWorkspace.id);
  }, [currentWorkspace?.id, activeChatId, refreshChats]);

  // Jump smoothly to a specific message card in the active feed
  const handleJumpToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary/40", "bg-surface-hover");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-primary/40", "bg-surface-hover");
      }, 1200);
    }
  }, []);

  const isPromotableBranchNode = useCallback(
    (nodeId: string) => {
      if (!roadmap.view || !tree || isStreaming) return false;
      if (!roadmap.view.canWrite) return false;
      const node = tree.nodes[nodeId];
      if (!node || node.role !== "assistant" || !node.content.trim()) return false;
      if (!persistedNodeIdsRef.current.has(nodeId)) return false;
      return getAncestorPath(tree, nodeId).some(
        (ancestor) => ancestor.id !== tree.rootNodeId && Boolean(ancestor.highlightedContext),
      );
    },
    [roadmap.view, tree, isStreaming],
  );
  const handleRequestPromotion = useCallback(
    (nodeId: string) => {
      if (!currentWorkspace || !activeChatId || !isPromotableBranchNode(nodeId) || !tree) return;
      const node = tree.nodes[nodeId];
      if (!node) return;
      setPromotionSource({
        chatId: activeChatId,
        nodeId,
        title: chats.find((chat) => chat.id === activeChatId)?.title || "Current conversation",
        excerpt: node.content,
      });
      const sourceKey = `${activeChatId}:${nodeId}`;
      setPromotionJobId(promotionJobsBySource[sourceKey] ?? null);
      setIsPromotionOpen(true);
    },
    [currentWorkspace, activeChatId, isPromotableBranchNode, tree, chats, promotionJobsBySource],
  );

  // Load a chat tree in the background. `loadingChatId` drives the skeleton
  // in the main pane so navigation feels instant even before data arrives.
  // A monotonic request id makes sure a slower earlier response never
  // overwrites the chat the user most recently clicked.
  const latestChatRequestRef = useRef(0);
  const loadChatTree = useCallback(
    async (workspaceId: string, chatId: string) => {
      const requestId = ++latestChatRequestRef.current;
      setLoadingChatId(chatId);
      try {
        const snapshot = await fetchGraphSnapshot(workspaceId, chatId);
        if (requestId !== latestChatRequestRef.current) return; // superseded
        if (snapshot) {
          const loadedTree = snapshotToTree(snapshot);
          if (loadedTree) {
            persistedNodeIdsRef.current = new Set(Object.keys(loadedTree.nodes));
            loadTree(loadedTree);
          }
        }
      } finally {
        if (requestId === latestChatRequestRef.current)
          setLoadingChatId((prev) => (prev === chatId ? null : prev));
      }
    },
    [loadTree],
  );

  // Initialize workspace & load initial chat — runs EXACTLY ONCE on mount.
  useEffect(() => {
    if (initializedWorkspaceIdRef.current) return; // already ran

    async function initWorkspace() {
      const wsId = initialWorkspaceIdRef.current;
      const chatId = initialChatIdRef.current;
      const branchId = initialBranchIdRef.current;
      const nodeId = initialNodeIdRef.current;
      const viewMode = initialViewModeRef.current;
      // Tree loaded for the deep-linked chat (if any) so side-peek wiring
      // below can inspect its nodes without a second fetch.
      let loadedTree: ReturnType<typeof snapshotToTree> = null;

      try {
        let ws: WorkspaceItem | null = null;
        if (wsId) {
          if (chatId) {
            // Deep link: fetch the target chat tree FIRST so the conversation
            // paints immediately; only metadata is loaded for the workspace.
            setLoadingChatId(chatId);
            ws = await fetchWorkspace(wsId);
            if (ws) {
              const snapshot = await fetchGraphSnapshot(wsId, chatId);
              if (snapshot) {
                loadedTree = snapshotToTree(snapshot);
                if (loadedTree) {
                  persistedNodeIdsRef.current = new Set(Object.keys(loadedTree.nodes));
                  loadTree(loadedTree);
                }
              }
            }
          } else {
            ws = await fetchWorkspace(wsId);
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
                const snapshot = await fetchGraphSnapshot(
                  seedResult.workspaceId,
                );
                if (snapshot) {
                  ws = snapshot.workspace;
                }
              } catch (seedErr) {
                console.error(
                  "Failed to seed demo workspace, falling back to blank",
                  seedErr,
                );
                ws = await createWorkspace(
                  "Main Workspace",
                  "Default knowledge vault",
                );
              }
            }
            if (!ws) {
              ws = await createWorkspace(
                "Main Workspace",
                "Default knowledge vault",
              );
            }
          }
        }

        setCurrentWorkspace(ws);

        if (ws) {
          initializedWorkspaceIdRef.current = ws.id;
          setLoadingChatId(null);
          await refreshChats(ws.id);

          const targetChatId = chatId || null;
          loadedChatIdRef.current = targetChatId;
          activeChatIdRef.current = targetChatId;
          setActiveChatId(targetChatId);

          // The target chat tree was loaded above in the deep-link branch;
          // here we only wire up side-peek state for ?branch= / ?node= params.
          if (targetChatId && loadedTree) {
            if (branchId && loadedTree.nodes[branchId]) {
              const node = loadedTree.nodes[branchId];
              lastProcessedBranchRef.current = branchId;
              setSidePeekState({
                stack: [
                  {
                    nodeId: branchId,
                    excerpt: node.highlightedContext || undefined,
                  },
                ],
                index: 0,
              });
            }
          }

          if (nodeId) {
            lastProcessedNodeRef.current = nodeId;
            if (viewMode === "canvas") {
              setSidePeekState({ stack: [{ nodeId }], index: 0 });
            }
          }

          if (
            typeof window !== "undefined" &&
            !targetChatId &&
            viewMode !== "settings"
          ) {
            // Only replace URL when no chatId is in the path yet
            router.replace(buildWorkspaceUrl(ws.id), { scroll: false });
          } else if (
            typeof window !== "undefined" &&
            targetChatId &&
            ws &&
            viewMode !== "settings"
          ) {
            const url =
              viewMode === "canvas"
                ? buildCanvasUrl(
                    ws.id,
                    targetChatId,
                    nodeId ? { node: nodeId } : undefined,
                  )
                : buildChatUrl(
                    ws.id,
                    targetChatId,
                    branchId
                      ? { branch: branchId }
                      : nodeId
                        ? { node: nodeId }
                        : undefined,
                  );
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

    // 1. Sync viewMode from the canonical route.
    const targetViewMode: ViewMode = pathname.endsWith("/canvas")
      ? "canvas"
      : pathname.endsWith("/library")
        ? "library"
        : pathname.endsWith("/settings")
          ? "settings"
          : "chat";
    setViewMode((prev) => (prev !== targetViewMode ? targetViewMode : prev));

    // 2. Sync chatId from path: /w/{workspaceId}/chat/{chatId}
    const chatIdMatch = pathname.match(/\/chat\/([^/]+)/);
    const targetChatId = chatIdMatch ? chatIdMatch[1] : null;

    if (targetChatId && targetChatId !== loadedChatIdRef.current) {
      loadedChatIdRef.current = targetChatId;
      activeChatIdRef.current = targetChatId;
      setActiveChatId(targetChatId);
      lastProcessedBranchRef.current = null;
      lastProcessedNodeRef.current = null;
      // Skeleton shows in the pane while the tree loads, so back/forward
      // navigation feels instant rather than blocked on the fetch.
      void loadChatTree(currentWorkspace.id, targetChatId);
    } else if (
      !targetChatId &&
      loadedChatIdRef.current &&
      pathname === buildWorkspaceUrl(currentWorkspace.id)
    ) {
      loadedChatIdRef.current = null;
      activeChatIdRef.current = null;
      setActiveChatId(null);
      setLoadingChatId(null);
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
  }, [
    pathname,
    searchParams,
    currentWorkspace,
    loadTree,
    loadChatTree,
    clearMessages,
    handleJumpToMessage,
  ]);

  // A promotion-origin ?node= link can point inside a nested branch. Rebuild
  // every branch step so the source opens in its conversation context.
  useEffect(() => {
    if (!tree || !activeChatId) return;
    const nodeId = searchParams.get("node");
    if (!nodeId || !tree.nodes[nodeId]) return;
    const key = `${activeChatId}:${nodeId}`;
    if (resolvedDeepNodeRef.current === key) return;
    resolvedDeepNodeRef.current = key;
    const branchRoots = getAncestorPath(tree, nodeId).filter(
      (node) => node.id !== tree.rootNodeId && Boolean(node.highlightedContext),
    );
    if (branchRoots.length > 0) {
      setSidePeekState({
        stack: branchRoots.map((node) => ({
          nodeId: node.id,
          excerpt: node.highlightedContext || undefined,
        })),
        index: branchRoots.length - 1,
      });
      lastProcessedBranchRef.current = nodeId;
    } else if (viewMode === "canvas") {
      setSidePeekState({ stack: [{ nodeId }], index: 0 });
    } else {
      setTimeout(() => handleJumpToMessage(nodeId), 150);
    }
  }, [tree, activeChatId, searchParams, viewMode, handleJumpToMessage]);

  // Start a completely fresh chat tree inside the current workspace
  const handleNewChat = useCallback(() => {
    clearMessages();
    activeChatIdRef.current = null;
    setActiveChatId(null);
    setLoadingChatId(null);
    loadedChatIdRef.current = null;
    lastProcessedBranchRef.current = null;
    lastProcessedNodeRef.current = null;
    setSidePeekState({ stack: [], index: 0 });
    if (currentWorkspace) {
      router.push(buildWorkspaceUrl(currentWorkspace.id), { scroll: false });
    }
  }, [clearMessages, currentWorkspace, router]);

  const handleRequestNewChat = useCallback(() => {
    if (roadmap.view && roadmap.view.canWrite && currentWorkspace) {
      newChatOriginRouteRef.current = routeRef.current;
      setIsNewWorkspaceChatOpen(true);
      return;
    }
    if (roadmap.view && !roadmap.view.canWrite) return;
    handleNewChat();
  }, [roadmap.view, currentWorkspace, handleNewChat]);

  const handleCreatedWorkspaceChat = useCallback(
    async (chat: NewWorkspaceChatCreated) => {
      if (
        currentWorkspaceIdRef.current !== chat.workspaceId ||
        routeRef.current !== newChatOriginRouteRef.current
      ) return;
      setIsNewWorkspaceChatOpen(false);
      setSidePeekState({ stack: [], index: 0 });
      setSelectedRoadmapTopicIds(chat.roadmapTopicIds);
      activeChatIdRef.current = chat.rootNodeId;
      setActiveChatId(chat.rootNodeId);
      setLoadingChatId(chat.rootNodeId);
      loadedChatIdRef.current = chat.rootNodeId;
      lastProcessedBranchRef.current = null;
      lastProcessedNodeRef.current = null;
      router.push(buildChatUrl(chat.workspaceId, chat.rootNodeId), {
        scroll: false,
      });
      const snapshot = await fetchGraphSnapshot(chat.workspaceId, chat.rootNodeId);
      if (
        currentWorkspaceIdRef.current !== chat.workspaceId ||
        activeChatIdRef.current !== chat.rootNodeId ||
        loadedChatIdRef.current !== chat.rootNodeId
      )
        return;
      const loaded = snapshot ? snapshotToTree(snapshot) : null;
      if (!loaded || loaded.rootNodeId !== chat.rootNodeId) {
        setLoadingChatId(null);
        if (activeChatIdRef.current === chat.rootNodeId) {
          setLearningError("Your new conversation is saved. Reload it to start the response.");
        }
        return;
      }
      loadTree(loaded);
      persistedNodeIdsRef.current = new Set(Object.keys(loaded.nodes));
      setLoadingChatId(null);
      setPendingPreparedChat(chat);
    },
    [router, loadTree],
  );

  const preparedStartInFlight = useRef<string | null>(null);
  const persistedNodeIdsRef = useRef(new Set<string>());
  const assistantSaveQueueRef = useRef(new Map<string, Promise<void>>());
  const assistantGenerationRef = useRef(new Map<string, number>());
  const resolvedDeepNodeRef = useRef<string | null>(null);
  const invalidateAssistantPersistence = useCallback(
    (workspaceId: string, assistantId: string) => {
      const key = `${workspaceId}:${assistantId}`;
      const generation = (assistantGenerationRef.current.get(key) ?? 0) + 1;
      assistantGenerationRef.current.set(key, generation);
      persistedNodeIdsRef.current.delete(assistantId);
      setUnsavedAssistant((current) =>
        current?.id === assistantId && current.workspaceId === workspaceId
          ? null
          : current,
      );
      return generation;
    },
    [setUnsavedAssistant],
  );
  const persistAssistantResponse = useCallback(
    (
      workspaceId: string,
      payload: Parameters<typeof persistWorkspaceChatNode>[1],
    ) => {
      const key = `${workspaceId}:${payload.id}`;
      const previous = assistantSaveQueueRef.current.get(key);
      const current = (previous ?? Promise.resolve())
        .catch(() => undefined)
        .then(async () => {
          await persistWorkspaceChatNode(workspaceId, payload);
        });
      assistantSaveQueueRef.current.set(key, current);
      return current.finally(() => {
        if (assistantSaveQueueRef.current.get(key) === current)
          assistantSaveQueueRef.current.delete(key);
      });
    },
    [],
  );
  useEffect(() => {
    const prepared = pendingPreparedChat;
    if (
      !prepared ||
      !tree ||
      tree.rootNodeId !== prepared.rootNodeId ||
      activeChatId !== prepared.rootNodeId ||
      currentWorkspace?.id !== prepared.workspaceId ||
      isStreaming ||
      preparedStartInFlight.current === prepared.rootNodeId
    )
      return;
    preparedStartInFlight.current = prepared.rootNodeId;
    setPendingPreparedChat(null);
    const roadmapTopicIds = prepared.roadmapTopicIds
      .filter((id) => activeRoadmapTopicIds.has(id))
      .slice(0, 3);
    let assistantNodeId: string | null = null;
    let assistantGeneration: number | null = null;
    void (async () => {
      let responseId: string | null = null;
      let result: Awaited<ReturnType<typeof sendMessage>> = null;
      try {
        result = await sendMessage(
          prepared.prompt,
          prepared.provider,
          prepared.model,
          {
            workspaceId: prepared.workspaceId,
            preparedUserMessageId: prepared.rootNodeId,
            roadmapTopicIds,
            apiKey: getEffectiveApiKey(prepared.provider),
            baseUrl: getEffectiveBaseUrl(prepared.provider),
            temperature: llmConfig.temperature,
            maxTokens: llmConfig.maxTokens,
            systemPrompt: llmConfig.systemPrompt || undefined,
            onNodeCreated: async ({ assistantNodeId: createdId, preparedUserMessage }) => {
              if (!preparedUserMessage) {
                throw new Error("The saved conversation root was not reused.");
              }
              // A prepared retry reuses the existing assistant ID, but its
              // replacement content is not durable until the save below.
              assistantGeneration = invalidateAssistantPersistence(
                prepared.workspaceId,
                createdId,
              );
              assistantNodeId = createdId;
            },
          },
        );
        responseId = result?.assistantNodeId || assistantNodeId;
        if (responseId && result) {
          try {
            await persistAssistantResponse(prepared.workspaceId, {
              id: responseId,
              parentId: prepared.rootNodeId,
              role: "assistant",
              content: result.content,
              provider: prepared.provider,
              model: prepared.model,
              metadata: { responseState: result.responseState },
            });
            const key = `${prepared.workspaceId}:${responseId}`;
            if (assistantGenerationRef.current.get(key) === assistantGeneration) {
              persistedNodeIdsRef.current.add(responseId);
              setUnsavedAssistant((current) =>
                current?.id === responseId && current.workspaceId === prepared.workspaceId
                  ? null
                  : current,
              );
            }
            await refreshChats(prepared.workspaceId);
          } catch (saveError) {
            const key = `${prepared.workspaceId}:${responseId}`;
            if (
              activeChatIdRef.current === prepared.rootNodeId &&
              assistantGenerationRef.current.get(key) === assistantGeneration
            ) {
              setUnsavedAssistant({
                workspaceId: prepared.workspaceId,
                id: responseId,
                parentId: prepared.rootNodeId,
                content: result.content,
                provider: prepared.provider,
                model: prepared.model,
                responseState: result.responseState,
                generation: assistantGeneration ?? 0,
              });
              setLearningError(saveError instanceof Error ? saveError.message : "Could not save the response.");
            }
          }
        }
      } catch (error) {
        if (
          currentWorkspaceIdRef.current === prepared.workspaceId &&
          activeChatIdRef.current === prepared.rootNodeId
        ) {
          setLearningError(
            error instanceof Error
              ? error.message
              : "The conversation is saved. Retry the response from this chat.",
          );
        }
      } finally {
        preparedStartInFlight.current = null;
      }
    })();
  }, [
    pendingPreparedChat,
    tree,
    activeChatId,
    currentWorkspace?.id,
    activeRoadmapTopicIds,
    isStreaming,
    sendMessage,
    getEffectiveApiKey,
    getEffectiveBaseUrl,
    invalidateAssistantPersistence,
    persistAssistantResponse,
    setUnsavedAssistant,
    llmConfig.temperature,
    llmConfig.maxTokens,
    llmConfig.systemPrompt,
    refreshChats,
  ]);

  // Select an existing chat inside the current workspace
  const handleSelectChat = useCallback(
    async (chat: ChatItem) => {
      if (!currentWorkspace) return;
      if (activeChatId === chat.id) return;

      // Update active state immediately so sidebar reflects selection
      activeChatIdRef.current = chat.id;
      setActiveChatId(chat.id);
      setLoadingChatId(chat.id);
      loadedChatIdRef.current = chat.id;
      lastProcessedBranchRef.current = null;
      lastProcessedNodeRef.current = null;
      setSidePeekState({ stack: [], index: 0 });

      router.push(buildChatUrl(currentWorkspace.id, chat.id), {
        scroll: false,
      });

      // Fetch snapshot in background — the pane shows a skeleton while the
      // tree loads instead of keeping the previous chat's messages visible.
      await loadChatTree(currentWorkspace.id, chat.id);
    },
    [currentWorkspace, activeChatId, loadChatTree, router],
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
    [
      currentWorkspace,
      activeChatId,
      refreshChats,
      handleSelectChat,
      handleNewChat,
    ],
  );

  // Rename a chat in the sidebar — updates metadata title on the backend then refreshes list
  const handleRenameChat = useCallback(
    async (chatId: string, newTitle: string) => {
      if (!currentWorkspace || !newTitle.trim()) return;
      await renameWorkspaceChat(currentWorkspace.id, chatId, newTitle.trim());
      await refreshChats(currentWorkspace.id);
    },
    [currentWorkspace, refreshChats],
  );

  // Pin or unpin a chat in the sidebar — updates metadata on the backend then refreshes list
  const handleTogglePinChat = useCallback(
    async (chatId: string, pinned: boolean) => {
      if (!currentWorkspace) return;
      await togglePinWorkspaceChat(currentWorkspace.id, chatId, pinned);
      await refreshChats(currentWorkspace.id);
    },
    [currentWorkspace, refreshChats],
  );

  // Rename a branch tab — updates local state and persists to backend
  const handleRenameBranch = useCallback(
    async (rootNodeId: string, newTitle: string) => {
      updateNodeMetadata(rootNodeId, { title: newTitle });
      if (currentWorkspace) {
        await updateWorkspaceNodeMetadata(currentWorkspace.id, rootNodeId, {
          title: newTitle,
        });
      }
    },
    [currentWorkspace, updateNodeMetadata],
  );

  // Pin or unpin a branch tab — updates local state and persists to backend
  const handleTogglePinBranch = useCallback(
    async (rootNodeId: string, pinned: boolean) => {
      updateNodeMetadata(rootNodeId, { pinned });
      if (currentWorkspace) {
        await updateWorkspaceNodeMetadata(currentWorkspace.id, rootNodeId, {
          pinned,
        });
      }
    },
    [currentWorkspace, updateNodeMetadata],
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
    async (
      prompt: string,
      attachments?: FileAttachment[],
      activeSkill?: string | null,
    ) => {
      if (!currentWorkspace) return;

      const isFirstMessageInNewChat =
        !activeChatId || !tree || Object.keys(tree.nodes).length === 0;

      let createdUserNodeId: string | null = null;
      let createdAssistantNodeId: string | null = null;
      let createdAssistantGeneration: number | null = null;

      const provider = llmConfig.provider;
      const model = llmConfig.model;
      const sendOriginPath = routeRef.current;
      const sendOriginChatId = activeChatId;
      const effectiveApiKey = getEffectiveApiKey(provider);
      const effectiveBaseUrl = getEffectiveBaseUrl(provider);

      // Determine the target parent ID based on the currently active visible thread:
      // If the user has an active highlighted branch context, use its parentNodeId.
      // Otherwise, append strictly to the leaf of the active visible conversation messages.
      const currentActiveLeaf =
        activeMessages.length > 0
          ? activeMessages[activeMessages.length - 1].id
          : null;
      const targetParentId = isFirstMessageInNewChat
        ? null
        : activeBranch?.parentNodeId ||
          currentActiveLeaf ||
          tree?.activeNodeId ||
          null;

      const result = await sendMessage(prompt, provider, model, {
        apiKey: effectiveApiKey,
        baseUrl: effectiveBaseUrl,
        temperature: llmConfig.temperature,
        maxTokens: llmConfig.maxTokens,
        systemPrompt: llmConfig.systemPrompt || undefined,
        attachments:
          attachments && attachments.length > 0 ? attachments : undefined,
        enabledSkills: activeSkill ? [activeSkill] : undefined,
        workspaceId: currentWorkspace.id,
        topicSessionId: activeTopicSessionId ?? undefined,
        roadmapTopicIds:
          roadmap.view && !activeTopicSessionId
            ? selectedActiveRoadmapTopicIds
            : undefined,
        targetParentId,
        onNodeCreated: async ({ userNodeId, assistantNodeId, parentId, preparedUserMessage }) => {
          createdUserNodeId = userNodeId;
          createdAssistantNodeId = assistantNodeId;
          createdAssistantGeneration =
            assistantGenerationRef.current.get(
              `${currentWorkspace.id}:${assistantNodeId}`,
            ) ?? 0;

          if (preparedUserMessage) return;

          if (
            !isFirstMessageInNewChat &&
            (!parentId || !persistedNodeIdsRef.current.has(parentId))
          ) {
            throw new Error(
              "Save the visible response before sending a follow-up so the conversation ancestry is complete.",
            );
          }

          // Persist and await the user node before ancestry verification starts.
          await persistWorkspaceChatNode(currentWorkspace.id, {
            id: userNodeId,
            parentId: isFirstMessageInNewChat ? null : parentId,
            role: "user",
            content: prompt.trim(),
            provider,
            model,
            metadata:
              attachments && attachments.length > 0 ? { attachments } : {},
          });
          persistedNodeIdsRef.current.add(userNodeId);
          if (
            currentWorkspaceIdRef.current !== currentWorkspace.id ||
            routeRef.current !== sendOriginPath ||
            (!isFirstMessageInNewChat && activeChatIdRef.current !== sendOriginChatId)
          ) {
            throw new Error("The conversation changed before the message could be sent.");
          }
          await refreshChats(currentWorkspace.id);
          if (isFirstMessageInNewChat) {
            activeChatIdRef.current = userNodeId;
            setActiveChatId(userNodeId);
            loadedChatIdRef.current = userNodeId;
            router.push(buildChatUrl(currentWorkspace.id, userNodeId), {
              scroll: false,
            });
          }
        },
      });

      scrollToBottom(true);

      const targetAssistantId =
        result?.assistantNodeId || createdAssistantNodeId;
      const targetUserId = result?.userNodeId || createdUserNodeId;
      const assistantContent = result?.content || "";

      // When streaming finishes, persist final assistant response node
      if (result && targetAssistantId && targetUserId) {
        const assistantKey = `${currentWorkspace.id}:${targetAssistantId}`;
        const generation =
          createdAssistantGeneration ??
          assistantGenerationRef.current.get(assistantKey) ??
          0;
        {
          if ((assistantGenerationRef.current.get(assistantKey) ?? 0) === generation) {
            try {
              await persistAssistantResponse(currentWorkspace.id, {
                id: targetAssistantId,
                parentId: targetUserId,
                role: "assistant",
                content: assistantContent,
                provider,
                model,
                metadata: { responseState: result.responseState },
              });
              if ((assistantGenerationRef.current.get(assistantKey) ?? 0) === generation)
                persistedNodeIdsRef.current.add(targetAssistantId);
              await refreshChats(currentWorkspace.id);
            } catch (saveError) {
              if (
                (assistantGenerationRef.current.get(assistantKey) ?? 0) === generation &&
                currentWorkspaceIdRef.current === currentWorkspace.id &&
                activeChatIdRef.current === (isFirstMessageInNewChat ? targetUserId : activeChatId)
              ) {
                setUnsavedAssistant({
                  workspaceId: currentWorkspace.id,
                  id: targetAssistantId,
                  parentId: targetUserId,
                  content: assistantContent,
                  provider,
                  model,
                  responseState: result.responseState,
                  generation,
                });
                setLearningError(
                  saveError instanceof Error
                    ? `The response is visible but could not be saved: ${saveError.message}`
                    : "The response is visible but could not be saved. Retry saving this response.",
                );
              }
            }
          }
        }
      }
    },
    [
      currentWorkspace,
      activeChatId,
      activeTopicSessionId,
      roadmap.view,
      selectedActiveRoadmapTopicIds,
      tree,
      activeMessages,
      activeBranch,
      llmConfig,
      getEffectiveApiKey,
      getEffectiveBaseUrl,
      sendMessage,
      scrollToBottom,
      refreshChats,
      persistAssistantResponse,
      setUnsavedAssistant,
      router,
    ],
  );

  const handleResumeSavedRoot = useCallback(async () => {
    if (!currentWorkspace || !tree || !activeChatId || activeTopicSessionId) return;
    const root = tree.nodes[tree.rootNodeId];
    if (!root || tree.rootNodeId !== activeChatId || root.role !== "user") return;
    const roadmapTopicIds = Array.isArray(root.metadata?.roadmapTopicIds)
      ? root.metadata.roadmapTopicIds
          .filter((id): id is string => typeof id === "string" && activeRoadmapTopicIds.has(id))
          .slice(0, 3)
      : [];
    let assistantNodeId: string | null = null;
    let assistantGeneration: number | null = null;
    try {
      const result = await sendMessage(root.content, llmConfig.provider, llmConfig.model, {
        workspaceId: currentWorkspace.id,
        preparedUserMessageId: root.id,
        roadmapTopicIds,
        apiKey: getEffectiveApiKey(llmConfig.provider),
        baseUrl: getEffectiveBaseUrl(llmConfig.provider),
        temperature: llmConfig.temperature,
        maxTokens: llmConfig.maxTokens,
        systemPrompt: llmConfig.systemPrompt || undefined,
        onNodeCreated: async ({ assistantNodeId: createdId, preparedUserMessage }) => {
          if (!preparedUserMessage) throw new Error("The saved user message could not be reused.");
          // Invalidate a previously saved response before streaming its retry.
          assistantGeneration = invalidateAssistantPersistence(
            currentWorkspace.id,
            createdId,
          );
          assistantNodeId = createdId;
        },
      });
      if (result) {
        const responseId = result.assistantNodeId || assistantNodeId;
        if (responseId) {
          try {
            await persistAssistantResponse(currentWorkspace.id, {
              id: responseId,
              parentId: root.id,
              role: "assistant",
              content: result.content,
              provider: llmConfig.provider,
              model: llmConfig.model,
              metadata: { responseState: result.responseState },
            });
            const key = `${currentWorkspace.id}:${responseId}`;
            if (assistantGenerationRef.current.get(key) === assistantGeneration) {
              persistedNodeIdsRef.current.add(responseId);
              setUnsavedAssistant((current) =>
                current?.id === responseId && current.workspaceId === currentWorkspace.id
                  ? null
                  : current,
              );
            }
            await refreshChats(currentWorkspace.id);
          } catch (saveError) {
            const key = `${currentWorkspace.id}:${responseId}`;
            if (assistantGenerationRef.current.get(key) === assistantGeneration) {
              setUnsavedAssistant({
                workspaceId: currentWorkspace.id,
                id: responseId,
                parentId: root.id,
                content: result.content,
                provider: llmConfig.provider,
                model: llmConfig.model,
                responseState: result.responseState,
                generation: assistantGeneration ?? 0,
              });
              setLearningError(
                saveError instanceof Error
                  ? `The response is visible but could not be saved: ${saveError.message}`
                  : "The response is visible but could not be saved. Retry saving this response.",
              );
            }
          }
        }
      }
    } catch (failure) {
      if (
        currentWorkspaceIdRef.current === currentWorkspace.id &&
        activeChatIdRef.current === root.id
      )
        setLearningError(failure instanceof Error ? failure.message : "Could not resume this saved response.");
    }
  }, [
    currentWorkspace,
    tree,
    activeChatId,
    activeTopicSessionId,
    activeRoadmapTopicIds,
    sendMessage,
    llmConfig,
    getEffectiveApiKey,
    getEffectiveBaseUrl,
    invalidateAssistantPersistence,
    persistAssistantResponse,
    setUnsavedAssistant,
    refreshChats,
  ]);

  const handleRetryAssistantSave = useCallback(async () => {
    if (!unsavedAssistant) return;
    const assistantId = unsavedAssistant.id;
    const workspaceId = unsavedAssistant.workspaceId;
    const generationKey = `${workspaceId}:${assistantId}`;
    const generation =
      unsavedAssistant.generation ??
      assistantGenerationRef.current.get(generationKey) ??
      0;
    if ((assistantGenerationRef.current.get(generationKey) ?? 0) !== generation)
      return;
    try {
      await persistAssistantResponse(unsavedAssistant.workspaceId, {
        id: unsavedAssistant.id,
        parentId: unsavedAssistant.parentId,
        role: "assistant",
        content: unsavedAssistant.content,
        provider: unsavedAssistant.provider,
        model: unsavedAssistant.model,
        metadata: { responseState: unsavedAssistant.responseState },
      });
      if ((assistantGenerationRef.current.get(generationKey) ?? 0) === generation) {
        await refreshChats(workspaceId);
        const currentRecovery = unsavedAssistantRef.current;
        if (
          (assistantGenerationRef.current.get(generationKey) ?? 0) === generation &&
          currentRecovery?.id === assistantId &&
          currentRecovery.workspaceId === workspaceId &&
          (currentRecovery.generation ?? 0) === generation
        ) {
          persistedNodeIdsRef.current.add(assistantId);
          setUnsavedAssistant(null);
        }
      }
    } catch (failure) {
      if ((assistantGenerationRef.current.get(generationKey) ?? 0) === generation)
        setLearningError(
          failure instanceof Error
            ? `The response is still visible, but saving failed: ${failure.message}`
            : "The response is still visible, but saving failed.",
        );
    }
  }, [unsavedAssistant, persistAssistantResponse, refreshChats, setUnsavedAssistant]);

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
        router.replace(
          buildCanvasUrl(currentWorkspace.id, activeChatId, { node: nodeId }),
          { scroll: false },
        );
      } else {
        router.replace(
          buildBranchUrl(currentWorkspace.id, activeChatId, nodeId),
          { scroll: false },
        );
      }
    },
    [currentWorkspace, activeChatId, viewMode, router],
  );

  // Open / Push into Notion-style Side-Peek History Stack
  const handleOpenSidePeek = useCallback(
    (nodeId: string, excerpt?: string) => {
      lastProcessedBranchRef.current = nodeId;
      lastProcessedNodeRef.current = nodeId;
      setSidePeekState({ stack: [{ nodeId, excerpt }], index: 0 });
      syncSidePeekUrl(nodeId);
    },
    [syncSidePeekUrl],
  );

  const handlePushSidePeekBranch = useCallback(
    (nodeId: string, excerpt?: string) => {
      lastProcessedBranchRef.current = nodeId;
      lastProcessedNodeRef.current = nodeId;
      setSidePeekState((prev) => {
        const nextStack = [
          ...prev.stack.slice(0, prev.index + 1),
          { nodeId, excerpt },
        ];
        return { stack: nextStack, index: nextStack.length - 1 };
      });
      syncSidePeekUrl(nodeId);
    },
    [syncSidePeekUrl],
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
    [syncSidePeekUrl],
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
        { scroll: false },
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
        router.replace(
          buildNodeUrl(currentWorkspace.id, activeChatId, leafNodeId),
          { scroll: false },
        );
      }
      setTimeout(() => {
        handleJumpToMessage(leafNodeId);
      }, 100);
    },
    [
      switchBranch,
      viewMode,
      currentWorkspace,
      activeChatId,
      router,
      handleJumpToMessage,
    ],
  );

  // Send branch message and persist both user and assistant nodes to PostgreSQL
  const handleSendBranchStream = useCallback(
    async (
      prompt: string,
      parentNodeId: string,
      highlightedText = "",
      options?: {
        mode?: "open" | "push" | "replace_current" | "none";
        displayPrompt?: string;
      },
    ) => {
      if (!currentWorkspace) return;

      let createdUserNodeId: string | null = null;
      let createdAssistantNodeId: string | null = null;
      let createdAssistantGeneration: number | null = null;

      const provider = llmConfig.provider;
      const model = llmConfig.model;
      const sendOriginPath = routeRef.current;
      const sendOriginChatId = activeChatId;
      const effectiveApiKey = getEffectiveApiKey(provider);
      const effectiveBaseUrl = getEffectiveBaseUrl(provider);

      const result = await sendMessage(prompt, provider, model, {
        workspaceId: currentWorkspace.id,
        topicSessionId: activeTopicSessionId ?? undefined,
        roadmapTopicIds:
          roadmap.view && !activeTopicSessionId
            ? selectedActiveRoadmapTopicIds
            : undefined,
        branchOverride: { parentNodeId, highlightedText },
        preserveActiveNodeId: true,
        apiKey: effectiveApiKey,
        baseUrl: effectiveBaseUrl,
        temperature: llmConfig.temperature,
        maxTokens: llmConfig.maxTokens,
        systemPrompt: llmConfig.systemPrompt || undefined,
        onNodeCreated: async ({ userNodeId, assistantNodeId, preparedUserMessage }) => {
          createdUserNodeId = userNodeId;
          createdAssistantNodeId = assistantNodeId;
          createdAssistantGeneration =
            assistantGenerationRef.current.get(
              `${currentWorkspace.id}:${assistantNodeId}`,
            ) ?? 0;

          if (preparedUserMessage) return;

          if (!persistedNodeIdsRef.current.has(parentNodeId)) {
            throw new Error(
              "Save the visible response before branching so the conversation ancestry is complete.",
            );
          }

          await persistWorkspaceChatNode(currentWorkspace.id, {
            id: userNodeId,
            parentId: parentNodeId,
            role: "user",
            content: options?.displayPrompt || prompt.trim(),
            highlightedContext: highlightedText || null,
            provider,
            model,
          });
          persistedNodeIdsRef.current.add(userNodeId);
          if (
            currentWorkspaceIdRef.current !== currentWorkspace.id ||
            routeRef.current !== sendOriginPath ||
            activeChatIdRef.current !== sendOriginChatId
          ) {
            throw new Error("The conversation changed before the branch message could be sent.");
          }
          await refreshChats(currentWorkspace.id);

          if (options?.mode === "push") {
            handlePushSidePeekBranch(
              assistantNodeId,
              highlightedText || undefined,
            );
          } else if (options?.mode === "replace_current") {
            handleSwitchSidePeekSiblingTab(assistantNodeId);
          } else if (options?.mode === "none") {
            // in-branch follow-up: leave stack intact
          } else {
            handleOpenSidePeek(assistantNodeId, highlightedText || undefined);
          }

        },
      });

      const targetAssistantId =
        result?.assistantNodeId || createdAssistantNodeId;
      const targetUserId = result?.userNodeId || createdUserNodeId;
      const assistantContent = result?.content || "";

      // When streaming finishes, persist final assistant response node
      if (result && targetAssistantId && targetUserId) {
        const assistantKey = `${currentWorkspace.id}:${targetAssistantId}`;
        const generation =
          createdAssistantGeneration ??
          assistantGenerationRef.current.get(assistantKey) ??
          0;
        if ((assistantGenerationRef.current.get(assistantKey) ?? 0) === generation) {
          try {
            await persistAssistantResponse(currentWorkspace.id, {
              id: targetAssistantId,
              parentId: targetUserId,
              role: "assistant",
              content: assistantContent,
              provider,
              model,
              metadata: { responseState: result.responseState },
            });
            if ((assistantGenerationRef.current.get(assistantKey) ?? 0) === generation)
              persistedNodeIdsRef.current.add(targetAssistantId);
            await refreshChats(currentWorkspace.id);
          } catch (saveError) {
            if (
              (assistantGenerationRef.current.get(assistantKey) ?? 0) === generation &&
              currentWorkspaceIdRef.current === currentWorkspace.id &&
              activeChatIdRef.current === activeChatId
            ) {
              setUnsavedAssistant({
                workspaceId: currentWorkspace.id,
                id: targetAssistantId,
                parentId: targetUserId,
                content: assistantContent,
                provider,
                model,
                responseState: result.responseState,
                generation,
              });
              setLearningError(
                saveError instanceof Error
                  ? `The branch response is visible but could not be saved: ${saveError.message}`
                  : "The branch response is visible but could not be saved.",
              );
            }
          }
        }
      }
    },
    [
      currentWorkspace,
      roadmap.view,
      selectedActiveRoadmapTopicIds,
      activeChatId,
      activeTopicSessionId,
      handleOpenSidePeek,
      handlePushSidePeekBranch,
      handleSwitchSidePeekSiblingTab,
      llmConfig,
      getEffectiveApiKey,
      getEffectiveBaseUrl,
      persistAssistantResponse,
      setUnsavedAssistant,
      sendMessage,
      refreshChats,
    ],
  );

  // Handle "🌿 Explain this" action from text selection tooltip in Main Chat
  const handleExplainBranchFromMain = useCallback(
    async (parentNodeId: string, highlightedText: string) => {
      const branchPrompt = `Explain "${highlightedText}" in concise, direct detail with key takeaways.`;
      await handleSendBranchStream(
        branchPrompt,
        parentNodeId,
        highlightedText,
        {
          mode: "open",
        },
      );
    },
    [handleSendBranchStream],
  );

  const handleLearningAction = useCallback(
    async (parentNodeId: string, action: LearningActionId) => {
      await handleSendBranchStream(
        buildLearningActionPrompt(action),
        parentNodeId,
        `Learning mode: ${action.replace("_", " ")}`,
        {
          mode: "open",
          displayPrompt: getLearningActionDisplayPrompt(action),
        },
      );
    },
    [handleSendBranchStream],
  );

  const startInitialLesson = useCallback(async () => {
    if (
      !currentWorkspace ||
      !activeTopicSessionId ||
      !tree ||
      tree.rootNodeId !== activeChatId ||
      isStreaming
    )
      return;
    const startPath = pathname;
    setLearningError(null);
    await sendMessage(
      "Teach me this topic with a manageable first lesson.",
      llmConfig.provider,
      llmConfig.model,
      {
        workspaceId: currentWorkspace.id,
        topicSessionId: activeTopicSessionId,
        lessonStart: true,
        apiKey: getEffectiveApiKey(llmConfig.provider),
        baseUrl: getEffectiveBaseUrl(llmConfig.provider),
        temperature: llmConfig.temperature,
        maxTokens: llmConfig.maxTokens,
        enableRag: false,
      },
    );
    await refreshTopicSession();
    if (routeRef.current === startPath) {
      const snapshot = await fetchGraphSnapshot(
        currentWorkspace.id,
        tree.rootNodeId,
      );
      if (snapshot && routeRef.current === startPath) {
        const saved = snapshotToTree(snapshot);
        if (saved) {
          persistedNodeIdsRef.current = new Set(Object.keys(saved.nodes));
          loadTree(saved);
        }
      }
    }
  }, [
    currentWorkspace,
    activeTopicSessionId,
    tree,
    activeChatId,
    isStreaming,
    pathname,
    sendMessage,
    llmConfig,
    getEffectiveApiKey,
    getEffectiveBaseUrl,
    refreshTopicSession,
    loadTree,
  ]);
  useEffect(() => {
    if (
      topicSession.session?.lessonStartState !== "pending" ||
      !activeTopicSessionId ||
      !currentWorkspace ||
      isStreaming ||
      pathname !== buildChatUrl(currentWorkspace.id, activeChatId ?? "") ||
      attemptedLessons.current.has(activeTopicSessionId)
    )
      return;
    attemptedLessons.current.add(activeTopicSessionId);
    void startInitialLesson();
  }, [
    topicSession.session?.lessonStartState,
    activeTopicSessionId,
    currentWorkspace,
    isStreaming,
    pathname,
    activeChatId,
    startInitialLesson,
  ]);
  useEffect(() => {
    if (
      topicSession.session?.lessonStartState !== "completed" ||
      !tree ||
      isStreaming ||
      tree.nodes[`${tree.rootNodeId}_lesson`]?.content
    )
      return;
    const controller = new AbortController();
    const startPath = pathname;
    void fetchGraphSnapshot(currentWorkspace!.id, tree.rootNodeId).then(
      (snapshot) => {
        if (
          !controller.signal.aborted &&
          routeRef.current === startPath &&
          snapshot
        ) {
          const saved = snapshotToTree(snapshot);
          if (saved) {
            persistedNodeIdsRef.current = new Set(Object.keys(saved.nodes));
            loadTree(saved);
          }
        }
      },
    );
    return () => controller.abort();
  }, [
    topicSession.session?.lessonStartState,
    tree,
    isStreaming,
    pathname,
    currentWorkspace,
    loadTree,
  ]);
  const assessAnswer = async () => {
    if (!currentWorkspace || !topicSession.session || assessing) return;
    setAssessing(true);
    setLearningError(null);
    try {
      await recordTopicCheck(
        currentWorkspace.id,
        topicSession.session.topicId,
        topicSession.session.id,
      );
      await refreshTopicSession();
    } catch (error) {
      setLearningError(
        error instanceof Error
          ? error.message
          : "Could not assess the saved answer.",
      );
    } finally {
      setAssessing(false);
    }
  };
  const retryCurrentLesson = () => {
    if (
      activeTopicSessionId &&
      ["pending", "interrupted"].includes(
        topicSession.session?.lessonStartState ?? "",
      )
    )
      void startInitialLesson();
    else if (
      activeTopicSessionId &&
      topicSession.session?.lessonStartState === "started"
    )
      void topicSession.refresh();
    else retryLastMessage();
  };

  // Handle response rating (👍 / 👎) with real-time PostgreSQL persistence
  const handleRateResponse = useCallback(
    async (nodeId: string, rating: "up" | "down" | null) => {
      updateNodeMetadata(nodeId, { rating });
      if (currentWorkspace) {
        await updateWorkspaceNodeMetadata(currentWorkspace.id, nodeId, {
          rating,
        });
      }
    },
    [currentWorkspace, updateNodeMetadata],
  );

  // Track all branch points along the active lineage for breadcrumbs
  const activeLineage = useMemo(() => {
    if (!tree || !tree.activeNodeId) return [];
    return getAncestorPath(tree, tree.activeNodeId);
  }, [tree]);

  const breadcrumbSteps = useMemo(() => {
    const activeChat = chats.find((c) => c.id === activeChatId);
    const fallbackTitle = activeChat?.title || "New Chat";

    if (!tree || !tree.rootNodeId || !tree.nodes[tree.rootNodeId]) {
      return [
        {
          id: activeChatId || "new",
          leafId: activeChatId || "new",
          title: fallbackTitle,
          isRoot: true,
        },
      ];
    }
    const rootMessage = tree.nodes[tree.rootNodeId];
    const rawPrompt = rootMessage?.content || fallbackTitle;
    const rootMetadataTitle = tree.nodes[tree.rootNodeId]?.metadata?.title;
    const rootTitle =
      activeChat?.title ||
      (typeof rootMetadataTitle === "string" ? rootMetadataTitle : null) ||
      (rawPrompt.length > 24 ? rawPrompt.slice(0, 22) + "…" : rawPrompt);

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
  }, [tree, activeLineage, chats, activeChatId]);

  const handleEditUserMessage = useCallback(
    async (userNodeId: string, newContent: string) => {
      await editUserMessage(userNodeId, newContent);
      if (currentWorkspace) {
        await updateWorkspaceNodeContent(
          currentWorkspace.id,
          userNodeId,
          newContent,
        );
      }
    },
    [currentWorkspace, editUserMessage],
  );

  const handleSendNewSiblingBranch = useCallback(
    async (prompt: string, parentNodeId: string, highlightedText: string) => {
      await handleSendBranchStream(prompt, parentNodeId, highlightedText, {
        mode: "replace_current",
      });
    },
    [handleSendBranchStream],
  );

  // Switch to canvas node and open side peek
  const handleSelectTreeNode = useCallback(
    (nodeId: string) => {
      switchBranch(nodeId);
      handleOpenSidePeek(nodeId);
    },
    [switchBranch, handleOpenSidePeek],
  );

  // Transition smoothly from Canvas view to Chat view focusing on a specific node
  const handleSwitchToChat = useCallback(
    (nodeId: string) => {
      switchBranch(nodeId);
      setViewMode("chat");
      if (currentWorkspace && activeChatId) {
        router.push(buildNodeUrl(currentWorkspace.id, activeChatId, nodeId), {
          scroll: false,
        });
      }
      setTimeout(() => {
        handleJumpToMessage(nodeId);
      }, 100);
    },
    [switchBranch, handleJumpToMessage, currentWorkspace, activeChatId, router],
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
          const prevIndex =
            (currentIndex - 1 + siblings.length) % siblings.length;
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
    } else if (isPaletteOpen) {
      setIsPaletteOpen(false);
    } else if (activeBranch) {
      clearBranchContext();
    }
  }, [
    isSidePeekOpen,
    handleCloseSidePeek,
    isPaletteOpen,
    activeBranch,
    clearBranchContext,
  ]);

  useKeyboardShortcuts({
    onPrevBranch: handlePrevBranch,
    onNextBranch: handleNextBranch,
    onJumpToRoot: handleJumpToRoot,
    onEscape: handleEscape,
    onFitView: () => fitViewRef.current?.(),
    onCenterActive: () => centerActiveRef.current?.(),
    onAutoLayout: () => autoLayoutRef.current?.(),
    onCommandPalette: roadmapMode
      ? undefined
      : () => setIsPaletteOpen((prev) => !prev),
    onToggleSidebar: () => setIsSidebarOpen((prev) => !prev),
    onNewChat: roadmap.view && !roadmap.view.canWrite ? undefined : handleRequestNewChat,
    onOpenSettings: handleOpenSettings,
  });

  const starterPrompts = [
    {
      title: "Explain LangGraph & State Machines",
      subtitle: "How cyclical graph workflows differ from DAGs in AI systems",
      icon: GitBranch,
      prompt:
        "Explain how LangGraph state machines manage cyclical multi-agent workflows and how they differ from linear DAG execution.",
    },
    {
      title: "Raft vs Paxos Consensus",
      subtitle: "Leader election, log replication, and split-brain safety",
      icon: GitBranch,
      prompt:
        "Compare Raft vs Paxos consensus mechanisms in distributed systems. Focus on leader election and split-brain mitigation.",
    },
    {
      title: "Database Vector Indexing (HNSW vs IVFFlat)",
      subtitle: "Trade-offs in approximate nearest neighbor search",
      icon: GitBranch,
      prompt:
        "Break down the architectural trade-offs between HNSW and IVFFlat vector indexing for pgvector semantic search.",
    },
  ];
  const rootForResume =
    tree && tree.rootNodeId === activeChatId ? tree.nodes[tree.rootNodeId] : null;
  const rootHasCompletedResponse = Boolean(
    rootForResume?.childrenIds.some((id) => {
      const child = tree?.nodes[id];
      return child?.role === "assistant" && child.metadata?.responseState === "completed";
    }),
  );
  const rootHasRetryableResponse = Boolean(
    rootForResume?.childrenIds.some((id) => {
      const child = tree?.nodes[id];
      return (
        child?.role === "assistant" &&
        isRetryableAssistantResponse(
          child.content,
          child.metadata?.responseState,
        ) &&
        child.childrenIds.length === 0
      );
    }),
  );
  const canResumeSavedRoot = Boolean(
    !activeTopicSessionId &&
      rootForResume?.role === "user" &&
      rootForResume.content.trim() &&
      !rootHasCompletedResponse &&
      (!rootForResume.childrenIds.length || rootHasRetryableResponse) &&
      !isStreaming,
  );

  return (
    <>
      <WorkspaceShell
        navigation={
          <ChatSidebar
            isOpen={isSidebarOpen}
            onToggle={() => setIsSidebarOpen((prev) => !prev)}
            workspaceName={currentWorkspace?.name || "Main Workspace"}
            chats={chats.filter(
              (chat) => chat.id !== roadmap.view?.canvasAnchorChatId,
            )}
            activeChatId={activeChatId}
            isLibraryActive={viewMode === "library"}
            onSelectChat={handleSelectChat}
            onDeleteChat={handleDeleteChat}
            onRenameChat={handleRenameChat}
            onTogglePinChat={handleTogglePinChat}
            onOpenSettings={handleOpenSettings}
            onNewChat={roadmap.view && !roadmap.view.canWrite ? undefined : handleRequestNewChat}
            onOpenRoadmap={roadmap.view ? handleOpenRoadmap : undefined}
            isRoadmapActive={roadmapMode === "page"}
            onOpenFileLibrary={() => {
              if (currentWorkspace) {
                router.push(buildLibraryUrl(currentWorkspace.id));
              }
            }}
          />
        }
        header={
          roadmapMode && roadmap.view ? (
            <RoadmapHeader
              view={roadmap.view}
              mode={roadmapMode}
              onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
            />
          ) : viewMode === "library" ? (
            <LibraryHeader
              isSidebarOpen={isSidebarOpen}
              onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
            />
          ) : viewMode === "settings" ? (
            <SettingsHeader
              isSidebarOpen={isSidebarOpen}
              onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
            />
          ) : (
            <ChatHeader
              viewMode={viewMode}
              onViewModeChange={(mode) => {
                setViewMode(mode);
                if (currentWorkspace) {
                  if (mode === "canvas") {
                    router.push(
                      activeChatId
                        ? buildCanvasUrl(currentWorkspace.id, activeChatId)
                        : buildWorkspaceUrl(currentWorkspace.id),
                    );
                  } else if (mode === "chat") {
                    router.push(
                      activeChatId
                        ? buildChatUrl(currentWorkspace.id, activeChatId)
                        : buildWorkspaceUrl(currentWorkspace.id),
                    );
                  } else if (mode === "library") {
                    router.push(buildLibraryUrl(currentWorkspace.id));
                  }
                }
              }}
              syncStatus={syncStatus}
              workspaceName={currentWorkspace?.name || "Main Workspace"}
              onOpenModelConfig={handleOpenSettings}
              onOpenFileLibrary={() => {
                if (currentWorkspace) {
                  router.push(buildLibraryUrl(currentWorkspace.id));
                }
              }}
              activeModelName={llmConfig.model}
              messageCount={activeMessages.length}
              isSidebarOpen={isSidebarOpen}
              onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
              isRightSidebarOpen={isRightSidebarOpen}
              onToggleRightSidebar={
                activeTopicSessionId ? undefined : handleToggleRightSidebar
              }
              onNewChat={roadmap.view && !roadmap.view.canWrite ? undefined : handleRequestNewChat}
              onClearChat={() => {
                clearMessages();
                handleCloseSidePeek();
              }}
              breadcrumbs={
                <div className="flex min-w-0 items-center gap-2">
                  <BranchBreadcrumbs
                    steps={breadcrumbSteps}
                    suffix={viewMode === "canvas" ? "Canvas" : undefined}
                    onSelectStep={(step) => {
                      lastProcessedBranchRef.current = null;
                      lastProcessedNodeRef.current = null;
                      switchBranch(step.leafId);
                      setSidePeekState({ stack: [], index: 0 });
                      if (currentWorkspace && activeChatId) {
                        router.push(buildChatUrl(currentWorkspace.id, activeChatId), {
                          scroll: false,
                        });
                      }
                    }}
                  />
                  {roadmap.view?.canWrite &&
                    activeChatId &&
                    !activeTopicSessionId &&
                    tree?.rootNodeId === activeChatId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() => setIsRoadmapContextOpen(true)}
                        aria-label="Choose roadmap topics for this conversation"
                      >
                        <ListFilter className="mr-1.5 size-4" />
                        Topic context
                        {selectedRoadmapTopicIds.length > 0 && (
                          <span className="ml-1 text-xs text-foreground-muted">
                            {selectedRoadmapTopicIds.length}/3
                          </span>
                        )}
                      </Button>
                    )}
                </div>
              }
            />
          )
        }
        rail={
          activeTopicSessionId ||
          roadmapMode ||
          waitingForRoadmap ||
          viewMode === "settings" ? undefined : (
            <RightSidebar
              isOpen={isRightSidebarOpen}
              onToggle={handleToggleRightSidebar}
            />
          )
        }
      >
        {waitingForRoadmap ? (
          <div
            className="flex h-full flex-col items-center justify-center gap-3 bg-background p-6 text-sm text-foreground-muted"
            role={roadmap.error ? "alert" : "status"}
          >
            {roadmap.error ? roadmap.error.message : "Loading roadmap…"}
            {roadmap.error && (
              <Button
                variant="secondary"
                onClick={() => void roadmap.refresh()}
              >
                Retry
              </Button>
            )}
          </div>
        ) : roadmapMode && roadmap.view ? (
          <>
            <RoadmapWorkspace
              key={roadmap.view.roadmapId}
              view={roadmap.view}
              mode={roadmapMode}
              onOpenTopic={setSelectedTopicId}
              onStartTopic={startTopic}
              opening={openingTopic}
              actionError={learningError}
              onSaved={roadmap.updateView}
              onReload={roadmap.refresh}
            />
            <TopicBriefDrawer
              view={roadmap.view}
              topicId={selectedTopicId}
              onClose={() => setSelectedTopicId(null)}
              onProgress={roadmap.updateProgress}
              onSaved={roadmap.updateView}
              onReload={roadmap.refresh}
            />
          </>
        ) : viewMode === "settings" ? (
          <SettingsPage
            config={llmConfig}
            onSaveConfig={updateLLMConfig}
            onResetDefaults={resetLLMDefaults}
            currentWorkspace={currentWorkspace}
            onNavigateBack={() => {
              if (currentWorkspace && activeChatId) {
                router.push(buildChatUrl(currentWorkspace.id, activeChatId));
              } else if (currentWorkspace) {
                router.push(buildWorkspaceUrl(currentWorkspace.id));
              }
            }}
          />
        ) : viewMode === "library" ? (
          /* Full-Page File Library & Knowledge Assets View */
          <FileLibraryView
            workspaceId={currentWorkspace?.id || ""}
            onBack={() => {
              if (currentWorkspace && activeChatId) {
                router.push(buildChatUrl(currentWorkspace.id, activeChatId));
              } else if (currentWorkspace) {
                router.push(buildWorkspaceUrl(currentWorkspace.id));
              }
            }}
          />
        ) : viewMode === "canvas" ? (
          /* 2D Spatial Mind Map & Knowledge Graph Canvas View */
          <div className="w-full h-full relative">
            <GraphCanvas
              key={`${currentWorkspace?.id}:${activeChatId}`}
              tree={tree}
              workspaceId={currentWorkspace?.id}
              chatId={activeChatId ?? undefined}
              loading={isLoadingChat}
              isStreaming={isStreaming}
              onSelectNode={handleSelectTreeNode}
              onDeleteBranch={(nodeId) =>
                currentWorkspace && deleteBranch(nodeId, currentWorkspace.id)
              }
              onExploreBranch={(nodeId, text) => {
                handleOpenSidePeek(nodeId, text || undefined);
              }}
              onSwitchToChat={handleSwitchToChat}
              onRetry={retryCurrentLesson}
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
            {topicSession.session && currentWorkspace && (
              <TutorLearningBar
                workspaceId={currentWorkspace.id}
                session={topicSession.session}
                onResume={() => void startInitialLesson()}
                onAsk={() =>
                  tree && void handleLearningAction(tree.activeNodeId, "quiz")
                }
                onAssess={() => void assessAnswer()}
                onProgress={(progress) => {
                  topicSession.updateProgress(progress);
                  roadmap.updateProgress(progress);
                }}
                busy={isStreaming || assessing}
                error={learningError ?? topicSession.error}
              />
            )}
            <main
              ref={scrollRef}
              className="flex-1 overflow-y-auto min-h-0 flex flex-col bg-background"
            >
              <div
                data-testid="chat-content-column"
                className="w-full flex-1 flex flex-col max-w-[var(--chat-content-max)] mx-auto px-4"
              >
                {isLoadingChat ? (
                  /* Loading Skeleton — shows instantly while the chat tree is fetched */
                  <div
                    role="status"
                    aria-label="Loading conversation"
                    className="w-full max-w-2xl mx-auto py-8 space-y-6"
                  >
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className={
                          i % 2 === 1
                            ? "flex flex-row-reverse gap-3"
                            : "flex gap-3"
                        }
                      >
                        <Skeleton
                          label=""
                          aria-hidden="true"
                          className="size-8 shrink-0 rounded-full"
                        />
                        <div className="flex-1 space-y-2 pt-1">
                          <Skeleton
                            label=""
                            aria-hidden="true"
                            className="h-3.5 w-2/5 rounded-lg"
                          />
                          <Skeleton
                            label=""
                            aria-hidden="true"
                            className="h-3.5 w-full rounded-lg"
                          />
                          <Skeleton
                            label=""
                            aria-hidden="true"
                            className="h-3.5 w-4/5 rounded-lg"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : activeMessages.length === 0 ? (
                  /* Clean Empty State */
                  <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto px-4 py-8 text-center space-y-8 my-auto">
                    <div className="space-y-3">
                      <LogoBadge size="lg" className="mx-auto" />
                      <h2 className="font-display text-xl font-normal text-foreground sm:text-display-sm">
                        {currentWorkspace?.name || "Where knowledge connects"}
                      </h2>
                      <p className="text-sm text-foreground-subtle max-w-md mx-auto leading-relaxed">
                        Ask a technical question, explore system architecture,
                        or create new branches in this workspace.
                      </p>
                    </div>

                    {/* Quick Starter Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full text-left">
                      {starterPrompts.map((item, index) => {
                        const Icon = item.icon;
                        return (
                          <Button
                            key={index}
                            variant="outline"
                            onClick={() => {
                              handleSendMessage(item.prompt);
                            }}
                            className="h-auto p-3 rounded-xl border border-border-subtle bg-surface hover:bg-surface-hover text-left whitespace-normal transition-colors group cursor-pointer shadow-none flex flex-col items-start justify-start"
                          >
                            <div className="w-6 h-6 rounded-md bg-background-secondary shadow-xs flex items-center justify-center mb-2 text-foreground-muted group-hover:text-foreground transition-colors">
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <h3 className="text-sm font-medium text-foreground mb-1 leading-snug">
                              {item.title}
                            </h3>
                            <p className="text-xs text-foreground-muted line-clamp-2 leading-relaxed font-normal">
                              {item.subtitle}
                            </p>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Active Lineage Message Stream */
                  <div className="w-full pb-4">
                    {canResumeSavedRoot && (
                      <div className="mx-auto mt-5 w-full max-w-2xl rounded-xl border border-border-subtle bg-background-secondary p-3">
                        <p className="text-sm text-foreground-muted">
                          This saved conversation has no completed response yet.
                        </p>
                        <Button
                          className="mt-2"
                          size="sm"
                          onClick={() => void handleResumeSavedRoot()}
                        >
                          Resume response
                        </Button>
                      </div>
                    )}
                    {(() => {
                      const lastUserIndex = activeMessages
                        .map((m) => m.role)
                        .lastIndexOf("user");
                      const lastAssistantIndex = activeMessages
                        .map((m) => m.role)
                        .lastIndexOf("assistant");

                      return activeMessages.map((node, index) => {
                        const isLastAssistant =
                          index === activeMessages.length - 1 &&
                          node.role === "assistant" &&
                          isStreaming &&
                          streamingNodeId === node.id;

                        return (
                          <ChatMessage
                            key={node.id}
                            workspaceId={currentWorkspace?.id}
                            flashcardGenerationConfig={
                              flashcardGenerationConfig
                            }
                            message={{
                              ...node,
                              isStreaming: isLastAssistant,
                            }}
                            tree={tree}
                            isLastUserMessage={index === lastUserIndex}
                            isLastAssistantMessage={
                              index === lastAssistantIndex
                            }
                            onRetry={retryCurrentLesson}
                            onRegenerate={regenerateResponse}
                            onEditUserMessage={handleEditUserMessage}
                            onSwitchBranch={switchBranch}
                            onExploreBranch={handleExplainBranchFromMain}
                            onLearningAction={handleLearningAction}
                            onOpenSideBranch={(leafId, excerpt) =>
                              handleOpenSidePeek(leafId, excerpt)
                            }
                            onRateResponse={handleRateResponse}
                          />
                        );
                      });
                    })()}
                    <div ref={bottomRef} />
                  </div>
                )}

                {error && (
                  <div className="pb-4 pt-1">
                    <InlineFeedback
                      tone="destructive"
                      title="Stream error"
                      action={
                        <div className="flex items-center gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={retryCurrentLesson}
                          >
                            Retry
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearError}
                          >
                            Dismiss
                          </Button>
                        </div>
                      }
                    >
                      {error}
                    </InlineFeedback>
                  </div>
                )}
              </div>
            </main>

            {/* Chat Input Bar */}
            <div
              data-testid="chat-composer-shell"
              className="relative shrink-0 bg-gradient-to-t from-background via-background to-transparent pt-2 z-20"
            >
              {showScrollButton && activeMessages.length > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => scrollToBottom(true)}
                  className="absolute -top-9 left-1/2 -translate-x-1/2 shadow-md gap-1.5 animate-in fade-in-50 slide-in-from-bottom-2 duration-150 motion-reduce:animate-none"
                >
                  <span>Scroll to bottom</span>
                  <ArrowDown className="w-3 h-3" />
                </Button>
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
          workspaceId={currentWorkspace?.id}
          flashcardGenerationConfig={flashcardGenerationConfig}
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
          onDeleteBranch={(nodeId) =>
            currentWorkspace && deleteBranch(nodeId, currentWorkspace.id)
          }
          onRenameBranch={handleRenameBranch}
          onTogglePinBranch={handleTogglePinBranch}
          onExploreBranch={(parentNodeId, highlightedText) => {
            handleSendBranchStream(
              `Explain "${highlightedText}" in concise, direct detail with key takeaways.`,
              parentNodeId,
              highlightedText,
              { mode: "push" },
            );
          }}
          onRegenerate={regenerateResponse}
          onEditUserMessage={handleEditUserMessage}
          onSwitchBranch={switchBranch}
          onRateResponse={handleRateResponse}
          onPromoteToRoadmap={handleRequestPromotion}
          isPromotableNode={isPromotableBranchNode}
        />
      </WorkspaceShell>

      {currentWorkspace && roadmap.view?.canWrite && (
        <NewWorkspaceChatModal
          isOpen={isNewWorkspaceChatOpen && Boolean(roadmap.view)}
          workspaceId={currentWorkspace.id}
          provider={llmConfig.provider}
          model={llmConfig.model}
          roadmapTopics={activeRoadmapTopics.map(({ id, title, brief }) => ({ id, title, brief }))}
          isWorkspaceCurrent={(workspaceId) =>
            currentWorkspaceIdRef.current === workspaceId &&
            routeRef.current === newChatOriginRouteRef.current
          }
          onClose={() => setIsNewWorkspaceChatOpen(false)}
          onCreated={handleCreatedWorkspaceChat}
        />
      )}

      {roadmap.view?.canWrite && (
        <Modal
          isOpen={isRoadmapContextOpen}
          onClose={() => setIsRoadmapContextOpen(false)}
          size="lg"
          ariaLabel="Choose roadmap topics for this conversation"
        >
          <ModalHeader
            title="Topic context"
            description="Choose up to three roadmap topics to ground this general conversation."
            icon={<ListFilter className="size-4" />}
            onClose={() => setIsRoadmapContextOpen(false)}
          />
          <ModalBody className="space-y-4">
            {selectedRoadmapTopicIds.some(
              (id) => !activeRoadmapTopics.some((topic) => topic.id === id),
            ) && (
              <section className="space-y-2 rounded-xl border border-border-subtle bg-background-secondary p-3">
                <h3 className="text-sm font-medium">Previously selected topics</h3>
                <p className="text-xs text-foreground-muted">
                  Archived or removed topics are excluded from chat context. Remove them here.
                </p>
                {selectedRoadmapTopicIds
                  .filter((id) => !activeRoadmapTopics.some((topic) => topic.id === id))
                  .map((id) => {
                    const oldTopic = roadmap.view?.candidate.items.find((item) => item.id === id);
                    return (
                      <label key={id} className="flex items-center gap-3 rounded-lg px-2 py-1 text-sm">
                        <Input
                          type="checkbox"
                          className="size-4 w-4 accent-primary"
                          checked
                          disabled={isSavingRoadmapContext}
                          onChange={() => void handleRoadmapTopicSelection(id, false)}
                          aria-label={`Remove ${oldTopic?.title ?? "unavailable topic"} from context`}
                        />
                        <span className="min-w-0 truncate text-foreground-muted">
                          {oldTopic?.title ?? "Unavailable topic"} · excluded
                        </span>
                      </label>
                    );
                  })}
              </section>
            )}
            <div className="max-h-[50vh] space-y-1 overflow-y-auto">
              {activeRoadmapTopics.map((topic) => {
                const checked = selectedRoadmapTopicIds.includes(topic.id);
                const atLimit = selectedRoadmapTopicIds.length >= 3 && !checked;
                return (
                  <label
                    key={topic.id}
                    className="flex items-start gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-surface-hover"
                  >
                    <Input
                      type="checkbox"
                      className="mt-0.5 size-4 w-4 accent-primary"
                      checked={checked}
                      disabled={isSavingRoadmapContext || atLimit}
                      onChange={(event) =>
                        void handleRoadmapTopicSelection(topic.id, event.target.checked)
                      }
                      aria-label={`Include ${topic.title} in conversation context`}
                    />
                    <span className="min-w-0">
                      <span className="block font-medium text-foreground">{topic.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-foreground-muted">
                        {topic.brief}
                      </span>
                    </span>
                  </label>
                );
              })}
              {activeRoadmapTopics.length === 0 && (
                <p className="py-4 text-center text-sm text-foreground-muted">
                  No active roadmap topics are available.
                </p>
              )}
            </div>
            {roadmapContextError && (
              <p role="alert" className="text-sm text-destructive">{roadmapContextError}</p>
            )}
            {isSavingRoadmapContext && (
              <p role="status" className="text-xs text-foreground-muted">Saving context…</p>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              variant="secondary"
              disabled={isSavingRoadmapContext}
              onClick={() => setIsRoadmapContextOpen(false)}
            >
              Done
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {roadmap.view?.canWrite && promotionSource && (
        <BranchPromotionModal
          view={roadmap.view}
          sourceChatId={promotionSource.chatId}
          sourceNodeId={promotionSource.nodeId}
          sourceTitle={promotionSource.title}
          sourceExcerpt={promotionSource.excerpt}
          isOpen={isPromotionOpen}
          resumeJobId={promotionJobId}
          onClose={() => setIsPromotionOpen(false)}
          onSaved={(next) => {
            roadmap.updateView(next);
            setPromotionJobId(null);
            setIsPromotionOpen(false);
          }}
          onRoadmapRefreshed={(next) => roadmap.updateView(next)}
          onJobAccepted={(jobId, chatId, nodeId) => {
            setPromotionJobsBySource((jobs) => ({ ...jobs, [`${chatId}:${nodeId}`]: jobId }));
            if (promotionSource?.chatId === chatId && promotionSource.nodeId === nodeId)
              setPromotionJobId(jobId);
          }}
        />
      )}

      {/* Global Command Palette (⌘K) */}
      {!roadmapMode && (
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
              const url =
                nextMode === "canvas"
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
      )}

      {/* Non-intrusive Floating Toast Notification */}
      {unsavedAssistant && (
        <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-xl">
          <InlineFeedback
            tone="warning"
            title="Response save failed"
            action={
              <Button size="sm" onClick={() => void handleRetryAssistantSave()}>
                Retry save
              </Button>
            }
          >Retry saving the visible response so it can be resumed and promoted.</InlineFeedback>
        </div>
      )}
      <Toast message={error} onDismiss={clearError} />
    </>
  );
}
