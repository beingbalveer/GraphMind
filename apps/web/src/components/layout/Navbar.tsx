"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  MessageSquare,
  LayoutGrid,
  FolderGit2,
  Check,
  RotateCw,
  PanelLeft,
  PanelLeftClose,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type ViewMode = "chat" | "canvas";

interface NavbarProps {
  onClearChat?: () => void;
  messageCount: number;
  breadcrumbs?: React.ReactNode;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  workspaceName?: string;
  onOpenWorkspaceModal?: () => void;
  syncStatus?: "saved" | "syncing" | "offline";
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onNewChat?: () => void;
}

export function Navbar({
  onClearChat: _onClearChat,
  messageCount: _messageCount,
  breadcrumbs,
  viewMode = "chat",
  onViewModeChange,
  workspaceName = "Main Workspace",
  onOpenWorkspaceModal,
  syncStatus = "saved",
  isSidebarOpen = false,
  onToggleSidebar,
  onNewChat,
}: NavbarProps) {
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8008";
        const res = await fetch(`${apiUrl}/healthz`, { method: "GET" });
        setApiOnline(res.ok);
      } catch {
        setApiOnline(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-13 border-b border-zinc-200/80 bg-white/80 backdrop-blur-md px-3 sm:px-5 flex items-center justify-between z-30 shrink-0 select-none">
      {/* Left: Sidebar Toggle + Brand + Workspace Selector */}
      <div className="flex items-center space-x-2 shrink-0">
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="iconSm"
            onClick={onToggleSidebar}
            className="h-8 w-8 text-zinc-600 hover:text-zinc-950 cursor-pointer"
            title={isSidebarOpen ? "Close sidebar (⌘B)" : "Open chats sidebar (⌘B)"}
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeft className="w-4 h-4" />
            )}
          </Button>
        )}

        <div className="w-6 h-6 rounded-md bg-zinc-900 text-white flex items-center justify-center font-bold text-xs shadow-xs">
          🧠
        </div>
        <div className="flex items-center space-x-1">
          <span className="font-semibold text-zinc-900 text-sm tracking-tight hidden sm:inline">
            GraphMind
          </span>
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              apiOnline === true
                ? "bg-emerald-500"
                : apiOnline === false
                ? "bg-rose-500"
                : "bg-zinc-400 animate-pulse"
            }`}
            title={apiOnline ? "PostgreSQL & FastAPI Connected" : "Connecting to backend..."}
          />
        </div>

        {/* Workspace Selector Pill */}
        {onOpenWorkspaceModal && (
          <button
            type="button"
            onClick={onOpenWorkspaceModal}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-zinc-100/90 border border-zinc-200/80 text-xs font-medium text-zinc-800 hover:bg-zinc-200/80 hover:text-zinc-950 transition-colors cursor-pointer ml-1"
            title="Switch or manage workspaces"
          >
            <FolderGit2 className="w-3.5 h-3.5 text-zinc-500" />
            <span className="max-w-[140px] truncate">{workspaceName}</span>
          </button>
        )}

        {/* Sync Status Badge */}
        <div
          className="hidden md:flex items-center space-x-1 text-[11px] text-zinc-400 pl-1"
          title={
            syncStatus === "syncing"
              ? "Syncing graph changes to PostgreSQL database..."
              : "All graph nodes persisted to PostgreSQL"
          }
        >
          {syncStatus === "syncing" ? (
            <>
              <RotateCw className="w-3 h-3 animate-spin text-zinc-500" />
              <span>Syncing...</span>
            </>
          ) : syncStatus === "offline" ? (
            <span className="text-amber-500">Offline</span>
          ) : (
            <>
              <Check className="w-3 h-3 text-emerald-500" />
              <span>Saved</span>
            </>
          )}
        </div>
      </div>

      {/* Center: Branch Breadcrumbs */}
      <div className="hidden lg:flex items-center justify-center flex-1 mx-4 min-w-0">
        {breadcrumbs}
      </div>

      {/* Right: Clean Light New Chat Button + View Mode Toggle */}
      <div className="flex items-center space-x-2.5 shrink-0">
        {/* Toggle Mode Pill Button */}
        {onViewModeChange && (
          <div className="flex items-center p-0.5 bg-zinc-100 border border-zinc-200/80 rounded-lg shadow-2xs">
            <button
              type="button"
              onClick={() => onViewModeChange("chat")}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                viewMode === "chat"
                  ? "bg-white text-zinc-950 shadow-2xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Chat</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("canvas")}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                viewMode === "canvas"
                  ? "bg-white text-zinc-950 shadow-2xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Canvas</span>
            </button>
          </div>
        )}

        {/* Top Right Clean Light New Chat Button (At the very last position) */}
        {onNewChat && (
          <button
            type="button"
            onClick={onNewChat}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-zinc-200/90 bg-white hover:bg-zinc-50 hover:border-zinc-300 text-zinc-700 hover:text-zinc-950 text-xs font-medium shadow-2xs transition-all cursor-pointer group"
            title="Start a new chat (⌘N)"
          >
            <Plus className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-900 transition-colors" />
            <span className="font-semibold">New chat</span>
          </button>
        )}
      </div>
    </header>
  );
}
