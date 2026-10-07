"use client";

import React from "react";
import { Settings, PanelLeft } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

export interface SettingsHeaderProps {
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  className?: string;
}

/**
 * SettingsHeader — Dedicated 52px top bar for the Settings view.
 * Directly features page title, settings icon, and mobile sidebar toggle.
 */
export function SettingsHeader({
  isSidebarOpen = true,
  onToggleSidebar,
  className,
}: SettingsHeaderProps) {
  return (
    <header
      data-testid="settings-header"
      className={cn(
        "h-13 bg-background text-foreground px-3 sm:px-4 flex items-center justify-between z-30 shrink-0 select-none border-b border-border",
        className
      )}
    >
      {/* Left: Navigation toggle & Page Title */}
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

        <div className="flex items-center gap-1.5 font-medium text-foreground text-sm min-w-0">
          <Settings className="size-4 text-primary shrink-0" />
          <span className="truncate">Settings</span>
        </div>
      </div>
    </header>
  );
}
