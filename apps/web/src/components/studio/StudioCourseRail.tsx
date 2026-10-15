"use client";

import React, { useState } from "react";
import { BookOpen, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { StudioTopicChatHistory } from "./StudioTopicChatHistory";
import { cn } from "@/lib/utils";
import type { TopicSessionData, TopicSessionSummary } from "@/lib/roadmapTypes";

export interface StudioCourseRailProps {
  courseTitle?: string;
  progressPercent?: number;
  workspaceId?: string;
  topicId?: string;
  topicTitle?: string;
  isArchived?: boolean;
  activeSessionId?: string | null;
  onSelectSession?: (session: TopicSessionSummary) => void;
  onSessionCreated?: (session: TopicSessionData) => void;
  outlineContent?: React.ReactNode;
  chatsContent?: React.ReactNode;
  onNewChat?: () => void;
  onClose?: () => void;
  className?: string;
}

/**
 * StudioCourseRail — Left navigation rail for course outline, lessons, and conversations.
 * Structured with semantic design tokens and accessible controls.
 */
export function StudioCourseRail({
  courseTitle = "Course Workspace",
  progressPercent = 0,
  workspaceId,
  topicId,
  topicTitle,
  isArchived = false,
  activeSessionId,
  onSelectSession,
  onSessionCreated,
  outlineContent,
  chatsContent,
  onNewChat,
  onClose,
  className,
}: StudioCourseRailProps) {
  const [activeTab, setActiveTab] = useState<"outline" | "chats">("outline");

  return (
    <div
      data-testid="studio-course-rail"
      className={cn(
        "flex flex-col h-full bg-surface border-r border-border text-foreground select-none overflow-hidden",
        className
      )}
    >
      {/* Course Header Banner */}
      <div className="p-3 border-b border-border-subtle flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <BookOpen className="size-3.5" />
            </div>
            <h2 className="text-sm font-semibold truncate leading-tight text-foreground" title={courseTitle}>
              {courseTitle}
            </h2>
          </div>
          {onClose && (
            <Button
              size="iconSm"
              variant="ghost"
              onClick={onClose}
              aria-label="Close course outline"
              className="text-foreground-muted hover:text-foreground shrink-0 md:hidden"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-between text-2xs text-foreground-muted">
          <span>Course completion</span>
          <span className="font-medium text-foreground">{Math.round(progressPercent)}%</span>
        </div>
        <div className="w-full bg-surface-hover h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-300 rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>

        {/* Tab switch between Course Outline & Conversations */}
        <div className="mt-1">
          <SegmentedTabs
            items={[
              { id: "outline", label: "Outline" },
              { id: "chats", label: "Chats" },
            ]}
            value={activeTab}
            onChange={(id) => setActiveTab(id as "outline" | "chats")}
            size="sm"
          />
        </div>
      </div>

      {/* Rail Body */}
      <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1">
        {activeTab === "outline" ? (
          outlineContent ? (
            outlineContent
          ) : (
            <div className="p-4 text-center text-xs text-foreground-muted">
              No course topics loaded.
            </div>
          )
        ) : (
          <div className="flex flex-col h-full">
            {onNewChat && (
              <div className="pb-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onNewChat}
                  className="w-full justify-start gap-1.5 text-xs h-8"
                >
                  <Plus className="size-3.5" />
                  New course conversation
                </Button>
              </div>
            )}
            {chatsContent ? (
              chatsContent
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
              <div className="p-4 text-center text-xs text-foreground-muted">
                No active conversations for this course.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
