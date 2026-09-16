"use client";

import React from "react";
import {
  MessageSquare,
  LayoutGrid,
  PanelRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ViewMode = "chat" | "canvas" | "library" | "settings";

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
  workspaceName: _workspaceName,
  onOpenWorkspaceModal: _onOpenWorkspaceModal,
  breadcrumbs,
  isSidebarOpen: _isSidebarOpen = true,
  onToggleSidebar: _onToggleSidebar,
  isRightSidebarOpen = false,
  onToggleRightSidebar,
  className,
}: MainHeaderProps) {
  return (
    <header
      data-testid="main-header"
      className={cn(
        "h-[47px] bg-surface text-foreground px-3 sm:px-4 flex items-center justify-between z-30 shrink-0 select-none border-b border-border",
        className
      )}
    >
      <div className="min-w-0 flex-1" />

      {/* Center Zone: Branch / Context Breadcrumbs */}
      <div className="hidden sm:flex items-center justify-center flex-1 mx-2 sm:mx-4 min-w-0">
        {breadcrumbs}
      </div>

      {/* Right Zone: Mode Switcher (Chat ↔ Canvas) & Contextual Rail Control */}
      <div className="flex items-center gap-2 shrink-0">
        {onViewModeChange && (
          <div className="flex items-center gap-2" aria-label="View mode">
            <Button
              variant="outline"
              size="sm"
              aria-pressed={viewMode === "chat"}
              onClick={() => onViewModeChange("chat")}
              className={cn(
                "h-8 px-3 text-xs",
                viewMode === "chat"
                  ? "border-border-strong bg-muted text-foreground hover:bg-muted"
                  : "border-transparent bg-transparent text-foreground-muted"
              )}
            >
              <MessageSquare className="size-3.5" />
              Chat
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-pressed={viewMode === "canvas"}
              onClick={() => onViewModeChange("canvas")}
              className={cn(
                "h-8 px-3 text-xs",
                viewMode === "canvas"
                  ? "border-border-strong bg-muted text-foreground hover:bg-muted"
                  : "border-transparent bg-transparent text-foreground-muted"
              )}
            >
              <LayoutGrid className="size-3.5" />
              Canvas
            </Button>
          </div>
        )}

        {onToggleRightSidebar && (
          <Button
            variant="ghost"
            size="icon-sm"
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
