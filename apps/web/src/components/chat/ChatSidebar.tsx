"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Search,
  MoreVertical,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  Settings,
  Plus,
  FolderOpen,
  MessageSquare,
} from "lucide-react";
import { ChatItem } from "@/lib/workspaceApi";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { safeGetItem, safeSetItem } from "@/lib/storage";

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
const MIN_WIDTH = 180;
const MAX_WIDTH = 480;

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
  // Track which chat's dropdown is open so we keep the button visible while open
  const [openMenuChatId, setOpenMenuChatId] = useState<string | null>(null);

  // Resizable sidebar width with local storage persistence
  const [width, setWidth] = useState<number>(() => {
    const saved = safeGetItem("graphmind_sidebar_width_v1");
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
        return parsed;
      }
    }
    return DEFAULT_WIDTH;
  });

  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    isResizingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = Math.min(Math.max(e.clientX, MIN_WIDTH), MAX_WIDTH);
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        setIsResizing(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        safeSetItem("graphmind_sidebar_width_v1", width.toString());
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [width]);

  const filteredChats = useMemo(() => {
    const list = !searchQuery.trim()
      ? chats
      : chats.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase().trim()));
    return [...list].sort((a, b) => {
      const aPinned = a.pinned ? 1 : 0;
      const bPinned = b.pinned ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [chats, searchQuery]);


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
        className={`fixed md:static inset-y-0 left-0 z-40 flex flex-col bg-white border-r border-zinc-200/80 select-none relative overflow-hidden ${
          isOpen
            ? "translate-x-0"
            : "-translate-x-full md:translate-x-0"
        } ${isResizing ? "transition-none" : "transition-[width,transform] duration-200 ease-in-out"}`}
      >
        {/* Top Header: Search row */}
        <div className="h-12 border-b border-zinc-100 flex items-center shrink-0 bg-white overflow-hidden">
          <div
            className="w-14 h-12 flex items-center justify-center shrink-0 cursor-pointer"
            onClick={() => {
              if (!isOpen) onToggle();
            }}
            title="Search chats..."
          >
            <Search className="w-4 h-4 text-zinc-400 hover:text-zinc-700 transition-colors shrink-0" />
          </div>

          <div
            className={`flex-1 pr-3 transition-opacity duration-200 ${
              isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full py-1.5 px-2.5 rounded-lg border border-zinc-200/80 bg-zinc-50/60 text-xs text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-zinc-900 transition-all shadow-2xs"
            />
          </div>
        </div>

        {/* Quick Navigation Items: New Chat & Library */}
        <div className="py-1.5 border-b border-zinc-100 space-y-0.5 shrink-0 overflow-hidden">
          {onNewChat && (
            <button
              type="button"
              onClick={onNewChat}
              className="w-full flex items-center h-10 hover:bg-zinc-100/70 transition-colors cursor-pointer text-zinc-700 hover:text-zinc-950 group relative"
              title="New chat (⌘N)"
            >
              <div className="w-14 h-10 flex items-center justify-center shrink-0">
                <Plus className="w-4 h-4 text-zinc-500 group-hover:text-zinc-900 transition-colors shrink-0" />
              </div>
              <span
                className={`text-xs font-medium truncate transition-opacity duration-200 whitespace-nowrap ${
                  isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              >
                New chat
              </span>
            </button>
          )}

          {onOpenFileLibrary && (
            <button
              type="button"
              onClick={onOpenFileLibrary}
              className="w-full flex items-center h-10 hover:bg-zinc-100/70 transition-colors cursor-pointer text-zinc-700 hover:text-zinc-950 group relative"
              title="Workspace File Library & Assets"
            >
              <div className="w-14 h-10 flex items-center justify-center shrink-0">
                <FolderOpen className="w-4 h-4 text-zinc-500 group-hover:text-zinc-900 transition-colors shrink-0" />
              </div>
              <span
                className={`text-xs font-medium truncate transition-opacity duration-200 whitespace-nowrap ${
                  isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              >
                Library
              </span>
            </button>
          )}
        </div>

        {/* Middle Area: Conversations */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-1 space-y-1">
          {isOpen ? (
            <>
              <div className="px-3 pt-2 pb-1 text-[11px] font-medium text-zinc-400 tracking-wider uppercase">
                Conversations
              </div>

              {filteredChats.length === 0 ? (
                <div className="py-8 px-3 text-center text-xs text-zinc-400">
                  {searchQuery ? "No matching chats" : "No chats yet"}
                </div>
              ) : (
                filteredChats.map((chat) => {
                  const isActive = chat.id === activeChatId;
                  const isRenaming = renamingChatId === chat.id;

                  return (
                    <div
                      key={chat.id}
                      onClick={() => !isRenaming && onSelectChat(chat)}
                      className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer select-none ${
                        isActive
                          ? "bg-[#F1F6FE] text-zinc-950 font-medium"
                          : "text-zinc-600 hover:bg-zinc-100/60 hover:text-zinc-950"
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
                          className="w-full bg-white border border-zinc-300 rounded px-1.5 py-0.5 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <>
                          <div className="flex items-center space-x-2 min-w-0 pr-1">
                            {chat.pinned && (
                              <Pin className="w-3 h-3 text-zinc-400 shrink-0 rotate-45" />
                            )}
                            <span className="truncate">{chat.title || "Untitled Chat"}</span>
                          </div>

                          {/* Action Menu Trigger Button */}
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
                                  className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 transition-colors"
                                  title="Chat options"
                                >
                                  <MoreVertical className="w-3.5 h-3.5" />
                                </button>
                              }
                              onOpenChange={(isOpen) =>
                                setOpenMenuChatId(isOpen ? chat.id : null)
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
                })
              )}
            </>
          ) : (
            <div className="flex flex-col items-center pt-1">
              <button
                type="button"
                onClick={onToggle}
                className="w-14 h-10 flex items-center justify-center text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100/80 transition-colors cursor-pointer relative group"
                title={`Conversations (${chats.length})`}
              >
                <MessageSquare className="w-4 h-4 text-zinc-400 group-hover:text-zinc-800 transition-colors" />
                {chats.length > 0 && (
                  <span className="absolute top-2.5 right-4 w-1.5 h-1.5 rounded-full bg-blue-500" />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Sidebar Footer: Settings */}
        <div className="h-12 border-t border-zinc-100 bg-white flex items-center shrink-0 overflow-hidden">
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="w-full flex items-center h-10 hover:bg-zinc-100/70 transition-colors cursor-pointer text-zinc-700 hover:text-zinc-950 group relative"
              title="Settings & Model Configuration (⌘,)"
            >
              <div className="w-14 h-10 flex items-center justify-center shrink-0">
                <Settings className="w-4 h-4 text-zinc-500 group-hover:text-zinc-900 transition-colors shrink-0" />
              </div>
              <span
                className={`text-xs font-medium truncate transition-opacity duration-200 whitespace-nowrap ${
                  isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              >
                Settings
              </span>
            </button>
          )}
        </div>

        {/* Right-Edge Transparent Drag Handle for Resizing */}
        {isOpen && (
          <div
            onMouseDown={startResizing}
            onDoubleClick={() => {
              setWidth(DEFAULT_WIDTH);
              safeSetItem("graphmind_sidebar_width_v1", DEFAULT_WIDTH.toString());
            }}
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

