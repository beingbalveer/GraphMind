"use client";

import { useState, useEffect, useCallback, RefObject } from "react";

export interface SelectionState {
  text: string;
  x: number;
  y: number;
}

export function useTextSelection(containerRef: RefObject<HTMLElement | null>) {
  const [selection, setSelection] = useState<SelectionState | null>(null);

  const handleSelectionChange = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !containerRef.current) {
      setSelection(null);
      return;
    }

    const text = sel.toString().trim();
    if (!text || text.length < 2) {
      setSelection(null);
      return;
    }

    // Check if the selection is inside the container
    const anchorNode = sel.anchorNode;
    const focusNode = sel.focusNode;
    if (
      !anchorNode ||
      !focusNode ||
      !containerRef.current.contains(anchorNode) ||
      !containerRef.current.contains(focusNode)
    ) {
      setSelection(null);
      return;
    }

    // Compute bounding rectangle of the selection
    try {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      if (rect.width === 0 && rect.height === 0) {
        setSelection(null);
        return;
      }

      setSelection({
        text,
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
      });
    } catch {
      setSelection(null);
    }
  }, [containerRef]);

  const clearSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
    }
    setSelection(null);
  }, []);

  useEffect(() => {
    const onMouseUp = () => {
      // Small timeout to allow browser selection range to settle
      setTimeout(handleSelectionChange, 10);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearSelection();
      } else {
        setTimeout(handleSelectionChange, 10);
      }
    };

    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("keyup", onKeyUp);

    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("keyup", onKeyUp);
    };
  }, [handleSelectionChange, clearSelection]);

  return {
    selection,
    clearSelection,
  };
}
