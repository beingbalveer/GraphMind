"use client";

import React from "react";
import {
  Compass,
  GraduationCap,
  Layout,
  Menu,
  Moon,
  PanelRight,
  Plus,
  Sparkles,
  Sun,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StudioNavTab = "home" | "learning" | "browse" | "create";

export interface StudioHeaderProps {
  activeNav?: StudioNavTab;
  onNavigate?: (tab: StudioNavTab) => void;
  /**
   * Hide the signed-in Studio navigation for public, anonymous surfaces
   * (e.g. the `/learn` catalog), where those private destinations do not apply.
   */
  showNav?: boolean;
  courseTitle?: string;
  isLeftRailOpen?: boolean;
  onToggleLeftRail?: () => void;
  isRightRailOpen?: boolean;
  onToggleRightRail?: () => void;
  showRails?: boolean;
  rightRailTitle?: string;
  isDark?: boolean;
  onToggleDark?: () => void;
  className?: string;
}

/**
 * StudioHeader — Canonical 52px (h-13) top bar for the Learning Studio shell.
 * Houses brand badge, course title indicator, navigation tabs, rail toggles, and theme control.
 */
export function StudioHeader({
  activeNav = "home",
  onNavigate,
  showNav = true,
  courseTitle,
  isLeftRailOpen = true,
  onToggleLeftRail,
  isRightRailOpen = false,
  onToggleRightRail,
  showRails = false,
  rightRailTitle = "Tutor",
  isDark = false,
  onToggleDark,
  className,
}: StudioHeaderProps) {
  return (
    <header
      data-testid="studio-header"
      className={cn(
        "h-13 bg-background text-foreground px-3 sm:px-4 flex items-center justify-between z-30 shrink-0 select-none border-b border-border",
        className
      )}
    >
      {/* Left: Rail toggle (if in course) + Brand */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {showRails && onToggleLeftRail && (
          <Button
            size="iconSm"
            variant="ghost"
            onClick={onToggleLeftRail}
            aria-label={isLeftRailOpen ? "Close course rail" : "Open course rail"}
            aria-expanded={isLeftRailOpen}
            className="text-foreground-muted hover:text-foreground"
          >
            <Menu className="size-4" />
          </Button>
        )}

        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <GraduationCap className="size-4" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold tracking-tight">GraphMind</span>
              <Badge variant="outline" className="text-2xs font-normal py-0 px-1.5 hidden sm:inline-flex">
                Studio
              </Badge>
            </div>
            {courseTitle && (
              <span className="text-xs text-foreground-muted truncate max-w-[140px] sm:max-w-[200px] md:max-w-[320px]">
                {courseTitle}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Center: Primary Navigation (signed-in Studio only) */}
      {showNav && (
        <nav aria-label="Studio Navigation" className="hidden md:flex items-center gap-1 bg-surface-hover/50 p-1 rounded-xl border border-border-subtle">
          <Button
            size="sm"
            variant={activeNav === "home" ? "secondary" : "ghost"}
            onClick={() => onNavigate?.("home")}
            className="gap-1.5 text-xs h-7 px-2.5 rounded-lg"
          >
            <Layout className="size-3.5" />
            Home
          </Button>
          <Button
            size="sm"
            variant={activeNav === "learning" ? "secondary" : "ghost"}
            onClick={() => onNavigate?.("learning")}
            className="gap-1.5 text-xs h-7 px-2.5 rounded-lg"
          >
            <BookOpen className="size-3.5" />
            My Learning
          </Button>
          <Button
            size="sm"
            variant={activeNav === "browse" ? "secondary" : "ghost"}
            onClick={() => onNavigate?.("browse")}
            className="gap-1.5 text-xs h-7 px-2.5 rounded-lg"
          >
            <Compass className="size-3.5" />
            Browse
          </Button>
          <Button
            size="sm"
            variant={activeNav === "create" ? "secondary" : "ghost"}
            onClick={() => onNavigate?.("create")}
            className="gap-1.5 text-xs h-7 px-2.5 rounded-lg"
          >
            <Plus className="size-3.5" />
            Create
          </Button>
        </nav>
      )}

      {/* Right: Theme Toggle + Context / Tutor Rail Disclosure */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {onToggleDark && (
          <Button
            size="iconSm"
            variant="ghost"
            onClick={onToggleDark}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="text-foreground-muted hover:text-foreground"
          >
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        )}

        {showRails && onToggleRightRail && (
          <Button
            size="sm"
            variant={isRightRailOpen ? "secondary" : "outline"}
            onClick={onToggleRightRail}
            aria-label={isRightRailOpen ? `Hide ${rightRailTitle}` : `Open ${rightRailTitle}`}
            aria-expanded={isRightRailOpen}
            className="gap-1.5 text-xs h-8 px-2.5"
          >
            <Sparkles className="size-3.5 text-primary" />
            <span className="hidden sm:inline">{rightRailTitle}</span>
            <PanelRight className="size-3.5 text-foreground-muted" />
          </Button>
        )}
      </div>
    </header>
  );
}
