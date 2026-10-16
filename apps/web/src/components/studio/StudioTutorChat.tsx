"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  AlertCircle,
  ArrowUp,
  Bot,
  Copy,
  Check,
  CornerDownRight,
  FileText,
  GitBranch,
  Loader2,
  Quote,
  RotateCw,
  Sparkles,
  Square,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalBody, ModalHeader } from "@/components/ui/modal";
import { BranchBreadcrumbs } from "@/components/chat/BranchBreadcrumbs";
import { MarkdownRenderer } from "@/components/chat/ChatMessage";
import { AgentToolCallsBanner } from "@/components/chat/AgentToolCallsBanner";
import { PdfViewerModal } from "@/components/chat/PdfViewerModal";
import {
  RagSourcesStrip,
  type RagSourceItem,
} from "@/components/chat/RagSourcesStrip";
import {
  isRetryableAssistantResponse,
  useChatStream,
  type ToolCallItem,
} from "@/hooks/useChatStream";
import { useModelConfig } from "@/hooks/useModelConfig";
import { usePreferences } from "@/context/PreferencesContext";
import { TUTOR_STYLE_DIRECTIVES } from "@/lib/preferencesApi";
import {
  fetchGraphSnapshot,
  resolveFileUrl,
  snapshotToTree,
} from "@/lib/workspaceApi";
import { safeGetItem, safeSetItem, safeRemoveItem } from "@/lib/storage";
import { cn } from "@/lib/utils";
import type { TopicSessionData } from "@/lib/roadmapTypes";
import {
  isNodeOnBranch,
  reconstructBranchBreadcrumbs,
  getSiblingBranchTabs,
  getActiveBranchRoot,
} from "@/lib/branchUtils";
import { getAncestorPath } from "@graphmind/shared";

export interface StudioTutorChatProps {
  workspaceId: string;
  topicId: string;
  topicTitle?: string;
  topicSessionId?: string | null;
  activeSession?: TopicSessionData | null;
  quotedPassage?: string | null;
  initialBranchId?: string | null;
  initialNodeId?: string | null;
  activeBranchLeafId?: string | null;
  onBranchChange?: (leafId: string | null) => void;
  onClearQuote?: () => void;
  onStartSession?: () => void;
  className?: string;
}

