"use client";

import React, { useState, useEffect } from "react";
import { PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { useResizableSidebar } from "@/hooks/useResizableSidebar";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { cn } from "@/lib/utils";

export interface ContextRailProps {
  isOpen: boolean;
  onToggle: () => void;
  title?: string;
  children?: React.ReactNode;
  className?: string;
  forceDrawer?: boolean;
}

const DEFAULT_WIDTH = 340;
const MIN_WIDTH = 280;
const MAX_WIDTH = 560;

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (typeof window.matchMedia === "function") {
      const media = window.matchMedia("(min-width: 1024px)");
      setIsDesktop(media.matches);
      const listener = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    }

    const checkWidth = () => setIsDesktop(window.innerWidth >= 1024);
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  return isDesktop;
}

/**
 * ContextRail — Canonical contextual rail for GraphMind.
 * Renders an inline resizable panel on desktop (>=1024px) and transforms
 * into an accessible Drawer with backdrop on constrained viewports (<1024px).
 */
export function ContextRail({
  isOpen,
  onToggle,
  title = "Context & Mastery",
  children,
  className,
  forceDrawer = false,
}: ContextRailProps) {
  const [mounted, setMounted] = useState(false);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    setMounted(true);
  }, []);

  const { width, isResizing, startResizing } = useResizableSidebar({
    storageKey: "graphmind_right_sidebar_width_v1",
    defaultWidth: DEFAULT_WIDTH,
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
    side: "right",
  });

  const showDrawer = forceDrawer || (mounted && !isDesktop);

  // Close desktop panel with Escape key
  useEscapeKey(onToggle, isOpen && !showDrawer);

  if (showDrawer) {
    return (
      <Drawer
        isOpen={isOpen}
        onClose={onToggle}
        title={title}
        widthClassName="w-full sm:w-[420px] md:w-[460px]"
        className={className}
      >
        <div
          data-testid="context-rail-drawer-content"
          className="flex-1 overflow-y-auto p-4 flex flex-col min-w-0 bg-surface"
        >
          {children}
        </div>
      </Drawer>
    );
  }

  return (
    <aside
      data-testid="context-rail-aside"
      suppressHydrationWarning
      style={{ width: isOpen ? `${width}px` : "0px" }}
      className={cn(
        "inset-y-0 right-0 z-40 flex flex-col bg-surface select-none relative overflow-hidden shrink-0 border-l border-border-subtle",
        isOpen ? "translate-x-0" : "translate-x-full",
        isResizing ? "transition-none" : "transition-[width,transform] duration-200 ease-in-out",
        className
      )}
    >
      {/* Resize Handle (Left Edge) */}
      {isOpen && (
        <div
          onMouseDown={startResizing}
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-muted transition-colors z-50 group"
          title="Drag to resize panel"
          aria-label="Resize panel"
        >
          <div className="w-0.5 h-8 bg-border rounded-full mx-auto my-auto opacity-0 group-hover:opacity-100 transition-opacity absolute inset-y-0 left-0" />
        </div>
      )}

      {/* Top Header: Standard 52px height (h-13) */}
      <div className="h-13 px-4 flex items-center justify-between shrink-0 w-full border-b border-border-subtle">
        <span className="text-xs font-semibold text-foreground tracking-tight truncate">
          {title}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggle}
          className="text-foreground-muted hover:text-foreground hover:bg-surface-hover cursor-pointer shrink-0"
          title="Collapse panel"
          aria-label="Collapse panel"
        >
          <PanelRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Scrollable Content Area */}
      <div
        data-testid="context-rail-content"
        className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col min-w-0 bg-surface"
      >
        {children}
      </div>
    </aside>
  );
}

// Backward-compatible alias
export { ContextRail as RightSidebar };
