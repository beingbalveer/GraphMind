"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  AlertCircle,
  ArrowUp,
  Bot,
  Copy,
  Check,
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
import {
  isRetryableAssistantResponse,
  useChatStream,
} from "@/hooks/useChatStream";
import { useModelConfig } from "@/hooks/useModelConfig";
import { fetchGraphSnapshot, snapshotToTree } from "@/lib/workspaceApi";
import { safeGetItem, safeSetItem, safeRemoveItem } from "@/lib/storage";
import { cn } from "@/lib/utils";
import type { TopicSessionData } from "@/lib/roadmapTypes";

export interface StudioTutorChatProps {
  workspaceId: string;
  topicId: string;
  topicTitle?: string;
  topicSessionId?: string | null;
  activeSession?: TopicSessionData | null;
  quotedPassage?: string | null;
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
  onClearQuote,
  onStartSession,
  className,
}: StudioTutorChatProps) {
  const currentSessionId = activeSession?.id ?? topicSessionId ?? null;
  const currentChatId = activeSession?.chatId ?? null;

  const { config: llmConfig } = useModelConfig();

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
  } = useChatStream();

  const [input, setInput] = useState("");
  const [copiedNodeId, setCopiedNodeId] = useState<string | null>(null);
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
  }, [workspaceId, currentSessionId, currentChatId, topicId]);

  // Auto-scroll on new tokens or messages
  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeMessages.length, isStreaming]);

  // Submit message
  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || isStreaming) return;

    const fullMessage = quotedPassage
      ? `> "${quotedPassage}"\n\n${content}`
      : content;

    setInput("");
    safeRemoveItem(draftStorageKey);
    onClearQuote?.();

    try {
      await sendMessage(fullMessage, llmConfig.provider, llmConfig.model, {
        workspaceId,
        topicSessionId: currentSessionId ?? undefined,
        branchOverride: quotedPassage
          ? {
              parentNodeId: tree?.activeNodeId || "",
              highlightedText: quotedPassage,
            }
          : null,
        systemPrompt: `You are the AI Tutor companion for GraphMind Learning Studio. The learner is studying "${topicTitle}". Explain concepts clearly, give concrete examples, resolve questions, and reinforce foundational learning.`,
      });
    } catch {
      // Stream error is captured by useChatStream
    }
  }, [
    input,
    isStreaming,
    quotedPassage,
    draftStorageKey,
    onClearQuote,
    sendMessage,
    llmConfig.provider,
    llmConfig.model,
    workspaceId,
    currentSessionId,
    tree?.activeNodeId,
    topicTitle,
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

  // Determine if the last message is a retryable assistant message
  const lastMessage = activeMessages[activeMessages.length - 1];
  const isLastAssistantRetryable =
    lastMessage?.role === "assistant" &&
    !isStreaming &&
    isRetryableAssistantResponse(
      lastMessage.content,
      lastMessage.metadata?.responseState,
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
                    className="text-left text-2xs p-2 rounded-lg border border-border-subtle bg-background-secondary hover:bg-surface-hover hover:border-border text-foreground-muted hover:text-foreground transition-colors"
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
                msg.metadata?.responseState,
              );

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
                  className={cn(
                    "rounded-2xl p-3 text-xs leading-relaxed transition-colors shadow-2xs break-words",
                    isUser
                      ? "bg-primary text-primary-foreground rounded-br-xs"
                      : "bg-background-secondary border border-border-subtle text-foreground rounded-bl-xs"
                  )}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {/* Streaming cursor */}
                  {isThisStreaming && (
                    <span className="inline-block w-1.5 h-3.5 bg-primary ml-1 animate-pulse align-middle" />
                  )}
                </div>

                {/* Message footer actions */}
                <div className="flex items-center gap-2 px-1">
                  {!isUser && !isThisStreaming && (
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
          className="mx-3 my-1 flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive"
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
      <div className="border-t border-border-subtle p-3 bg-surface space-y-2">
        {/* Quoted Passage Context Banner */}
        {quotedPassage && (
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
              quotedPassage
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
    </div>
  );
}