export function StudioTutorChat({
  workspaceId,
  topicId,
  topicTitle = "Current Topic",
  topicSessionId,
  activeSession,
  quotedPassage,
  initialBranchId,
  initialNodeId,
  activeBranchLeafId,
  onBranchChange,
  onClearQuote,
  onStartSession: _onStartSession,
  className,
}: StudioTutorChatProps) {
  const currentSessionId = activeSession?.id ?? topicSessionId ?? null;
  const currentChatId = activeSession?.chatId ?? null;

  const {
    config: llmConfig,
    getEffectiveApiKey,
    getEffectiveBaseUrl,
  } = useModelConfig();

  // Persisted tutor-style preference shapes the tutor's instructions (LSI-044).
  const { preferences: learnerPreferences } = usePreferences();
  const tutorStyleDirective =
    TUTOR_STYLE_DIRECTIVES[learnerPreferences.tutorStyle];

  const {
    tree,
    activeMessages,
    isStreaming,
    streamingNodeId,
    error: streamError,
    clearError,
    sendMessage,
    retryLastMessage,
    stopStreaming,
    clearMessages,
    loadTree,
    switchBranch,
  } = useChatStream();

  const [input, setInput] = useState("");
  const [copiedNodeId, setCopiedNodeId] = useState<string | null>(null);
  const [activeBranchState, setActiveBranchState] = useState<{
    parentNodeId: string;
    quote: string;
  } | null>(null);
  const [selectedOrigin, setSelectedOrigin] = useState<{
    messageId: string;
    quote: string;
  } | null>(null);
  const [viewingRagPdf, setViewingRagPdf] = useState<{
    filename: string;
    fileId: string;
    page?: number;
  } | null>(null);
  const [viewingRagSnippet, setViewingRagSnippet] =
    useState<RagSourceItem | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scope tracking for late-output and race protection
  const activeScopeRef = useRef<string>("");
  const draftStorageKey = `graphmind_studio_tutor_draft_${workspaceId}_${currentSessionId || topicId}`;

  // Restore draft on mount or scope switch
  useEffect(() => {
    const savedDraft = safeGetItem(draftStorageKey) || "";
    setInput(savedDraft);
  }, [draftStorageKey]);

  // Save draft on change
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    if (val.trim()) {
      safeSetItem(draftStorageKey, val);
    } else {
      safeRemoveItem(draftStorageKey);
    }
  };

  // Lifecycle & Session Switching with Late-Output Protection
  useEffect(() => {
    const newScope = `${workspaceId}:${currentSessionId || topicId}`;
    activeScopeRef.current = newScope;

    // Immediately stop any active stream if topic or session switched
    stopStreaming();
    clearError();
    setActiveBranchState(null);
    setSelectedOrigin(null);

    let cancelled = false;

    if (currentChatId) {
      void fetchGraphSnapshot(workspaceId, currentChatId).then((snapshot) => {
        if (cancelled || activeScopeRef.current !== newScope) return;
        if (snapshot) {
          const loaded = snapshotToTree(snapshot);
          if (loaded) {
            loadTree(loaded);
            return;
          }
        }
        clearMessages();
      });
    } else {
      clearMessages();
    }

    return () => {
      cancelled = true;
      stopStreaming();
    };
  }, [
    workspaceId,
    currentSessionId,
    currentChatId,
    topicId,
    clearError,
    clearMessages,
    loadTree,
    stopStreaming,
  ]);

  // Initial branch or deep-linked node ancestry reconstruction
  const lastTargetNodeRef = useRef<string | null>(null);
  useEffect(() => {
    const targetId = activeBranchLeafId ?? initialBranchId ?? initialNodeId;
    if (tree && targetId && tree.nodes[targetId] && lastTargetNodeRef.current !== targetId) {
      lastTargetNodeRef.current = targetId;
      switchBranch(targetId);
    }
  }, [tree, initialBranchId, initialNodeId, activeBranchLeafId, switchBranch]);

  // Auto-scroll on new tokens or messages
  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeMessages.length, isStreaming]);

  // Derive lineage, breadcrumbs, and sibling tabs
  const activeNodeId = tree?.activeNodeId || null;
  const onBranch = isNodeOnBranch(tree, activeNodeId);

  const breadcrumbSteps = useMemo(() => {
    return reconstructBranchBreadcrumbs(tree, activeNodeId, topicTitle);
  }, [tree, activeNodeId, topicTitle]);

  const siblingTabs = useMemo(() => {
    return getSiblingBranchTabs(tree, activeNodeId);
  }, [tree, activeNodeId]);

  const activeBranchRoot = useMemo(() => {
    if (!tree || !activeNodeId) return null;
    const lineage = getAncestorPath(tree, activeNodeId);
    return getActiveBranchRoot(lineage);
  }, [tree, activeNodeId]);

  // Handle branching initiation from message
  const handleBranchFromMessage = (messageId: string) => {
    const msg = tree?.nodes[messageId] || activeMessages.find((m) => m.id === messageId);
    if (!msg) return;

    let quote = "";
    if (selectedOrigin && selectedOrigin.messageId === messageId && selectedOrigin.quote) {
      quote = selectedOrigin.quote;
    } else {
      quote = msg.content.slice(0, 500);
    }

    setActiveBranchState({ parentNodeId: messageId, quote });
    textareaRef.current?.focus();
  };

  // Submit message (mainline or branch continuation)
  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || isStreaming) return;

    const branchQuote = activeBranchState?.quote || quotedPassage;
    const branchParent = activeBranchState?.parentNodeId || tree?.activeNodeId || "";

    const fullMessage = branchQuote && !activeBranchState
      ? `> "${branchQuote}"\n\n${content}`
      : content;

    setInput("");
    safeRemoveItem(draftStorageKey);
    onClearQuote?.();
    setActiveBranchState(null);
    setSelectedOrigin(null);

    try {
      await sendMessage(fullMessage, llmConfig.provider, llmConfig.model, {
        workspaceId,
        topicSessionId: currentSessionId ?? undefined,
        // Honor the learner's browser-local provider selection: the BYOK key,
        // custom base URL, and generation parameters chosen in Settings apply
        // to the tutor exactly as they do to the main conversation.
        apiKey: getEffectiveApiKey(llmConfig.provider),
        baseUrl: getEffectiveBaseUrl(llmConfig.provider),
        temperature: llmConfig.temperature,
        maxTokens: llmConfig.maxTokens,
        branchOverride: branchQuote
          ? {
              parentNodeId: branchParent,
              highlightedText: branchQuote,
            }
          : null,
        systemPrompt: `You are the AI Tutor companion for GraphMind Learning Studio. The learner is studying "${topicTitle}". ${tutorStyleDirective} Explain concepts clearly, give concrete examples, resolve questions, and reinforce foundational learning.`,
        onNodeCreated: (nodes) => {
          if (branchQuote && nodes.assistantNodeId) {
            onBranchChange?.(nodes.assistantNodeId);
          }
        },
      });
    } catch {
      // Stream error is captured by useChatStream
    }
  }, [
    input,
    isStreaming,
    activeBranchState,
    quotedPassage,
    draftStorageKey,
    onClearQuote,
    sendMessage,
    llmConfig.provider,
    llmConfig.model,
    llmConfig.temperature,
    llmConfig.maxTokens,
    getEffectiveApiKey,
    getEffectiveBaseUrl,
    workspaceId,
    currentSessionId,
    tree?.activeNodeId,
    topicTitle,
    onBranchChange,
    tutorStyleDirective,
  ]);

  // Retry last assistant message
  const handleRetry = useCallback(() => {
    if (isStreaming) return;
    clearError();
    retryLastMessage();
  }, [isStreaming, clearError, retryLastMessage]);

  // Stop generation
  const handleStop = useCallback(() => {
    stopStreaming();
  }, [stopStreaming]);

  // Handle keyboard shortcut: Enter to send (Shift+Enter for newline)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleCopy = (nodeId: string, content: string) => {
    void navigator.clipboard.writeText(content);
    setCopiedNodeId(nodeId);
    setTimeout(() => setCopiedNodeId(null), 2000);
  };

  const handleSelectRagSource = (source: RagSourceItem) => {
    if (source.filename.toLowerCase().endsWith(".pdf")) {
      setViewingRagPdf({
        filename: source.filename,
        fileId: source.file_id,
        page: source.page_number,
      });
    } else {
      setViewingRagSnippet(source);
    }
  };

  const handleSelectBreadcrumbStep = useCallback(
    (step: { leafId: string; isRoot?: boolean }) => {
      switchBranch(step.leafId);
      onBranchChange?.(step.isRoot ? null : step.leafId);
    },
    [switchBranch, onBranchChange]
  );

  const handleReturnToMain = useCallback(() => {
    if (tree?.rootNodeId) {
      switchBranch(tree.rootNodeId);
      onBranchChange?.(null);
    }
  }, [tree, switchBranch, onBranchChange]);

  const handleSelectSibling = useCallback(
    (leafId: string) => {
      switchBranch(leafId);
      onBranchChange?.(leafId);
    },
    [switchBranch, onBranchChange]
  );

  // Determine if the last message is a retryable assistant message
  const lastMessage = activeMessages[activeMessages.length - 1];
  const isLastAssistantRetryable =
    lastMessage?.role === "assistant" &&
    !isStreaming &&
    isRetryableAssistantResponse(
      lastMessage.content,
      lastMessage.metadata?.responseState
    );

  const suggestedPrompts = [
    `Summarize the key ideas of ${topicTitle}`,
    "Show a practical code example",
    "What are common pitfalls or mistakes?",
  ];

  return (
    <div
      data-testid="studio-tutor-chat"
      className={cn("flex flex-col h-full bg-surface text-foreground overflow-hidden", className)}
    >
      {/* Active Branch Header Banner with Lineage Breadcrumbs & Siblings */}
      {onBranch && (
        <div
          data-testid="branch-lineage-banner"
          className="border-b border-border-subtle p-2.5 bg-background-secondary/60 flex flex-col gap-2 shrink-0"
        >
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto no-scrollbar">
              <BranchBreadcrumbs
                steps={breadcrumbSteps}
                onSelectStep={handleSelectBreadcrumbStep}
              />
            </div>
            <Button
              size="xs"
              variant="ghost"
              onClick={handleReturnToMain}
              aria-label="Return to main tutor"
              className="text-foreground-muted hover:text-foreground text-2xs h-6 px-2 shrink-0"
            >
              Main conversation
            </Button>
          </div>

          {/* Sibling sub-branches tabs */}
          {siblingTabs.length > 1 && (
            <div
              data-testid="sibling-branch-tabs"
              className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5"
            >
              <span className="text-2xs text-foreground-subtle shrink-0 mr-1">
                Siblings:
              </span>
              {siblingTabs.map((tab) => {
                const isSelected = tab.leafId === activeNodeId;
                return (
                  <Button
                    key={tab.id}
                    size="xs"
                    variant={isSelected ? "secondary" : "outline"}
                    onClick={() => handleSelectSibling(tab.leafId)}
                    className={cn(
                      "h-5 text-2xs px-2 truncate max-w-[140px] shrink-0",
                      isSelected && "font-semibold"
                    )}
                    title={tab.prompt}
                  >
                    {tab.title}
                  </Button>
                );
              })}
            </div>
          )}

          {/* Quoted passage context identifier */}
          {activeBranchRoot?.highlightedContext && (
            <div className="rounded-lg border-l-2 border-primary bg-surface px-2.5 py-1 text-2xs text-foreground-muted italic truncate">
              &ldquo;{activeBranchRoot.highlightedContext}&rdquo;
            </div>
          )}
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 min-h-0">
        {activeMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-6 px-3 space-y-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </div>
            <div className="space-y-1 max-w-xs">
              <h4 className="text-xs font-semibold text-foreground">
                AI Tutor for {topicTitle}
              </h4>
              <p className="text-2xs text-foreground-muted leading-relaxed">
                Ask questions about concepts, request clarifications, or highlight lesson text to branch into targeted discussion.
              </p>
            </div>

            {/* Suggested prompt chips */}
            <div className="w-full space-y-1.5 pt-2">
              <span className="text-2xs font-medium text-foreground-subtle block text-left px-1">
                Suggested questions:
              </span>
              <div className="flex flex-col gap-1.5">
                {suggestedPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setInput(prompt);
                      textareaRef.current?.focus();
                    }}
                    className="text-left text-2xs p-2 rounded-lg border border-border-subtle bg-background-secondary hover:bg-surface-hover hover:border-border text-foreground-muted hover:text-foreground transition-colors cursor-pointer"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          activeMessages.map((msg) => {
            const isUser = msg.role === "user";
            const isThisStreaming = isStreaming && msg.id === streamingNodeId;
            const isRetryable =
              !isUser &&
              !isStreaming &&
              isRetryableAssistantResponse(
                msg.content,
                msg.metadata?.responseState
              );

            const hasSelectedThisMessage =
              selectedOrigin?.messageId === msg.id && Boolean(selectedOrigin.quote);

            return (
              <div
                key={msg.id}
                data-testid={`tutor-message-${msg.role}`}
                className={cn(
                  "flex flex-col space-y-1.5 max-w-[92%]",
                  isUser ? "ml-auto items-end" : "mr-auto items-start"
                )}
              >
                {/* Header label */}
                <div className="flex items-center gap-1.5 text-2xs text-foreground-muted px-1">
                  {isUser ? (
                    <>
                      <span>You</span>
                      <User className="size-3" />
                    </>
                  ) : (
                    <>
                      <Bot className="size-3 text-primary" />
                      <span className="font-medium text-foreground">AI Tutor</span>
                      {isThisStreaming && (
                        <Badge variant="outline" className="text-2xs h-4 px-1 animate-pulse">
                          streaming
                        </Badge>
                      )}
                    </>
                  )}
                </div>

                {/* Message bubble */}
                <div
                  onMouseUp={(event) => {
                    if (isUser) return;
                    const selection = window.getSelection();
                    const text = selection?.toString().trim();
                    if (
                      selection?.anchorNode &&
                      selection.focusNode &&
                      event.currentTarget.contains(selection.anchorNode) &&
                      event.currentTarget.contains(selection.focusNode) &&
                      text &&
                      msg.content.includes(text)
                    ) {
                      setSelectedOrigin({ messageId: msg.id, quote: text.slice(0, 1000) });
                    }
                  }}
                  className={cn(
                    "rounded-2xl p-3 text-xs leading-relaxed transition-colors shadow-2xs break-words",
                    isUser
                      ? "bg-primary text-primary-foreground rounded-br-xs"
                      : "bg-background-secondary border border-border-subtle text-foreground rounded-bl-xs select-text"
                  )}
                >
                  {isUser ? (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  ) : (
                    <div className="space-y-2">
                      {/* Real-time agent tool execution (failures stay visible) */}
                      {Boolean(
                        (msg.metadata?.toolCalls as ToolCallItem[] | undefined)
                          ?.length,
                      ) && (
                        <AgentToolCallsBanner
                          toolCalls={
                            msg.metadata?.toolCalls as ToolCallItem[]
                          }
                        />
                      )}

                      {/* Grounded RAG citations, reusing the shared strip */}
                      {Boolean(
                        (
                          msg.metadata?.ragSources as
                            | RagSourceItem[]
                            | undefined
                        )?.length,
                      ) && (
                        <RagSourcesStrip
                          sources={msg.metadata?.ragSources as RagSourceItem[]}
                          onSelectSource={handleSelectRagSource}
                        />
                      )}

                      {/* Markdown / KaTeX / code / quiz / error renderer */}
                      {msg.content ? (
                        <div
                          className={
                            /⚠️ \*\*Error:\*\*/.test(msg.content)
                              ? "text-destructive"
                              : undefined
                          }
                        >
                          <MarkdownRenderer
                            content={msg.content}
                            workspaceId={workspaceId}
                          />
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Streaming cursor */}
                  {isThisStreaming && (
                    <span className="inline-block w-1.5 h-3.5 bg-primary ml-1 animate-pulse align-middle" />
                  )}
                </div>

                {/* Message footer actions */}
                <div className="flex items-center gap-2 px-1">
                  {!isUser && !isThisStreaming && (
                    <>
                      <Button
                        size="iconSm"
                        variant="ghost"
                        onClick={() => handleCopy(msg.id, msg.content)}
                        aria-label="Copy message text"
                        className="size-5 text-foreground-muted hover:text-foreground p-0"
                      >
                        {copiedNodeId === msg.id ? (
                          <Check className="size-3 text-success" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleBranchFromMessage(msg.id)}
                        className="h-5 text-2xs px-1.5 gap-1 text-foreground-muted hover:text-foreground"
                        aria-label={
                          hasSelectedThisMessage
                            ? "Branch from selection"
                            : "Branch from reply"
                        }
                      >
                        <CornerDownRight className="size-2.5" />
                        <span>
                          {hasSelectedThisMessage
                            ? "Branch from selection"
                            : "Branch from reply"}
                        </span>
                      </Button>
                    </>
                  )}

                  {isRetryable && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleRetry()}
                      className="h-5 text-2xs px-1.5 gap-1 text-destructive hover:bg-destructive/10"
                    >
                      <RotateCw className="size-2.5" />
                      <span>Retry</span>
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Global Stream Error Banner */}
      {streamError && (
        <div
          role="alert"
          className="mx-3 my-1 flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive shrink-0"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertCircle className="size-3.5 shrink-0" />
            <span className="truncate">{streamError}</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void handleRetry()}
            className="h-6 text-2xs px-2 gap-1 text-destructive hover:bg-destructive/20"
          >
            <RotateCw className="size-3" />
            Retry
          </Button>
        </div>
      )}

      {/* Composer Area */}
      <div className="border-t border-border-subtle p-3 bg-surface space-y-2 shrink-0">
        {/* Branch Origin Context Banner */}
        {activeBranchState && (
          <div
            data-testid="branch-origin-banner"
            className="flex items-start justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 p-2.5 text-xs text-foreground"
          >
            <div className="flex items-start gap-2 min-w-0">
              <GitBranch className="size-3.5 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="text-2xs font-semibold text-primary uppercase tracking-wider block">
                  Branching Conversation
                </span>
                <p className="text-2xs text-foreground-muted line-clamp-2 italic">
                  &ldquo;{activeBranchState.quote}&rdquo;
                </p>
              </div>
            </div>
            <Button
              size="iconSm"
              variant="ghost"
              onClick={() => setActiveBranchState(null)}
              aria-label="Cancel branching"
              className="size-5 text-foreground-muted hover:text-foreground shrink-0"
            >
              <X className="size-3" />
            </Button>
          </div>
        )}

        {/* Quoted Passage Context Banner (from Lesson Reader) */}
        {!activeBranchState && quotedPassage && (
          <div
            data-testid="quoted-passage-banner"
            className="flex items-start justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 p-2.5 text-xs text-foreground"
          >
            <div className="flex items-start gap-2 min-w-0">
              <Quote className="size-3.5 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="text-2xs font-semibold text-primary uppercase tracking-wider block">
                  Quoted Passage
                </span>
                <p className="text-2xs text-foreground-muted line-clamp-2 italic">
                  &ldquo;{quotedPassage}&rdquo;
                </p>
              </div>
            </div>
            {onClearQuote && (
              <Button
                size="iconSm"
                variant="ghost"
                onClick={onClearQuote}
                aria-label="Remove quoted passage"
                className="size-5 text-foreground-muted hover:text-foreground shrink-0"
              >
                <X className="size-3" />
              </Button>
            )}
          </div>
        )}

        {/* Input Textarea & Controls */}
        <div className="relative rounded-xl border border-border bg-background-secondary focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/40 transition-all p-2 flex flex-col gap-2">
          <textarea
            ref={textareaRef}
            data-testid="tutor-chat-input"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={
              activeBranchState
                ? `Explore "${activeBranchState.quote.slice(0, 30)}..." in a new branch...`
                : quotedPassage
                ? "Ask about this quoted passage..."
                : `Ask AI Tutor about ${topicTitle}...`
            }
            rows={2}
            className="w-full resize-none bg-transparent text-xs text-foreground placeholder:text-foreground-subtle outline-none"
          />

          <div className="flex items-center justify-between">
            <span className="text-2xs text-foreground-subtle hidden sm:inline">
              Press Enter to send, Shift+Enter for newline
            </span>

            <div className="flex items-center gap-1.5 ml-auto">
              {isStreaming ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleStop}
                  className="h-7 text-xs gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  <Square className="size-3 fill-destructive text-destructive" />
                  <span>Stop</span>
                </Button>
              ) : isLastAssistantRetryable ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleRetry()}
                  className="h-7 text-xs gap-1"
                >
                  <RotateCw className="size-3" />
                  <span>Retry</span>
                </Button>
              ) : null}

              <Button
                size="sm"
                disabled={!input.trim() || isStreaming}
                onClick={() => void handleSend()}
                className="h-7 text-xs gap-1 px-3"
                aria-label="Send message to AI Tutor"
              >
                {isStreaming ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <ArrowUp className="size-3" />
                )}
                <span>Send</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Full-screen PDF viewer for a grounded citation */}
      {viewingRagPdf && (
        <PdfViewerModal
          isOpen={Boolean(viewingRagPdf)}
          onClose={() => setViewingRagPdf(null)}
          filename={viewingRagPdf.filename}
          url={resolveFileUrl(viewingRagPdf.fileId)}
          initialPage={viewingRagPdf.page}
        />
      )}

      {/* Snippet viewer for a grounded citation */}
      {viewingRagSnippet && (
        <Modal
          isOpen={Boolean(viewingRagSnippet)}
          onClose={() => setViewingRagSnippet(null)}
          size="2xl"
        >
          <ModalHeader
            title={viewingRagSnippet.filename}
            description={
              viewingRagSnippet.section_header
                ? `§ ${viewingRagSnippet.section_header}`
                : undefined
            }
            icon={<FileText className="size-4 text-info" />}
            onClose={() => setViewingRagSnippet(null)}
          >
            {viewingRagSnippet.page_number && (
              <span className="rounded bg-info-bg px-1.5 py-0.5 font-mono text-2xs font-semibold text-info">
                Page {viewingRagSnippet.page_number}
              </span>
            )}
          </ModalHeader>
          <ModalBody className="p-5 font-mono text-xs text-foreground whitespace-pre-wrap leading-relaxed bg-background-secondary/30 max-h-[70vh]">
            {viewingRagSnippet.snippet || "No snippet content available."}
          </ModalBody>
        </Modal>
      )}
    </div>
  );
}
