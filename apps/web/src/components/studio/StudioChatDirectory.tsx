"use client";

import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  Archive,
  ChevronRight,
  CornerDownRight,
  History,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RotateCw,
  Search,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useWorkspaceChats } from "@/hooks/useWorkspaceChats";
import {
  filterChatDirectory,
  projectChatDirectory,
  type ChatDirectoryEntry,
} from "@/lib/chatDirectory";
import { cn } from "@/lib/utils";
import type { ChatItem } from "@/lib/workspaceApi";

export interface StudioChatDirectoryProps {
  workspaceId: string;
  title?: string;
  description?: string;
  /** Protected structural row to exclude defensively (roadmap canvas anchor). */
  excludeChatId?: string | null;
  activeChatId?: string | null;
  /** Open a conversation through its canonical chat URL. */
  onOpenChat: (chat: ChatItem) => void;
  /** Start a new conversation in this workspace. */
  onNewChat?: () => void;
  /** Return a lesson/topic conversation to its lesson context. */
  onReturnToLesson?: (chat: ChatItem) => void;
  className?: string;
}

function formatUpdated(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/**
 * StudioChatDirectory — Course directory and historical chats.
 *
 * Lists the authorized workspace's conversations from the existing chat list
 * metadata, with scoped search, rename, and pin, and projects each row's
 * lesson/ordinary ancestry. Opening a conversation uses the canonical
 * `/w/{workspaceId}/chat/{chatId}` URL so the existing branch ancestry
 * projection renders in the chat/canvas view.
 */
export function StudioChatDirectory({
  workspaceId,
  title = "All conversations",
  description = "Chats and topic tutor history in this course.",
  excludeChatId = null,
  activeChatId = null,
  onOpenChat,
  onNewChat,
  onReturnToLesson,
  className,
}: StudioChatDirectoryProps) {
  const { chats, isLoading, loadError, actionError, refresh, renameChat, togglePin } =
    useWorkspaceChats(workspaceId);

  const [query, setQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const entries = useMemo(
    () => projectChatDirectory(chats, { excludeChatId }),
    [chats, excludeChatId],
  );
  const visible = useMemo(
    () => filterChatDirectory(entries, query),
    [entries, query],
  );

  const startRename = (entry: ChatDirectoryEntry) => {
    setRenamingId(entry.chat.id);
    setRenameValue(entry.chat.title);
  };

  const submitRename = async (chatId: string) => {
    const next = renameValue;
    setRenamingId(null);
    await renameChat(chatId, next);
  };

  return (
    <div
      data-testid="studio-chat-directory"
      className={cn("flex flex-col h-full min-h-0 space-y-3", className)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <History className="size-3.5 text-foreground-muted shrink-0" />
            <span className="truncate">{title}</span>
            {entries.length > 0 && (
              <Badge variant="outline" className="text-2xs">
                {entries.length}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-2xs text-foreground-muted">{description}</p>
        </div>
        {onNewChat && (
          <Button
            size="sm"
            variant="outline"
            onClick={onNewChat}
            className="h-7 text-xs gap-1 px-2.5 shrink-0"
          >
            <Plus className="size-3" />
            <span>New chat</span>
          </Button>
        )}
      </div>

      {/* Scoped search */}
      <Input
        aria-label="Search course conversations"
        placeholder="Search course conversations"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        startIcon={<Search className="size-4" />}
        inputSize="sm"
        endIcon={
          query ? (
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="text-foreground-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </Button>
          ) : undefined
        }
      />

      {/* Action error (rename/pin) */}
      {actionError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span className="flex-1">{actionError}</span>
        </div>
      )}

      {/* Load error */}
      {loadError && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span className="flex-1 font-medium">{loadError}</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void refresh()}
            className="self-start h-6 text-2xs gap-1 px-2 text-destructive hover:bg-destructive/20"
          >
            <RotateCw className="size-3" />
            Retry conversations
          </Button>
        </div>
      )}

      {/* Loading */}
      {isLoading && entries.length === 0 && !loadError && (
        <div className="flex items-center justify-center p-6 text-xs text-foreground-muted gap-2">
          <Loader2 className="size-4 animate-spin text-primary" />
          <span>Loading conversations...</span>
        </div>
      )}

      {/* Empty (no conversations) */}
      {!isLoading && entries.length === 0 && !loadError && (
        <div className="rounded-xl border border-dashed border-border-subtle bg-surface p-6 text-center space-y-3">
          <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageSquare className="size-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-foreground">
              No conversations yet
            </h4>
            <p className="text-2xs text-foreground-muted max-w-xs mx-auto">
              Start a new chat or ask the tutor about a lesson to build this
              course&apos;s conversation history.
            </p>
          </div>
        </div>
      )}

      {/* Empty (no matches) */}
      {!isLoading && entries.length > 0 && visible.length === 0 && (
        <div className="rounded-xl border border-dashed border-border-subtle bg-surface p-6 text-center space-y-3">
          <p className="text-xs font-semibold text-foreground">
            No matching conversations
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setQuery("")}
            className="h-7 text-xs gap-1 px-2.5"
          >
            <X className="size-3" />
            Clear search
          </Button>
        </div>
      )}

      {/* Directory list */}
      {visible.length > 0 && (
        <div
          role="list"
          aria-label="Course conversations"
          className="space-y-2 flex-1 overflow-y-auto pr-0.5"
        >
          {visible.map((entry) => {
            const { chat } = entry;
            const isActive = activeChatId === chat.id;
            const isLesson = entry.kind === "lesson";
            return (
              <div
                key={chat.id}
                role="listitem"
                data-testid={`chat-directory-row-${chat.id}`}
                className={cn(
                  "group relative rounded-xl border p-2.5 transition-colors flex flex-col gap-1.5",
                  isActive
                    ? "border-primary/50 bg-primary/5 shadow-xs"
                    : "border-border-subtle bg-background-secondary hover:bg-surface-hover/80 hover:border-border",
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    onClick={() => onOpenChat(chat)}
                    aria-label={`Open conversation ${chat.title}`}
                    className="min-w-0 flex-1 justify-start gap-1.5 h-7 px-2 text-xs text-left"
                  >
                    <MessageSquare className="size-3.5 shrink-0 text-foreground-muted" />
                    <span className="truncate">{chat.title}</span>
                    {entry.pinned && (
                      <Pin className="size-3 shrink-0 text-primary" aria-hidden="true" />
                    )}
                  </Button>

                  {isLesson ? (
                    <Badge variant="info" className="text-2xs shrink-0">
                      Lesson
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-2xs shrink-0">
                      Personal
                    </Badge>
                  )}

                  <DropdownMenu
                    align="right"
                    trigger={
                      <Button
                        size="iconSm"
                        variant="ghost"
                        aria-label={`Chat actions for ${chat.title}`}
                        className="text-foreground-muted hover:text-foreground shrink-0"
                      >
                        <MoreHorizontal className="size-3.5" />
                      </Button>
                    }
                    items={[
                      {
                        label: "Rename",
                        icon: <Pencil className="size-3.5" />,
                        onClick: () => startRename(entry),
                      },
                      {
                        label: entry.pinned ? "Unpin" : "Pin",
                        icon: entry.pinned ? (
                          <PinOff className="size-3.5" />
                        ) : (
                          <Pin className="size-3.5" />
                        ),
                        onClick: () => void togglePin(chat.id, !entry.pinned),
                      },
                      ...(isLesson && onReturnToLesson
                        ? [
                            {
                              label: "Open lesson",
                              icon: <CornerDownRight className="size-3.5" />,
                              onClick: () => onReturnToLesson(chat),
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>

                {/* Ancestry projection */}
                <nav
                  aria-label="Conversation ancestry"
                  data-testid={`chat-ancestry-${chat.id}`}
                  className="flex items-center gap-1 px-2 text-2xs text-foreground-muted min-w-0"
                >
                  {entry.ancestry.map((label, index) => (
                    <React.Fragment key={`${chat.id}-ancestry-${index}`}>
                      {index > 0 && (
                        <ChevronRight className="size-2.5 shrink-0 opacity-60" />
                      )}
                      <span className="truncate">{label}</span>
                    </React.Fragment>
                  ))}
                  {chat.topicAssociation?.archived && (
                    <Badge variant="warning" className="text-2xs gap-0.5 ml-1">
                      <Archive className="size-2.5" />
                      Archived
                    </Badge>
                  )}
                  <span className="ml-auto shrink-0 tabular-nums">
                    {formatUpdated(chat.updatedAt)}
                  </span>
                </nav>

                {/* Inline rename */}
                {renamingId === chat.id && (
                  <form
                    className="flex items-center gap-1 px-1"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submitRename(chat.id);
                    }}
                  >
                    <Input
                      aria-label="Chat title"
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      inputSize="sm"
                      autoFocus
                    />
                    <Button size="sm" type="submit" aria-label="Save chat title" className="h-7 px-2 text-xs">
                      Save
                    </Button>
                    <Button
                      size="iconSm"
                      variant="ghost"
                      type="button"
                      aria-label="Cancel rename"
                      onClick={() => setRenamingId(null)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
