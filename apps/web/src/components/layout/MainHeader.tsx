"use client";

import React from "react";
import {
  MessageSquare,
  LayoutGrid,
  PanelRight,
  PanelLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
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
        "h-13 bg-background text-foreground px-3 sm:px-4 flex items-center justify-between z-30 shrink-0 select-none border-b border-border",
        className
      )}
    >
      {/* Left Zone: Navigation Toggle & Title / Breadcrumbs */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 mr-2 sm:mr-4">
        {onToggleSidebar && (
          <IconButton
            label={isSidebarOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={isSidebarOpen}
            onClick={onToggleSidebar}
            className="md:hidden shrink-0"
          >
            <PanelLeft className="size-4" />
          </IconButton>
        )}
        {breadcrumbs && (
          <div className="min-w-0 truncate">
            {breadcrumbs}
          </div>
        )}
      </div>

      {/* Right Zone: Mode Switcher (Chat ↔ Canvas) & Contextual Rail Control */}
      <div className="flex items-center gap-2 shrink-0">
        {onViewModeChange && (
          <SegmentedTabs
            ariaLabel="View mode"
            value={viewMode}
            onChange={onViewModeChange}
            items={[
              { id: "chat", label: "Chat", icon: MessageSquare },
              { id: "canvas", label: "Canvas", icon: LayoutGrid },
            ]}
          />
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

// Aliases for clear domain semantics and backward compatibility
export { MainHeader as Navbar, MainHeader as ChatHeader };
