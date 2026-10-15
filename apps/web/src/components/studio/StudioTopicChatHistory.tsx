"use client";

import React from "react";
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Clock,
  History,
  Loader2,
  MessageSquare,
  Plus,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTopicChatHistory } from "@/hooks/useTopicChatHistory";
import { cn } from "@/lib/utils";
import type {
  TopicSessionData,
  TopicSessionSummary,
} from "@/lib/roadmapTypes";

export interface StudioTopicChatHistoryProps {
  workspaceId: string;
  topicId: string;
  topicTitle?: string;
  isArchived?: boolean;
  activeSessionId?: string | null;
  onSelectSession?: (session: TopicSessionSummary) => void;
  onSessionCreated?: (session: TopicSessionData) => void;
  className?: string;
}

export function StudioTopicChatHistory({
  workspaceId,
  topicId,
  topicTitle,
  isArchived = false,
  activeSessionId,
  onSelectSession,
  onSessionCreated,
  className,
}: StudioTopicChatHistoryProps) {
  const {
    sessions,
    activeSession,
    isLoading,
    isStarting,
    historyError,
    actionError,
    openSession,
    selectSession,
    refreshHistory,
  } = useTopicChatHistory(workspaceId, topicId, {
    isArchived,
    initialSessionId: activeSessionId,
  });

  const currentSessionId = activeSession?.id ?? activeSessionId;

  const handleStartSession = async (fresh: boolean) => {
    const session = await openSession(fresh);
    if (session) {
      onSessionCreated?.(session);
    }
  };

  const handleSelectSession = async (summary: TopicSessionSummary) => {
    await selectSession(summary);
    onSelectSession?.(summary);
  };

  const getStateBadge = (state: TopicSessionSummary["lessonStartState"]) => {
    switch (state) {
      case "pending":
        return <Badge variant="outline" className="text-2xs">Ready to start</Badge>;
      case "started":
        return <Badge variant="secondary" className="text-2xs">In progress</Badge>;
      case "completed":
        return <Badge variant="success" className="text-2xs">Completed</Badge>;
      case "interrupted":
        return <Badge variant="warning" className="text-2xs">Interrupted</Badge>;
      default:
        return null;
    }
  };

  const formatSessionDate = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div
      data-testid="studio-topic-chat-history"
      className={cn("flex flex-col h-full space-y-3", className)}
    >
      {/* Header action: Start fresh conversation */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <History className="size-3.5 text-foreground-muted" />
          <span>Conversations</span>
          {sessions.length > 0 && (
            <Badge variant="outline" className="text-2xs ml-1">
              {sessions.length}
            </Badge>
          )}
        </div>

        <Button
          size="sm"
          variant="outline"
          disabled={isStarting || isArchived}
          onClick={() => void handleStartSession(true)}
          className="h-7 text-xs gap-1 px-2.5"
          title={isArchived ? "Archived topics cannot start new conversations" : undefined}
        >
          {isStarting ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Plus className="size-3" />
          )}
          <span>New chat</span>
        </Button>
      </div>

      {/* Action / creation error banner */}
      {actionError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span className="flex-1">{actionError}</span>
        </div>
      )}

      {/* History load error banner */}
      {historyError && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span className="flex-1 font-medium">{historyError}</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void refreshHistory()}
            className="self-start h-6 text-2xs gap-1 px-2 hover:bg-destructive/20 text-destructive"
          >
            <RotateCw className="size-3" />
            Retry session history
          </Button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && sessions.length === 0 && (
        <div className="flex items-center justify-center p-6 text-xs text-foreground-muted gap-2">
          <Loader2 className="size-4 animate-spin text-primary" />
          <span>Loading conversations...</span>
        </div>
      )}

      {/* Empty state: No conversations */}
      {!isLoading && sessions.length === 0 && !historyError && (
        <div className="rounded-xl border border-dashed border-border-subtle bg-surface p-6 text-center space-y-3">
          <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="size-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-foreground">
              No conversations yet
            </h4>
            <p className="text-2xs text-foreground-muted max-w-xs mx-auto">
              Start a guided session with the AI Tutor to explore {topicTitle || "this topic"}, clarify concepts, or practice with feedback.
            </p>
          </div>
          <Button
            size="sm"
            disabled={isStarting || isArchived}
            onClick={() => void handleStartSession(false)}
            className="text-xs gap-1.5"
          >
            {isStarting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            <span>Start learning session</span>
          </Button>
        </div>
      )}

      {/* Sessions list */}
      {sessions.length > 0 && (
        <div
          role="list"
          aria-label="Topic conversation sessions"
          className="space-y-2 flex-1 overflow-y-auto pr-0.5"
        >
          {sessions.map((summary, index) => {
            const isSelected = currentSessionId === summary.id;
            return (
              <div
                key={summary.id}
                role="listitem"
                className={cn(
                  "group relative rounded-xl border p-3 transition-colors text-left flex flex-col gap-2",
                  isSelected
                    ? "border-primary/50 bg-primary/5 shadow-xs"
                    : "border-border-subtle bg-background-secondary hover:bg-surface-hover/80 hover:border-border"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {summary.title || `Session ${sessions.length - index}`}
                      </span>
                      {summary.isPrimary && (
                        <Badge variant="default" className="text-2xs">
                          Primary
                        </Badge>
                      )}
                      {summary.archived && (
                        <Badge variant="secondary" className="text-2xs gap-0.5">
                          <Archive className="size-2.5" />
                          Archived
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-2xs text-foreground-muted">
                      <span className="flex items-center gap-1">
                        <Clock className="size-2.5" />
                        {formatSessionDate(summary.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {getStateBadge(summary.lessonStartState)}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-border-subtle/50">
                  <span className="text-2xs font-mono text-foreground-subtle truncate max-w-[140px]">
                    chat:{summary.chatId.slice(0, 8)}...
                  </span>

                  <Button
                    size="sm"
                    variant={isSelected ? "secondary" : "ghost"}
                    onClick={() => void handleSelectSession(summary)}
                    className="h-6 text-2xs px-2 gap-1"
                    aria-label={`Resume lesson session ${sessions.length - index}${summary.archived ? ", archived topic" : ""}`}
                  >
                    {isSelected ? (
                      <>
                        <CheckCircle2 className="size-3 text-primary" />
                        <span>Active</span>
                      </>
                    ) : (
                      <>
                        <MessageSquare className="size-3" />
                        <span>Resume</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
