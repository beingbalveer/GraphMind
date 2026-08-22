"use client";

import React from "react";
import {
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
        className={`fixed md:static inset-y-0 left-0 z-40 flex flex-col bg-zinc-50/70 border-r border-zinc-200/70 transition-all duration-200 ease-in-out select-none ${
          isOpen
            ? "w-[260px] sm:w-[270px] translate-x-0"
            : "w-0 -translate-x-full md:w-0 md:translate-x-0 overflow-hidden border-r-0"
        }`}
      >
        {/* Sidebar Header with Workspace Badge */}
        <div className="p-2.5 border-b border-zinc-200/60 space-y-2 shrink-0 bg-white/40">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onOpenWorkspaceModal}
              className="flex items-center space-x-1.5 px-2 py-1 rounded-md hover:bg-zinc-200/60 text-zinc-700 hover:text-zinc-950 text-xs font-medium max-w-[190px] truncate transition-colors cursor-pointer"
              title="Click to switch or manage workspaces"
            >
              <FolderGit2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span className="truncate">{workspaceName}</span>
            </button>

            <Button
              variant="ghost"
              size="iconSm"
              onClick={onToggle}
              className="h-7 w-7 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 cursor-pointer"
              title="Close sidebar (⌘B)"
            >
              <PanelLeftClose className="w-4 h-4" />
            </Button>
          </div>

          {/* Quick Filter Search Input */}
          {chats.length > 4 && (
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 absolute left-2.5 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats..."
                className="w-full pl-8 pr-2.5 py-1 rounded-md border border-zinc-200/80 bg-white/80 text-xs text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-all"
              />
            </div>
          )}
        </div>

        {/* Minimalist Flat Chat List */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          <div className="px-2 pt-1 pb-1.5 text-[11px] font-medium text-zinc-400">
            Recent chats
          </div>

          {filteredChats.length === 0 ? (
            <div className="py-6 px-3 text-center text-xs text-zinc-400">
              {searchQuery ? "No matching chats" : "No chats yet"}
            </div>
          ) : (
            filteredChats.map((chat) => {
              const isActive = chat.id === activeChatId;

              return (
                <div
                  key={chat.id}
                  onClick={() => onSelectChat(chat)}
                  className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer select-none ${
                    isActive
                      ? "bg-zinc-200/80 text-zinc-950 font-medium"
                      : "text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900"
                  }`}
                >
                  <span className="truncate text-[13px] leading-snug flex-1 mr-1">
                    {chat.title || "New conversation"}
                  </span>

                  {/* Clean Delete action button appearing smoothly on hover */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteChat(chat.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-300/60 text-zinc-400 hover:text-rose-600 transition-all cursor-pointer shrink-0"
                    title="Delete chat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="px-3 py-2.5 border-t border-zinc-200/60 bg-white/20 text-[11px] text-zinc-400 flex items-center justify-between shrink-0">
          <span>{chats.length} conversation{chats.length === 1 ? "" : "s"}</span>
          <span className="font-mono text-[10px] text-zinc-400">GraphMind</span>
        </div>
      </aside>
    </>
  );
}
