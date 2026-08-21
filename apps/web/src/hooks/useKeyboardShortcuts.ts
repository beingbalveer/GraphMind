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

      // 2. Recompute Auto-Layout: Cmd+L / Ctrl+L
      if (isModifier && e.key.toLowerCase() === "l") {
        e.preventDefault();
        onAutoLayout?.();
        return;
      }

      // 3. Previous Branch: Cmd+[ / Ctrl+[
      if (isModifier && e.key === "[") {
        e.preventDefault();
        onPrevBranch?.();
        return;
      }

      // 4. Next Branch: Cmd+] / Ctrl+]
      if (isModifier && e.key === "]") {
        e.preventDefault();
        onNextBranch?.();
        return;
      }

      // 5. Jump to Root / Top: Cmd+Shift+Up / Ctrl+Shift+Up
      if (isModifier && e.shiftKey && e.key === "ArrowUp") {
        e.preventDefault();
        onJumpToRoot?.();
        return;
      }

      // 6. Fit View on Canvas: Cmd+0 / Ctrl+0
      if (isModifier && e.key === "0") {
        e.preventDefault();
        onFitView?.();
        return;
      }

      // 7. Center on Active Node: Cmd+. / Ctrl+.
      if (isModifier && e.key === ".") {
        e.preventDefault();
        onCenterActive?.();
        return;
      }

      // 8. Escape: Close palette / drawer / side branch
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
  ]);
}
