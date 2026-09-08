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
  SquarePen,
  PanelLeftClose,
  PanelLeft,
  FolderOpen,
  MessageSquare,
} from "lucide-react";
import { ChatItem } from "@/lib/workspaceApi";
import { LogoBadge } from "@/components/ui/Logo";
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

interface ChatGroup {
  label: string;
  chats: ChatItem[];
}

function groupChatsByDate(chats: ChatItem[]): ChatGroup[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const startOfLast7Days = startOfToday - 7 * 86400000;
  const startOfLast30Days = startOfToday - 30 * 86400000;

  const pinned: ChatItem[] = [];
  const todayChats: ChatItem[] = [];
  const yesterdayChats: ChatItem[] = [];
  const prev7Chats: ChatItem[] = [];
  const prev30Chats: ChatItem[] = [];
  const olderChats: ChatItem[] = [];

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
    } else if (time >= startOfLast7Days) {
      prev7Chats.push(chat);
    } else if (time >= startOfLast30Days) {
      prev30Chats.push(chat);
    } else {
      olderChats.push(chat);
    }
  }

  const groups: ChatGroup[] = [];
  if (pinned.length > 0) groups.push({ label: "Pinned", chats: pinned });
  if (todayChats.length > 0) groups.push({ label: "Today", chats: todayChats });
  if (yesterdayChats.length > 0) groups.push({ label: "Yesterday", chats: yesterdayChats });
  if (prev7Chats.length > 0) groups.push({ label: "Previous 7 Days", chats: prev7Chats });
  if (prev30Chats.length > 0) groups.push({ label: "Previous 30 Days", chats: prev30Chats });
  if (olderChats.length > 0) groups.push({ label: "Older", chats: olderChats });

  return groups;
}

