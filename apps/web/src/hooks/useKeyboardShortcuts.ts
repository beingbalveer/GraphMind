"use client";

import { useEffect } from "react";

interface KeyboardShortcutsHandlers {
  onPrevBranch?: () => void;
  onNextBranch?: () => void;
  onJumpToRoot?: () => void;
  onEscape?: () => void;
  onFitView?: () => void;
  onCenterActive?: () => void;
  onAutoLayout?: () => void;
  onCommandPalette?: () => void;
  onToggleSidebar?: () => void;
  onNewChat?: () => void;
}

export function useKeyboardShortcuts({
  onPrevBranch,
  onNextBranch,
  onJumpToRoot,
  onEscape,
  onFitView,
  onCenterActive,
  onAutoLayout,
  onCommandPalette,
  onToggleSidebar,
  onNewChat,
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

      // 3. New Chat: Cmd+Shift+O / Ctrl+Shift+O or Cmd+N (when allowed)
      if (isModifier && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        onNewChat?.();
        return;
      }

      // 4. Recompute Auto-Layout: Cmd+L / Ctrl+L
      if (isModifier && e.key.toLowerCase() === "l") {
        e.preventDefault();
        onAutoLayout?.();
        return;
      }

      // 5. Previous Branch: Cmd+[ / Ctrl+[
      if (isModifier && e.key === "[") {
        e.preventDefault();
        onPrevBranch?.();
        return;
      }

      // 6. Next Branch: Cmd+] / Ctrl+]
      if (isModifier && e.key === "]") {
        e.preventDefault();
        onNextBranch?.();
        return;
      }

      // 7. Jump to Root / Top: Cmd+Shift+Up / Ctrl+Shift+Up
      if (isModifier && e.shiftKey && e.key === "ArrowUp") {
        e.preventDefault();
        onJumpToRoot?.();
        return;
      }

      // 8. Fit View on Canvas: Cmd+0 / Ctrl+0
      if (isModifier && e.key === "0") {
        e.preventDefault();
        onFitView?.();
        return;
      }

      // 9. Center on Active Node: Cmd+. / Ctrl+.
      if (isModifier && e.key === ".") {
        e.preventDefault();
        onCenterActive?.();
        return;
      }

      // 10. Escape: Close palette / drawer / side branch
      if (e.key === "Escape") {
        onEscape?.();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    onPrevBranch,
    onNextBranch,
    onJumpToRoot,
    onEscape,
    onFitView,
    onCenterActive,
    onAutoLayout,
    onCommandPalette,
    onToggleSidebar,
    onNewChat,
  ]);
}
