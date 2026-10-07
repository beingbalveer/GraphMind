"use client";

import React from "react";
import { FolderOpen, PanelLeft } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface LibraryHeaderProps {
  totalFilesCount?: number;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  className?: string;
}

/**
 * LibraryHeader — Dedicated 52px top bar for the File Library view.
 * Directly features page title, file count badge, and mobile sidebar toggle.
 */
export function LibraryHeader({
  totalFilesCount,
  isSidebarOpen = true,
  onToggleSidebar,
  className,
}: LibraryHeaderProps) {
  return (
    <header
      data-testid="library-header"
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

        <div className="flex items-center gap-2 min-w-0 text-sm">
          <div className="flex items-center gap-1.5 font-medium text-foreground min-w-0">
            <FolderOpen className="size-4 text-primary shrink-0" />
            <span className="truncate">File Library</span>
          </div>

          {typeof totalFilesCount === "number" && (
            <Badge variant="secondary" className="hidden sm:inline-flex shrink-0 ml-1">
              {totalFilesCount} {totalFilesCount === 1 ? "file" : "files"}
            </Badge>
          )}
        </div>
      </div>
    </header>
  );
}
