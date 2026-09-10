"use client";

import React from "react";
import {
  MessageSquare,
  LayoutGrid,
  PanelLeft,
  PanelRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { cn } from "@/lib/utils";

export type ViewMode = "chat" | "canvas";

export interface MainHeaderProps {
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  workspaceName?: string;
  onOpenWorkspaceModal?: () => void;
  breadcrumbs?: React.ReactNode;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  isRightSidebarOpen?: boolean;
  onToggleRightSidebar?: () => void;
  className?: string;

  // Optional legacy / convenience props
  onClearChat?: () => void;
  messageCount?: number;
  onOpenModelConfig?: () => void;
  onOpenFileLibrary?: () => void;
  activeModelName?: string;
  syncStatus?: "saved" | "syncing" | "offline";
  onNewChat?: () => void;
}

/**
 * MainHeader — Canonical 52px top bar for the workspace shell.
 * Houses sidebar toggle, workspace identity, breadcrumbs, mode switching (Chat ↔ Canvas),
 * and contextual rail disclosure.
 */
export function MainHeader({
  viewMode = "chat",
  onViewModeChange,
  workspaceName = "Main Workspace",
  onOpenWorkspaceModal,
  breadcrumbs,
  isSidebarOpen = true,
  onToggleSidebar,
  isRightSidebarOpen = false,
  onToggleRightSidebar,
  className,
}: MainHeaderProps) {
  return (
    <header
      data-testid="main-header"
      className={cn(
        "h-13 bg-surface text-foreground px-3 sm:px-4 flex items-center justify-between z-30 shrink-0 select-none border-b border-border",
        className
      )}
    >
      {/* Left Zone: Sidebar toggle (when collapsed or on mobile) & Workspace identity */}
      <div className="flex items-center gap-2 shrink-0 min-w-0">
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="iconSm"
            onClick={onToggleSidebar}
            className={cn(
              "text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors shrink-0",
              isSidebarOpen ? "md:hidden" : "flex"
            )}
            title={isSidebarOpen ? "Collapse sidebar (⌘B)" : "Expand sidebar (⌘B)"}
            aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <PanelLeft className="w-4 h-4" />
          </Button>
        )}

        {workspaceName && (
          <div className="flex items-center min-w-0">
            {onOpenWorkspaceModal ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenWorkspaceModal}
                className="h-8 px-2 text-sm font-semibold text-foreground hover:bg-surface-hover tracking-tight truncate max-w-[180px] shadow-none"
                title={`Workspace: ${workspaceName}`}
                aria-label={`Current workspace: ${workspaceName}`}
              >
                <span className="truncate">{workspaceName}</span>
              </Button>
            ) : (
              <span
                className="text-sm font-semibold text-foreground tracking-tight truncate max-w-[180px] px-2 py-1"
                title={`Workspace: ${workspaceName}`}
              >
                {workspaceName}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Center Zone: Branch / Context Breadcrumbs */}
      <div className="hidden sm:flex items-center justify-center flex-1 mx-2 sm:mx-4 min-w-0">
        {breadcrumbs}
      </div>

      {/* Right Zone: Mode Switcher (Chat ↔ Canvas) & Contextual Rail Control */}
      <div className="flex items-center gap-2 shrink-0">
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

        {onToggleRightSidebar && (
          <Button
            variant="ghost"
            size="iconSm"
            onClick={onToggleRightSidebar}
            className={cn(
              "text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer shrink-0",
              isRightSidebarOpen && "bg-surface-hover text-foreground"
            )}
            title={isRightSidebarOpen ? "Collapse right panel" : "Open right panel"}
            aria-label={isRightSidebarOpen ? "Collapse right panel" : "Open right panel"}
          >
            <PanelRight className="w-4 h-4 stroke-[1.75]" />
          </Button>
        )}
      </div>
    </header>
  );
}

// Backward-compatible alias
export { MainHeader as Navbar };
