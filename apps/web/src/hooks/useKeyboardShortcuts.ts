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
  onAutoLayout?: () => void;
  onCommandPalette?: () => void;
}

export function useKeyboardShortcuts({
  onToggleSidebar,
  onPrevBranch,
  onNextBranch,
  onJumpToRoot,
  onEscape,
  onFitView,
  onCenterActive,
  onAutoLayout,
  onCommandPalette,
}: KeyboardShortcutsHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModifier = e.metaKey || e.ctrlKey;

      // 1. Command Palette: Cmd+K / Ctrl+K
      if (isModifier && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onCommandPalette?.();
        return;
      }

      // 2. Toggle Sidebar: Cmd+B / Ctrl+B
      if (isModifier && e.key.toLowerCase() === "b") {
        e.preventDefault();
        onToggleSidebar?.();
        return;
      }

      // 3. Recompute Auto-Layout: Cmd+L / Ctrl+L
      if (isModifier && e.key.toLowerCase() === "l") {
        e.preventDefault();
        onAutoLayout?.();
        return;
      }

      // 4. Previous Branch: Cmd+[ / Ctrl+[
      if (isModifier && e.key === "[") {
        e.preventDefault();
        onPrevBranch?.();
        return;
      }

      // 5. Next Branch: Cmd+] / Ctrl+]
      if (isModifier && e.key === "]") {
        e.preventDefault();
        onNextBranch?.();
        return;
      }

      // 6. Jump to Root / Top: Cmd+Shift+Up / Ctrl+Shift+Up
      if (isModifier && e.shiftKey && e.key === "ArrowUp") {
        e.preventDefault();
        onJumpToRoot?.();
        return;
      }

      // 7. Fit View on Canvas: Cmd+0 / Ctrl+0
      if (isModifier && e.key === "0") {
        e.preventDefault();
        onFitView?.();
        return;
      }

      // 8. Center on Active Node: Cmd+. / Ctrl+.
      if (isModifier && e.key === ".") {
        e.preventDefault();
        onCenterActive?.();
        return;
      }

      // 9. Escape: Close palette / drawer / sidebar
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
    onAutoLayout,
    onCommandPalette,
  ]);
}
