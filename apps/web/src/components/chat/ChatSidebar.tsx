"use client";

import React from "react";
import {
  MessageSquare,
  Trash2,
  PanelLeftClose,
  Search,
  FolderGit2,
} from "lucide-react";
import { ChatItem } from "@/lib/workspaceApi";
import { Button } from "@/components/ui/button";

interface ChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  workspaceName: string;
  chats: ChatItem[];
  activeChatId: string | null;
  onSelectChat: (chat: ChatItem) => void;
  onDeleteChat: (id: string) => void;
  onOpenWorkspaceModal?: () => void;
}

export function ChatSidebar({
  isOpen,
  onToggle,
  workspaceName,
  chats,
  activeChatId,
  onSelectChat,
  onDeleteChat,
  onOpenWorkspaceModal,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = React.useState("");

  const filteredChats = React.useMemo(() => {
    if (!searchQuery.trim()) return chats;
    const q = searchQuery.toLowerCase().trim();
    return chats.filter((c) => c.title.toLowerCase().includes(q));
  }, [chats, searchQuery]);

  // Format relative timestamp
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 2) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return "";
    }
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

      {/* Collapsible Left Sidebar Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 flex flex-col bg-zinc-50 border-r border-zinc-200/90 transition-all duration-200 ease-in-out select-none ${
          isOpen
            ? "w-[260px] sm:w-[280px] translate-x-0"
            : "w-0 -translate-x-full md:w-0 md:translate-x-0 overflow-hidden border-r-0"
        }`}
      >
        {/* Sidebar Header with Workspace Badge */}
        <div className="p-3 border-b border-zinc-200/80 space-y-2 shrink-0 bg-white/80">
          {/* Workspace Switcher Header Pill */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onOpenWorkspaceModal}
              className="flex items-center space-x-1.5 px-2 py-1 rounded-lg bg-zinc-100/90 hover:bg-zinc-200/80 text-zinc-800 hover:text-zinc-950 text-xs font-semibold max-w-[190px] truncate transition-colors cursor-pointer"
              title="Click to switch or create workspaces"
            >
              <FolderGit2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span className="truncate">{workspaceName}</span>
            </button>

            <Button
              variant="ghost"
              size="iconSm"
              onClick={onToggle}
              className="h-7 w-7 text-zinc-500 hover:text-zinc-950 cursor-pointer"
              title="Close sidebar (⌘B)"
            >
              <PanelLeftClose className="w-4 h-4" />
            </Button>
          </div>

          {/* Quick Filter Search Input */}
          {chats.length > 4 && (
            <div className="relative flex items-center pt-0.5">
              <Search className="w-3.5 h-3.5 absolute left-2.5 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats in workspace..."
                className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>
          )}
        </div>

        {/* Chat History List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          <div className="px-2 py-1 text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
            Workspace Chats
          </div>

          {filteredChats.length === 0 ? (
            <div className="p-4 text-center text-xs text-zinc-400">
              {searchQuery ? "No matching chats found" : "No chats in this workspace yet"}
            </div>
          ) : (
            filteredChats.map((chat) => {
              const isActive = chat.id === activeChatId;

              return (
                <div
                  key={chat.id}
                  onClick={() => onSelectChat(chat)}
                  className={`group relative flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                    isActive
                      ? "bg-white text-zinc-950 font-semibold border border-zinc-200/90 shadow-2xs"
                      : "text-zinc-700 hover:bg-zinc-200/60 hover:text-zinc-950"
                  }`}
                >
                  <div className="flex items-center space-x-2 min-w-0 pr-1">
                    <MessageSquare
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? "text-zinc-900" : "text-zinc-400 group-hover:text-zinc-600"
                      }`}
                    />
                    <div className="min-w-0">
                      <span className="truncate block leading-snug">
                        {chat.title || "Untitled Chat"}
                      </span>
                      <div className="flex items-center space-x-1 text-[10px] text-zinc-400 font-normal">
                        <span>{formatTime(chat.updatedAt)}</span>
                        {chat.nodeCount > 1 && (
                          <>
                            <span>•</span>
                            <span>{chat.nodeCount} msgs</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Delete button visible on hover */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteChat(chat.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-zinc-300/60 text-zinc-400 hover:text-rose-600 transition-opacity cursor-pointer shrink-0"
                    title="Delete chat"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-zinc-200/80 bg-white/50 text-[11px] text-zinc-400 flex items-center justify-between shrink-0">
          <span>{chats.length} chat{chats.length === 1 ? "" : "s"}</span>
          <span className="font-mono text-[10px]">GraphMind</span>
        </div>
      </aside>
    </>
  );
}
