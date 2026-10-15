"use client";

import React, { useState, useEffect } from "react";
import { Drawer } from "@/components/ui/drawer";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { cn } from "@/lib/utils";

export interface LearningStudioShellProps {
  header: React.ReactNode;
  children: React.ReactNode;
  courseRail?: React.ReactNode;
  tutorRail?: React.ReactNode;
  isLeftRailOpen?: boolean;
  onToggleLeftRail?: () => void;
  isRightRailOpen?: boolean;
  onToggleRightRail?: () => void;
  isRightRailExpanded?: boolean;
  showRails?: boolean;
  className?: string;
}

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
 * LearningStudioShell — Top-level 3-column production shell for the Learning Studio.
 * Conforms to AGENTS.md Section 5:
 * - Uses semantic design tokens (bg-background, bg-surface, text-foreground, border-border).
 * - Standardized dimensions and responsive drawer fallbacks for viewports <1024px.
 * - Prevents double-mounting of chat containers or state leaks.
 */
export function LearningStudioShell({
  header,
  children,
  courseRail,
  tutorRail,
  isLeftRailOpen = true,
  onToggleLeftRail,
  isRightRailOpen = false,
  onToggleRightRail,
  isRightRailExpanded = false,
  showRails = false,
  className,
}: LearningStudioShellProps) {
  const [mounted, setMounted] = useState(false);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Escape key closes open drawer on constrained viewport
  useEscapeKey(() => {
    if (mounted && !isDesktop) {
      if (isLeftRailOpen && onToggleLeftRail) onToggleLeftRail();
      if (isRightRailOpen && onToggleRightRail) onToggleRightRail();
    }
  }, mounted && !isDesktop && (isLeftRailOpen || isRightRailOpen));

  const showDesktopLeftRail = showRails && isLeftRailOpen && isDesktop && Boolean(courseRail);
  const showMobileLeftDrawer = showRails && isLeftRailOpen && !isDesktop && Boolean(courseRail);

  const showDesktopRightRail = showRails && isRightRailOpen && isDesktop && Boolean(tutorRail);
  const showMobileRightDrawer = showRails && isRightRailOpen && !isDesktop && Boolean(tutorRail);

  return (
    <div
      data-testid="learning-studio-shell"
      className={cn(
        "h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden select-text",
        className
      )}
    >
      {/* Top Standard 52px Header */}
      {header}

      {/* Main 3-Column Body */}
      <div className="flex-1 min-h-0 flex relative overflow-hidden bg-background">
        {/* Desktop Left Course Rail */}
        {showDesktopLeftRail && (
          <aside
            data-testid="studio-desktop-left-rail"
            className="w-72 lg:w-80 shrink-0 h-full border-r border-border bg-surface overflow-hidden z-20"
          >
            {courseRail}
          </aside>
        )}

        {/* Mobile / Tablet Left Drawer */}
        {showMobileLeftDrawer && onToggleLeftRail && (
          <Drawer
            isOpen={isLeftRailOpen}
            onClose={onToggleLeftRail}
            title="Course Outline"
            widthClassName="w-full sm:w-[360px]"
            className="left-0 right-auto border-r border-l-0"
          >
            <div data-testid="studio-mobile-left-drawer-content" className="flex-1 overflow-y-auto">
              {courseRail}
            </div>
          </Drawer>
        )}

        {/* Center Main Stage (Lesson Reader, Catalog, Overview, or Canvas) */}
        <main
          data-testid="studio-main-stage"
          className="flex-1 min-w-0 flex flex-col h-full overflow-hidden relative bg-background"
        >
          {children}
        </main>

        {/* Desktop Right Contextual / Tutor Rail */}
        {showDesktopRightRail && (
          <aside
            data-testid="studio-desktop-right-rail"
            className={cn(
              "shrink-0 h-full border-l border-border bg-surface overflow-hidden transition-all duration-200 z-20",
              isRightRailExpanded ? "w-[440px] xl:w-[520px]" : "w-80 lg:w-96"
            )}
          >
            {tutorRail}
          </aside>
        )}

        {/* Mobile / Tablet Right Drawer */}
        {showMobileRightDrawer && onToggleRightRail && (
          <Drawer
            isOpen={isRightRailOpen}
            onClose={onToggleRightRail}
            title="Topic Companion"
            widthClassName="w-full sm:w-[420px] md:w-[480px]"
          >
            <div data-testid="studio-mobile-right-drawer-content" className="flex-1 overflow-y-auto">
              {tutorRail}
            </div>
          </Drawer>
        )}
      </div>
    </div>
  );
}
