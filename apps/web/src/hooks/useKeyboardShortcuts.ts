"use client";

import { useEffect } from "react";

interface KeyboardShortcutsHandlers {
  onToggleSidebar?: () => void;
  onPrevBranch?: () => void;
  onNextBranch?: () => void;
  onJumpToRoot?: () => void;
  onEscape?: () => void;
}

export function useKeyboardShortcuts({
  onToggleSidebar,
  onPrevBranch,
  onNextBranch,
  onJumpToRoot,
  onEscape,
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

      // 5. Escape: Close sidebar / dismiss popups
      if (e.key === "Escape") {
        onEscape?.();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToggleSidebar, onPrevBranch, onNextBranch, onJumpToRoot, onEscape]);
}
