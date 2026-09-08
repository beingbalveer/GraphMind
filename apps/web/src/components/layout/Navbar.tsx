"use client";

import React from "react";
import {
  MessageSquare,
  LayoutGrid,
  PanelLeft,
  PanelRight,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { LogoBadge } from "@/components/ui/Logo";
import { UserMenu } from "@/components/layout/UserMenu";

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
  isRightSidebarOpen?: boolean;
  onToggleRightSidebar?: () => void;
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
  isSidebarOpen = false,
  onToggleSidebar,
  isRightSidebarOpen = false,
  onToggleRightSidebar,
  onNewChat: _onNewChat,
}: NavbarProps) {
  return (
    <header className="h-13 bg-surface text-foreground px-3 sm:px-5 flex items-center justify-between z-30 shrink-0 select-none border-b border-border">
      {/* Top Left: Sidebar Toggle + Workspace Switcher */}
      <div className="flex items-center gap-2 shrink-0">
        {!isSidebarOpen && onToggleSidebar && (
          <Button
            variant="ghost"
            size="iconSm"
            onClick={onToggleSidebar}
            className="-ml-1"
            title="Open sidebar (⌘B)"
            aria-label="Open sidebar"
          >
            <PanelLeft className="w-4 h-4" />
          </Button>
        )}

        {onOpenWorkspaceModal ? (
          <button
            type="button"
            onClick={onOpenWorkspaceModal}
            className="flex items-center gap-1.5 px-2 py-1 rounded-xl hover:bg-surface-hover text-foreground text-xs font-semibold max-w-[200px] sm:max-w-[240px] truncate transition-colors cursor-pointer group"
            title="Click to switch or manage workspaces"
            aria-label="Switch or manage workspaces"
          >
            <LogoBadge size="sm" />
            <span className="truncate">{workspaceName}</span>
            <ChevronDown className="w-3 h-3 text-foreground-muted group-hover:text-foreground transition-colors shrink-0" />
          </button>
        ) : (
          <Link
            href="/"
            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
          >
            <LogoBadge size="sm" />
            <span className="font-semibold text-foreground text-sm tracking-tight hidden sm:inline">
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
      <div className="flex items-center gap-2 shrink-0">
        {/* Toggle Mode Segmented Tabs */}
        {onViewModeChange && (
          <SegmentedTabs
            value={viewMode}
            onChange={(val) => onViewModeChange(val as ViewMode)}
            size="sm"
            items={[
              { id: "chat", label: "Chat", icon: MessageSquare },
              { id: "canvas", label: "Canvas", icon: LayoutGrid },
            ]}
          />
        )}

        {/* Right Sidebar Toggle */}
        {onToggleRightSidebar && (
          <Button
            variant="ghost"
            size="iconSm"
            onClick={onToggleRightSidebar}
            className={`h-8 w-8 cursor-pointer transition-colors ${
              isRightSidebarOpen
                ? "text-zinc-950 bg-zinc-100"
                : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100"
            }`}
            title="Toggle right panel"
            aria-label="Toggle right panel"
          >
            <PanelRight className="w-4 h-4 stroke-[1.75]" />
          </Button>
        )}

        {/* User Profile / Logout Dropdown */}
        <UserMenu />
      </div>
    </header>
  );
}
