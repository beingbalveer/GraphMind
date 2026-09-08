"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Search,
  MoreHorizontal,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  Settings,
  Plus,
  PanelLeftClose,
  PanelLeft,
  FolderOpen,
  MessageSquare,
} from "lucide-react";
import { ChatItem } from "@/lib/workspaceApi";
import { LogoBadge } from "@/components/ui/Logo";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { useResizableSidebar } from "@/hooks/useResizableSidebar";

interface ChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  workspaceName?: string;
  chats: ChatItem[];
  activeChatId: string | null;
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

const DAY_IN_MS = 86_400_000;

interface ChatGroup {
  label: string;
  chats: ChatItem[];
}

function groupChatsByDate(chats: ChatItem[]): ChatGroup[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - DAY_IN_MS;

  const pinned: ChatItem[] = [];
  const todayChats: ChatItem[] = [];
  const yesterdayChats: ChatItem[] = [];
  const earlierChats: ChatItem[] = [];

  for (const chat of chats) {
    if (chat.pinned) {
      pinned.push(chat);
      continue;
    }
    const time = new Date(chat.updatedAt).getTime();
    if (time >= startOfToday) {
      todayChats.push(chat);
    } else if (time >= startOfYesterday) {
      yesterdayChats.push(chat);
    } else {
      earlierChats.push(chat);
    }
  }

  const groups: ChatGroup[] = [];
  if (pinned.length > 0) groups.push({ label: "Pinned", chats: pinned });
  if (todayChats.length > 0) groups.push({ label: "Today", chats: todayChats });
  if (yesterdayChats.length > 0) groups.push({ label: "Yesterday", chats: yesterdayChats });
  if (earlierChats.length > 0) groups.push({ label: "Earlier", chats: earlierChats });

  return groups;
}

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
  onOpenWorkspaceModal: _onOpenWorkspaceModal,
  onOpenSettings,
  onNewChat,
  onOpenFileLibrary,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
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

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return sortedChats;
    const query = searchQuery.toLowerCase().trim();
    return sortedChats.filter((c) => (c.title || "").toLowerCase().includes(query));
  }, [sortedChats, searchQuery]);

  const chatGroups = useMemo(() => {
    if (searchQuery.trim()) return [];
    return groupChatsByDate(sortedChats);
  }, [sortedChats, searchQuery]);

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

  // Assistant-ui styled thread list item
  const renderChatItem = (chat: ChatItem) => {
    const isActive = chat.id === activeChatId;
    const isRenaming = renamingChatId === chat.id;

    return (
      <div
        key={chat.id}
        onClick={() => !isRenaming && onSelectChat(chat)}
        className={`group relative flex h-8.5 items-center rounded-md transition-colors cursor-pointer select-none font-normal ${
          isActive
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        }`}
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
            className="h-7 w-full mx-1 bg-white border border-zinc-300 rounded px-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900/20 shadow-2xs"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            {/* Title trigger with pe-8 on hover so title never overlaps 3 dots */}
            <div className="flex h-full min-w-0 flex-1 items-center px-2.5 text-start text-sm outline-none group-hover:pe-8 transition-[padding]">
              {chat.pinned && (
                <Pin className="size-3.5 text-zinc-400 shrink-0 me-1.5 rotate-45" />
              )}
              <span className="min-w-0 flex-1 truncate">{chat.title || "New Chat"}</span>
            </div>

            {/* Assistant-ui style 3-dots trigger button */}
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
                  <button
                    type="button"
                    className="size-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/70 transition-colors"
                    title="More options"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </button>
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
        className={`fixed md:static inset-y-0 left-0 z-40 flex flex-col bg-background-secondary select-none relative overflow-hidden shrink-0 border-r border-border ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${isResizing ? "transition-none" : "transition-[width,transform] duration-200 ease-in-out"}`}
      >
        {/* Assistant-ui Sidebar Header */}
        <div className="h-13 px-3 flex items-center justify-between shrink-0 border-b border-border overflow-hidden">
          {isOpen ? (
            <>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-2xs">
                  <LogoBadge size="sm" />
                </div>
                <div className="flex flex-col min-w-0 leading-tight">
                  <span className="text-sm font-semibold text-foreground tracking-tight truncate">
                    GraphMind
                  </span>
                  <span className="text-2xs text-foreground-muted truncate">
                    {workspaceName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onToggle}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
                title="Collapse sidebar (⌘B)"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="w-full flex items-center justify-center">
              <button
                type="button"
                onClick={onToggle}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
                title="Expand sidebar (⌘B)"
                aria-label="Expand sidebar"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Assistant-ui ThreadList Actions: New Thread & Search */}
        <div className="px-2 pt-2 pb-1 space-y-1.5 shrink-0">
          {isOpen ? (
            <>
              {onNewChat && (
                <button
                  type="button"
                  onClick={onNewChat}
                  className="h-8.5 w-full flex items-center justify-between px-2.5 rounded-xl text-xs font-medium text-foreground border border-border bg-surface hover:bg-surface-hover shadow-2xs transition-colors cursor-pointer group"
                  title="New chat (⌘N)"
                >
                  <div className="flex items-center gap-2">
                    <Plus className="w-4 h-4 text-foreground-muted group-hover:text-foreground transition-colors" />
                    <span>New Thread</span>
                  </div>
                  <kbd className="text-2xs text-foreground-muted font-sans border border-border px-1 py-0.5 rounded bg-muted group-hover:text-foreground">
                    ⌘N
                  </kbd>
                </button>
              )}

              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search threads..."
                startIcon={<Search className="w-3.5 h-3.5" />}
                inputSize="sm"
              />
            </>
          ) : (
            <div className="flex flex-col items-center gap-1">
              {onNewChat && (
                <button
                  type="button"
                  onClick={onNewChat}
                  className="size-8 rounded-md flex items-center justify-center text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/60 transition-colors cursor-pointer"
                  title="New chat (⌘N)"
                >
                  <Plus className="size-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onToggle}
                className="size-8 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60 transition-colors cursor-pointer"
                title="Search threads..."
              >
                <Search className="size-4" />
              </button>
            </div>
          )}
        </div>

        {/* Assistant-ui ThreadList Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-1 space-y-0.5">
          {isOpen ? (
            searchQuery.trim() ? (
              /* Search results mode */
              <>
                <div className="px-2.5 pt-2 pb-1 text-xs font-medium text-zinc-400">
                  Search Results
                </div>
                {filteredChats.length === 0 ? (
                  <div className="py-6 px-2.5 text-center text-sm text-zinc-400">
                    No threads found
                  </div>
                ) : (
                  filteredChats.map(renderChatItem)
                )}
              </>
            ) : (
              /* Grouped Mode (Today, Yesterday, Earlier) */
              <>
                {chatGroups.length === 0 ? (
                  <div className="py-6 px-2.5 text-center text-sm text-zinc-400">
                    No threads yet
                  </div>
                ) : (
                  chatGroups.map((group) => (
                    <div key={group.label} className="space-y-0.5 pt-2 first:pt-0">
                      <div className="px-2.5 py-1 text-xs font-medium text-zinc-400">
                        {group.label}
                      </div>
                      {group.chats.map(renderChatItem)}
                    </div>
                  ))
                )}
              </>
            )
          ) : (
            <div className="flex flex-col items-center pt-1 space-y-1">
              <button
                type="button"
                onClick={onToggle}
                className="size-8 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60 transition-colors cursor-pointer relative"
                title={`Threads (${chats.length})`}
              >
                <MessageSquare className="size-4" />
                {chats.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-blue-500" />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Assistant-ui Sidebar Footer */}
        <div className="border-t border-zinc-200/60 p-2 shrink-0 overflow-hidden space-y-0.5">
          {onOpenFileLibrary && (
            isOpen ? (
              <button
                type="button"
                onClick={onOpenFileLibrary}
                className="h-8.5 w-full flex items-center gap-2.5 px-2.5 rounded-md text-sm font-medium text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 transition-colors cursor-pointer"
                title="Workspace File Library"
              >
                <FolderOpen className="size-4 text-zinc-500 shrink-0" />
                <span className="truncate">File Library</span>
              </button>
            ) : (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={onOpenFileLibrary}
                  className="size-8 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60 transition-colors cursor-pointer"
                  title="Workspace File Library"
                >
                  <FolderOpen className="size-4" />
                </button>
              </div>
            )
          )}

          {onOpenSettings && (
            isOpen ? (
              <button
                type="button"
                onClick={onOpenSettings}
                className="h-8.5 w-full flex items-center gap-2.5 px-2.5 rounded-md text-sm font-medium text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 transition-colors cursor-pointer"
                title="Settings (⌘,)"
              >
                <Settings className="size-4 text-zinc-500 shrink-0" />
                <span className="truncate">Settings</span>
              </button>
            ) : (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="size-8 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-950 hover:bg-zinc-200/60 transition-colors cursor-pointer"
                  title="Settings (⌘,)"
                >
                  <Settings className="size-4" />
                </button>
              </div>
            )
          )}
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
