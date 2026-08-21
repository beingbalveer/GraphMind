"use client";

import { useEffect } from "react";

interface KeyboardShortcutsHandlers {
  onToggleSidebar?: () => void;
  onPrevBranch?: () => void;
  onNextBranch?: () => void;
  onJumpToRoot?: () => void;
  onEscape?: () => void;
  onFitView?: () => void;
  onCenterActive?: () => void;
}

export function useKeyboardShortcuts({
  onToggleSidebar,
  onPrevBranch,
  onNextBranch,
  onJumpToRoot,
  onEscape,
  onFitView,
  onCenterActive,
}: KeyboardShortcutsHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModifier = e.metaKey || e.ctrlKey;

      // 1. Toggle Sidebar: Cmd+B / Ctrl+B
      if (isModifier && e.key.toLowerCase() === "b") {
        e.preventDefault();
        onToggleSidebar?.();
        return;
      }

      // 2. Previous Branch: Cmd+[ / Ctrl+[
      if (isModifier && e.key === "[") {
        e.preventDefault();
        onPrevBranch?.();
        return;
      }

      // 3. Next Branch: Cmd+] / Ctrl+]
      if (isModifier && e.key === "]") {
        e.preventDefault();
        onNextBranch?.();
        return;
      }

      // 4. Jump to Root / Top: Cmd+Shift+Up / Ctrl+Shift+Up
      if (isModifier && e.shiftKey && e.key === "ArrowUp") {
        e.preventDefault();
        onJumpToRoot?.();
        return;
      }

      // 5. Fit View on Canvas: Cmd+0 / Ctrl+0
      if (isModifier && e.key === "0") {
        e.preventDefault();
        onFitView?.();
        return;
      }

      // 6. Center on Active Node: Cmd+. / Ctrl+.
      if (isModifier && e.key === ".") {
        e.preventDefault();
        onCenterActive?.();
        return;
      }

      // 7. Escape: Close sidebar / dismiss popups
      if (e.key === "Escape") {
        onEscape?.();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    onToggleSidebar,
    onPrevBranch,
    onNextBranch,
    onJumpToRoot,
    onEscape,
    onFitView,
    onCenterActive,
  ]);
}
