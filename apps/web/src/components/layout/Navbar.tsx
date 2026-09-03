"use client";

import React from "react";
import {
  MessageSquare,
  LayoutGrid,
  PanelLeft,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogoBadge } from "@/components/ui/Logo";

export type ViewMode = "chat" | "canvas";

interface NavbarProps {
  onClearChat?: () => void;
  messageCount?: number;
  breadcrumbs?: React.ReactNode;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  workspaceName?: string;
  onOpenWorkspaceModal?: () => void;
  onOpenModelConfig?: () => void;
  onOpenFileLibrary?: () => void;
  activeModelName?: string;
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
  onOpenModelConfig: _onOpenModelConfig,
  onOpenFileLibrary: _onOpenFileLibrary,
  activeModelName: _activeModelName = "gemini-2.5-flash",
  syncStatus: _syncStatus = "saved",
  isSidebarOpen: _isSidebarOpen = false,
  onToggleSidebar,
  onNewChat: _onNewChat,
}: NavbarProps) {
  return (
    <header className="h-13 border-b border-zinc-200/80 bg-white px-3 sm:px-5 flex items-center justify-between z-30 shrink-0 select-none">
      {/* Top Left: Sidebar Toggle + Workspace Switcher */}
      <div className="flex items-center space-x-2 shrink-0">
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="iconSm"
            onClick={onToggleSidebar}
            className="h-8 w-8 text-zinc-600 hover:text-zinc-950 cursor-pointer -ml-1"
            title="Toggle sidebar (⌘B)"
          >
            <PanelLeft className="w-4 h-4" />
          </Button>
        )}

        {onOpenWorkspaceModal ? (
          <button
            type="button"
            onClick={onOpenWorkspaceModal}
            className="flex items-center space-x-1.5 px-2 py-1 rounded-xl hover:bg-zinc-100 text-zinc-900 text-xs font-semibold max-w-[200px] sm:max-w-[240px] truncate transition-colors cursor-pointer group"
            title="Click to switch or manage workspaces"
          >
            <LogoBadge size="sm" />
            <span className="truncate">{workspaceName}</span>
            <ChevronDown className="w-3 h-3 text-zinc-400 group-hover:text-zinc-700 transition-colors shrink-0" />
          </button>
        ) : (
          <Link
            href="/"
            className="flex items-center space-x-1.5 hover:opacity-80 transition-opacity"
          >
            <LogoBadge size="sm" />
            <span className="font-semibold text-zinc-950 text-[13.5px] tracking-tight hidden sm:inline">
              {workspaceName}
            </span>
          </Link>
        )}
      </div>

      {/* Center: Branch Breadcrumbs */}
      <div className="hidden sm:flex items-center justify-center flex-1 mx-2 sm:mx-4 min-w-0">
        {breadcrumbs}
      </div>


      {/* Right: View Mode Toggle */}
      <div className="flex items-center space-x-2 shrink-0">
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
      </div>
    </header>
  );
}
