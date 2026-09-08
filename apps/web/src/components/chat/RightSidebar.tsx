"use client";

import React from "react";
import { PanelRight } from "lucide-react";
import { useResizableSidebar } from "@/hooks/useResizableSidebar";

interface RightSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  title?: string;
  children?: React.ReactNode;
}

const DEFAULT_WIDTH = 340;
const MIN_WIDTH = 280;
const MAX_WIDTH = 560;

export function RightSidebar({
  isOpen,
  onToggle,
  title = "Panel",
  children,
}: RightSidebarProps) {
  const { width, isResizing, startResizing } = useResizableSidebar({
    storageKey: "graphmind_right_sidebar_width_v1",
    defaultWidth: DEFAULT_WIDTH,
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
    side: "right",
  });

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onToggle}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Collapsible & Resizable Right Sidebar Container */}
      <aside
        suppressHydrationWarning
        style={{ width: isOpen ? `${width}px` : "0px" }}
        className={`fixed md:static inset-y-0 right-0 z-40 flex flex-col bg-background-secondary select-none relative overflow-hidden shrink-0 border-l border-border-subtle ${
          isOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
        } ${isResizing ? "transition-none" : "transition-[width,transform] duration-200 ease-in-out"}`}
      >
        {/* Resize Handle (Left Edge) */}
        {isOpen && (
          <div
            onMouseDown={startResizing}
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-muted transition-colors z-50 group"
            title="Drag to resize panel"
          >
            <div className="w-0.5 h-8 bg-border rounded-full mx-auto my-auto opacity-0 group-hover:opacity-100 transition-opacity absolute inset-y-0 left-0" />
          </div>
        )}

        {/* Top Header: Standardized to h-13 with border-b, matching Navbar exactly */}
        <div className="h-13 px-4 flex items-center justify-between shrink-0 bg-surface border-b border-border-subtle overflow-hidden">
          <div className="flex items-center space-x-2 min-w-0">
            <h2 className="text-sm font-semibold text-zinc-900 truncate tracking-tight">
              {title}
            </h2>
          </div>
          <button
            onClick={onToggle}
            className="size-8 rounded-lg flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer shrink-0"
            title="Collapse right panel"
            aria-label="Collapse right panel"
          >
            <PanelRight className="w-4 h-4" />
          </button>
        </div>

        {/* Blank Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col min-w-0 bg-background-secondary">
          {children}
        </div>
      </aside>
    </>
  );
}