export function ChatSidebar({
  isOpen,
  onToggle,
  workspaceName: _workspaceName = "Main Workspace",
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

  // Auto-focus rename input when it appears
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

  // Render a single chat row item
  const renderChatItem = (chat: ChatItem) => {
    const isActive = chat.id === activeChatId;
    const isRenaming = renamingChatId === chat.id;

    return (
      <div
        key={chat.id}
        onClick={() => !isRenaming && onSelectChat(chat)}
        className={`group relative flex items-center justify-between px-2.5 py-2 rounded-lg text-sm transition-colors cursor-pointer select-none ${
          isActive
            ? "bg-zinc-200/80 text-zinc-950 font-medium"
            : "text-zinc-750 hover:bg-zinc-200/50 hover:text-zinc-950"
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
            className="w-full bg-white border border-zinc-300 rounded-md px-2 py-0.5 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900/20 shadow-2xs"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            <div className="flex items-center space-x-2 min-w-0 pr-1 flex-1">
              {chat.pinned && (
                <Pin className="w-3.5 h-3.5 text-zinc-400 shrink-0 rotate-45" />
              )}
              <span className="truncate leading-tight">{chat.title || "Untitled Chat"}</span>
            </div>

            {/* Action Menu Trigger Button (ChatGPT-style 3 dots on hover) */}
            <div
              className={`shrink-0 transition-opacity ${
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
                    className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/80 transition-colors"
                    title="Chat options"
                  >
                    <MoreHorizontal className="w-4 h-4" />
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
                      <PinOff className="w-3.5 h-3.5" />
                    ) : (
                      <Pin className="w-3.5 h-3.5" />
                    ),
                    onClick: () => onTogglePinChat?.(chat.id, !chat.pinned),
                  },
                  {
                    label: "Rename",
                    icon: <Pencil className="w-3.5 h-3.5" />,
                    onClick: () => startRename(chat),
                  },
                  {
                    label: "Delete",
                    icon: <Trash2 className="w-3.5 h-3.5" />,
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
        className={`fixed md:static inset-y-0 left-0 z-40 flex flex-col bg-[#f9f9f9] select-none relative overflow-hidden shrink-0 border-r border-zinc-200/80 ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${isResizing ? "transition-none" : "transition-[width,transform] duration-200 ease-in-out"}`}
      >
        {/* Top Header: Unified Seamless Header */}
        <div className="h-13 px-3.5 flex items-center justify-between shrink-0 overflow-hidden">
          {isOpen ? (
            <>
              <div className="flex items-center space-x-2.5 min-w-0">
                <LogoBadge size="sm" />
                <span className="text-sm font-semibold text-zinc-900 truncate tracking-tight">
                  GraphMind
                </span>
              </div>
              <div className="flex items-center space-x-0.5 shrink-0">
                {onNewChat && (
                  <button
                    type="button"
                    onClick={onNewChat}
                    className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/60 transition-colors cursor-pointer"
                    title="New chat (⌘N)"
                    aria-label="New chat"
                  >
                    <SquarePen className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onToggle}
                  className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/60 transition-colors cursor-pointer"
                  title="Close sidebar (⌘B)"
                  aria-label="Close sidebar"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="w-full flex items-center justify-center">
              <button
                type="button"
                onClick={onToggle}
                className="p-2 rounded-lg text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/60 transition-colors cursor-pointer"
                title="Open sidebar (⌘B)"
                aria-label="Open sidebar"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Search row */}
        {isOpen ? (
          <div className="px-3 pb-1 shrink-0">
            <div className="relative flex items-center bg-zinc-200/40 hover:bg-zinc-200/60 focus-within:bg-white rounded-lg border border-transparent focus-within:border-zinc-300 focus-within:ring-1 focus-within:ring-zinc-900/10 transition-all">
              <Search className="w-3.5 h-3.5 absolute left-2.5 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats..."
                className="w-full pl-8 pr-2.5 py-1.5 bg-transparent text-xs text-zinc-800 placeholder:text-zinc-400 focus:outline-none"
              />
            </div>
          </div>
        ) : (
          <div className="p-1 flex justify-center shrink-0">
            <button
              type="button"
              onClick={onToggle}
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60 transition-colors cursor-pointer"
              title="Search chats..."
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Prominent New Chat Row (ChatGPT Style) */}
        {isOpen ? (
          <div className="px-2 pt-1 pb-1 shrink-0">
            {onNewChat && (
              <button
                type="button"
                onClick={onNewChat}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm font-medium text-zinc-800 hover:bg-zinc-200/60 transition-colors cursor-pointer group"
                title="New chat (⌘N)"
              >
                <div className="flex items-center gap-2.5">
                  <SquarePen className="w-4 h-4 text-zinc-600 group-hover:text-zinc-950 transition-colors" />
                  <span>New chat</span>
                </div>
                <kbd className="text-[10px] text-zinc-400 font-sans group-hover:text-zinc-600">⌘N</kbd>
              </button>
            )}
          </div>
        ) : (
          onNewChat && (
            <div className="flex justify-center shrink-0 py-0.5">
              <button
                type="button"
                onClick={onNewChat}
                className="p-2 rounded-lg text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/60 transition-colors cursor-pointer"
                title="New chat (⌘N)"
              >
                <SquarePen className="w-4 h-4" />
              </button>
            </div>
          )
        )}

        {/* Middle Area: Chronological Conversations List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-1 space-y-1">
          {isOpen ? (
            searchQuery.trim() ? (
              /* Search results mode */
              <>
                <div className="px-2.5 pt-2 pb-1 text-xs font-semibold text-zinc-400">
                  Search Results
                </div>
                {filteredChats.length === 0 ? (
                  <div className="py-8 px-3 text-center text-xs text-zinc-400">
                    No matching chats
                  </div>
                ) : (
                  filteredChats.map(renderChatItem)
                )}
              </>
            ) : (
              /* Chronologically Grouped Conversations (Today, Yesterday, 7 Days, Older) */
              <>
                {chatGroups.length === 0 ? (
                  <div className="py-8 px-3 text-center text-xs text-zinc-400">
                    No chats yet
                  </div>
                ) : (
                  chatGroups.map((group) => (
                    <div key={group.label} className="space-y-0.5 pt-2 first:pt-0">
                      <div className="px-2.5 py-1 text-xs font-semibold text-zinc-400">
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
                className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60 transition-colors cursor-pointer relative"
                title={`Conversations (${chats.length})`}
              >
                <MessageSquare className="w-4 h-4" />
                {chats.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-blue-500" />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Sidebar Footer: Library & Settings Docked at Bottom */}
        <div className="border-t border-zinc-200/70 p-2 shrink-0 overflow-hidden space-y-0.5">
          {onOpenFileLibrary && (
            isOpen ? (
              <button
                type="button"
                onClick={onOpenFileLibrary}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium text-zinc-700 hover:text-zinc-950 hover:bg-zinc-200/60 transition-colors cursor-pointer"
                title="Workspace File Library"
              >
                <FolderOpen className="w-4 h-4 text-zinc-500 shrink-0" />
                <span className="truncate">Library</span>
              </button>
            ) : (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={onOpenFileLibrary}
                  className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60 transition-colors cursor-pointer"
                  title="Workspace File Library"
                >
                  <FolderOpen className="w-4 h-4" />
                </button>
              </div>
            )
          )}

          {onOpenSettings && (
            isOpen ? (
              <button
                type="button"
                onClick={onOpenSettings}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium text-zinc-700 hover:text-zinc-950 hover:bg-zinc-200/60 transition-colors cursor-pointer"
                title="Settings & Model Configuration (⌘,)"
              >
                <Settings className="w-4 h-4 text-zinc-500 shrink-0" />
                <span className="truncate">Settings</span>
              </button>
            ) : (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="p-2 rounded-lg text-zinc-500 hover:text-zinc-950 hover:bg-zinc-200/60 transition-colors cursor-pointer"
                  title="Settings & Model Configuration (⌘,)"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            )
          )}
        </div>

        {/* Right-Edge Transparent Drag Handle for Resizing */}
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
