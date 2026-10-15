"use client";

import React, { useState } from "react";
import { BookMarked, History, Maximize2, Minimize2, MessageSquare, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { StudioTopicChatHistory } from "./StudioTopicChatHistory";
import { cn } from "@/lib/utils";
import type { TopicSessionData, TopicSessionSummary } from "@/lib/roadmapTypes";

export interface StudioTutorRailProps {
  workspaceId?: string;
  topicId?: string;
  topicTitle?: string;
  isArchived?: boolean;
  activeSessionId?: string | null;
  onSelectSession?: (session: TopicSessionSummary) => void;
  onSessionCreated?: (session: TopicSessionData) => void;
  tutorContent?: React.ReactNode;
  resourcesContent?: React.ReactNode;
  onClose?: () => void;
  onToggleExpand?: () => void;
  isExpanded?: boolean;
  className?: string;
}

/**
 * StudioTutorRail — Right contextual rail for the Learning Studio AI Tutor and Lesson Sources.
 * Conforms to semantic tokens, dark mode, and responsive layout standards.
 */
export function StudioTutorRail({
  workspaceId,
  topicId,
  topicTitle = "Current Topic",
  isArchived = false,
  activeSessionId,
  onSelectSession,
  onSessionCreated,
  tutorContent,
  resourcesContent,
  onClose,
  onToggleExpand,
  isExpanded = false,
  className,
}: StudioTutorRailProps) {
  const [activeTab, setActiveTab] = useState<"tutor" | "resources">("tutor");
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div
      data-testid="studio-tutor-rail"
      className={cn(
        "flex flex-col h-full bg-surface border-l border-border text-foreground select-none overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="p-3 border-b border-border-subtle flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Sparkles className="size-3.5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-2xs text-foreground-muted font-medium uppercase tracking-wider">
                Topic Companion
              </span>
              <h3 className="text-xs font-semibold text-foreground truncate" title={topicTitle}>
                {topicTitle}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onToggleExpand && (
              <Button
                size="iconSm"
                variant="ghost"
                onClick={onToggleExpand}
                aria-label={isExpanded ? "Restore tutor panel width" : "Expand tutor panel width"}
                className="text-foreground-muted hover:text-foreground hidden lg:inline-flex"
              >
                {isExpanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
              </Button>
            )}
            {onClose && (
              <Button
                size="iconSm"
                variant="ghost"
                onClick={onClose}
                aria-label="Close tutor panel"
                className="text-foreground-muted hover:text-foreground"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Tab switch between Tutor Chat & Sources */}
        <SegmentedTabs
          items={[
            { id: "tutor", label: "AI Tutor" },
            { id: "resources", label: "Sources & Notes" },
          ]}
          value={activeTab}
          onChange={(id) => setActiveTab(id as "tutor" | "resources")}
          size="sm"
        />

        {/* History / Active session toggle */}
        {activeTab === "tutor" && workspaceId && topicId && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-2xs text-foreground-muted">
              {showHistory ? "Viewing previous chats" : "Active tutor session"}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowHistory((v) => !v)}
              className="h-6 text-2xs gap-1 px-2 text-foreground-muted hover:text-foreground"
            >
              {showHistory ? (
                <>
                  <MessageSquare className="size-3" />
                  <span>Back to tutor</span>
                </>
              ) : (
                <>
                  <History className="size-3" />
                  <span>Past chats</span>
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0 p-3">
        {activeTab === "tutor" ? (
          showHistory && workspaceId && topicId ? (
            <StudioTopicChatHistory
              workspaceId={workspaceId}
              topicId={topicId}
              topicTitle={topicTitle}
              isArchived={isArchived}
              activeSessionId={activeSessionId}
              onSelectSession={(summary) => {
                onSelectSession?.(summary);
                setShowHistory(false);
              }}
              onSessionCreated={(session) => {
                onSessionCreated?.(session);
                setShowHistory(false);
              }}
            />
          ) : tutorContent ? (
            tutorContent
          ) : workspaceId && topicId ? (
            <StudioTopicChatHistory
              workspaceId={workspaceId}
              topicId={topicId}
              topicTitle={topicTitle}
              isArchived={isArchived}
              activeSessionId={activeSessionId}
              onSelectSession={onSelectSession}
              onSessionCreated={onSessionCreated}
            />
          ) : (
            <div className="p-4 text-center text-xs text-foreground-muted flex flex-col items-center gap-2">
              <Sparkles className="size-6 text-foreground-subtle" />
              <p>Ask questions, highlight text in the lesson to branch, or request a deeper explanation.</p>
            </div>
          )
        ) : (
          resourcesContent ? (
            resourcesContent
          ) : (
            <div className="p-4 text-center text-xs text-foreground-muted flex flex-col items-center gap-2">
              <BookMarked className="size-6 text-foreground-subtle" />
              <p>No external references or verified sources attached to this topic.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
