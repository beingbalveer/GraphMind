"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  MoreHorizontal,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  Plus,
  PanelLeft,
  FolderOpen,
  MessageSquare,
  ChevronDown,
} from "lucide-react";
import { ChatItem } from "@/lib/workspaceApi";
import { Button } from "@/components/ui/button";
import { LogoBadge } from "@/components/ui/Logo";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { useResizableSidebar } from "@/hooks/useResizableSidebar";
import { UserMenu } from "@/components/layout/UserMenu";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface ChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  workspaceName?: string;
  chats: ChatItem[];
  activeChatId: string | null;
  isLibraryActive?: boolean;
  onSelectChat: (chat: ChatItem) => void;
  onDeleteChat: (id: string) => void;
  onRenameChat: (id: string, newTitle: string) => Promise<void>;
  onTogglePinChat?: (id: string, pinned: boolean) => Promise<void>;
  onOpenWorkspaceModal?: () => void;
  onOpenSettings?: () => void;
  onNewChat?: () => void;
  onOpenFileLibrary?: () => void;
}

const DEFAULT_WIDTH = 260;
const COLLAPSED_WIDTH = 56;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;



export function ChatSidebar({
  isOpen,
  onToggle,
  workspaceName = "Main Workspace",
  chats,
  activeChatId,
  onSelectChat,
  onDeleteChat,
  onRenameChat,
  onTogglePinChat,
  onOpenWorkspaceModal,
  onOpenSettings,
  onNewChat,
  onOpenFileLibrary,
  isLibraryActive = false,
}: ChatSidebarProps) {
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [openMenuChatId, setOpenMenuChatId] = useState<string | null>(null);

  const { width, isResizing, startResizing, resetWidth } = useResizableSidebar({
    storageKey: "graphmind_sidebar_width_v1",
    defaultWidth: DEFAULT_WIDTH,
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
    side: "left",
  });

  const sortedChats = useMemo(() => {
    return [...chats].sort((a, b) => {
      const aPinned = a.pinned ? 1 : 0;
      const bPinned = b.pinned ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [chats]);


  // Auto-focus rename input when triggered
  useEffect(() => {
    if (renamingChatId) {
      setTimeout(() => renameInputRef.current?.focus(), 0);
    }
  }, [renamingChatId]);

  const startRename = useCallback((chat: ChatItem) => {
    setRenamingChatId(chat.id);
    setRenameValue(chat.title || "");
  }, []);

  const commitRename = useCallback(async () => {
    if (!renamingChatId || !renameValue.trim()) {
      setRenamingChatId(null);
      return;
    }
    await onRenameChat(renamingChatId, renameValue.trim());
    setRenamingChatId(null);
  }, [renamingChatId, renameValue, onRenameChat]);

  // Shared design-system thread list item
  const renderChatItem = (chat: ChatItem) => {
    const isActive = !isLibraryActive && chat.id === activeChatId;
    const isRenaming = renamingChatId === chat.id;
    const rawTitle = chat.title?.trim() || "New Chat";
    const formattedTitle = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);

    return (
      <div
        key={chat.id}
        role="button"
        tabIndex={0}
        aria-current={isActive ? "page" : undefined}
        onClick={() => !isRenaming && onSelectChat(chat)}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !isRenaming) {
            e.preventDefault();
            onSelectChat(chat);
          }
        }}
        className={cn(
          "group relative flex h-[34px] w-full items-center px-2.5 rounded-lg text-sm transition-colors cursor-pointer select-none shadow-none",
          isActive
            ? "bg-surface-hover text-foreground font-medium"
            : "text-foreground-muted font-normal hover:text-foreground hover:bg-surface-hover"
        )}
      >
        {isRenaming ? (
          /* Inline rename input */
          <input
            ref={renameInputRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setRenamingChatId(null);
            }}
            className="h-7 w-full mx-1 bg-surface border border-border rounded px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/20 shadow-2xs"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            {/* Title trigger with pe-7 on hover so title never overlaps 3 dots */}
            <div className="flex h-full min-w-0 flex-1 items-center text-start outline-none group-hover:pe-7 transition-[padding]">
              <span className="min-w-0 flex-1 truncate first-letter:uppercase">{formattedTitle}</span>
              {chat.pinned && (
                <Pin className="size-3 text-foreground-muted shrink-0 ml-1.5" aria-label="Pinned" />
              )}
            </div>

            {/* Subtle 3-dots trigger button (only visible on hover or when open) */}
            <div
              className={`absolute end-1.5 top-1/2 -translate-y-1/2 transition-opacity ${
                openMenuChatId === chat.id
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenu
                trigger={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-6 p-0 text-foreground-muted hover:text-foreground hover:bg-surface-hover"
                    title="More options"
                    aria-label="More options"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                }
                onOpenChange={(isOpenState) =>
                  setOpenMenuChatId(isOpenState ? chat.id : null)
                }
                align="right"
                items={[
                  {
                    label: chat.pinned ? "Unpin" : "Pin to top",
                    icon: chat.pinned ? (
                      <PinOff className="size-4" />
                    ) : (
                      <Pin className="size-4" />
                    ),
                    onClick: () => onTogglePinChat?.(chat.id, !chat.pinned),
                  },
                  {
                    label: "Rename",
                    icon: <Pencil className="size-4" />,
                    onClick: () => startRename(chat),
                  },
                  {
                    label: "Delete",
                    icon: <Trash2 className="size-4" />,
                    variant: "destructive",
                    onClick: () => setDeletingChatId(chat.id),
                  },
                ]}
              />
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onToggle}
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-2xs md:hidden"
        />
      )}

      {/* Collapsible & Resizable Left Sidebar Container */}
      <aside
        suppressHydrationWarning
        style={{ width: isOpen ? `${width}px` : `${COLLAPSED_WIDTH}px` }}
        className={`fixed md:static inset-y-0 left-0 z-40 flex flex-col bg-surface select-none relative shrink-0 overflow-hidden border-r border-border-subtle ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${isResizing ? "transition-none" : "transition-[width,transform] duration-200 ease-in-out"}`}
      >
        {/* Sidebar Header: Toggle button + GraphMind Icon & Workspace Name */}
        <div className="h-13 px-3 flex items-center shrink-0 w-full">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggle}
            className="text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer shrink-0"
            title={isOpen ? "Collapse sidebar (⌘B)" : "Expand sidebar (⌘B)"}
            aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <PanelLeft className="w-4 h-4" />
          </Button>

          <div className={`flex items-center gap-1.5 min-w-0 pl-2 transition-opacity duration-150 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
            <Link
              href="/"
              className="flex items-center justify-center rounded-lg hover:opacity-85 transition-opacity shrink-0 cursor-pointer"
              title="GraphMind Home"
              aria-label="Go to GraphMind Home"
            >
              <LogoBadge size="sm" />
            </Link>

            {onOpenWorkspaceModal ? (
              <Button
                variant="ghost"
                onClick={onOpenWorkspaceModal}
                className="h-auto flex items-center gap-1 px-1.5 py-1 rounded-lg hover:bg-surface-hover text-foreground transition-colors cursor-pointer group min-w-0 font-normal shadow-none"
                title="Switch or manage workspaces"
                aria-label="Switch or manage workspaces"
              >
                <span className="text-sm font-semibold text-foreground tracking-tight truncate max-w-[135px]">
                  {workspaceName}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-foreground-muted group-hover:text-foreground transition-colors shrink-0" />
              </Button>
            ) : (
              <span className="text-sm font-semibold text-foreground tracking-tight truncate max-w-[145px] px-1.5 py-1">
                {workspaceName}
              </span>
            )}
          </div>
        </div>

        {/* Actions: New chat & Library */}
        <div className="px-3 pt-1 pb-1 shrink-0 space-y-1 w-full">
          {onNewChat && (
            <Button
              variant="ghost"
              onClick={onNewChat}
              className="h-[34px] w-full justify-start items-center gap-2 rounded-lg text-sm font-normal text-foreground hover:bg-surface-hover transition-colors cursor-pointer group shadow-none px-0"
              title="New Chat (⌘N)"
              aria-label="New Chat"
            >
              <div className="size-8 rounded-lg flex items-center justify-center shrink-0">
                <Plus className="w-4 h-4 text-foreground-muted group-hover:text-foreground transition-colors" />
              </div>
              <div className={`flex-1 flex items-center justify-between min-w-0 pr-2 transition-opacity duration-150 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                <span className="truncate text-left">New Chat</span>
                <span className="text-2xs text-foreground-muted opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                  ⌘N
                </span>
              </div>
            </Button>
          )}

          {onOpenFileLibrary && (
            <Button
              variant="ghost"
              onClick={onOpenFileLibrary}
              aria-current={isLibraryActive ? "page" : undefined}
              className={cn(
                "h-[34px] w-full justify-start items-center gap-2 rounded-lg text-sm transition-colors cursor-pointer group shadow-none px-0",
                isLibraryActive
                  ? "bg-surface-hover text-foreground font-medium"
                  : "text-foreground-muted font-normal hover:text-foreground hover:bg-surface-hover"
              )}
              title="Workspace File Library"
              aria-label="Workspace File Library"
            >
              <div className="size-8 rounded-lg flex items-center justify-center shrink-0">
                <FolderOpen
                  className={cn(
                    "w-4 h-4 transition-colors",
                    isLibraryActive
                      ? "text-foreground"
                      : "text-foreground-muted group-hover:text-foreground"
                  )}
                />
              </div>
              <div className={`flex-1 min-w-0 text-left pr-2 transition-opacity duration-150 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                <span className="truncate">File Library</span>
              </div>
            </Button>
          )}
        </div>

        {/* ThreadList Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-1 space-y-0.5 relative">
          <div className={`transition-opacity duration-150 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none hidden"}`}>
            {sortedChats.length === 0 ? (
              <div className="py-8 px-2.5 text-center text-xs text-foreground-muted">
                No conversations yet
              </div>
            ) : (
              <div className="space-y-0.5 pt-4 first:pt-2.5">
                <div className="px-2.5 pb-1 pt-1 text-2xs font-medium text-foreground-muted select-none">
                  Conversations
                </div>
                {sortedChats.map(renderChatItem)}
              </div>
            )}
          </div>

          {!isOpen && (
            <div className="flex flex-col items-center pt-1 animate-in fade-in duration-150">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onToggle}
                className="text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer relative"
                title={`Threads (${chats.length})`}
                aria-label={`Threads (${chats.length})`}
              >
                <MessageSquare className="w-4 h-4" />
                {chats.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" />
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 shrink-0 space-y-1 relative w-full">
          <UserMenu collapsed={!isOpen} placement="top" onOpenSettings={onOpenSettings} />
        </div>

        {/* Right-Edge Drag Handle */}
        {isOpen && (
          <div
            onMouseDown={startResizing}
            onDoubleClick={resetWidth}
            className="absolute top-0 -right-1 w-2 h-full cursor-col-resize z-50 bg-transparent"
            title="Drag to resize sidebar (double-click to reset)"
          />
        )}
      </aside>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingChatId)}
        onClose={() => setDeletingChatId(null)}
        onConfirm={() => {
          if (deletingChatId) {
            onDeleteChat(deletingChatId);
            setDeletingChatId(null);
          }
        }}
        title="Delete conversation"
        description="Are you sure you want to delete this conversation and all its branched responses? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />
    </>
  );
}
