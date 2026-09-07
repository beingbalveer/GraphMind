"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { safeGetItem, safeSetItem } from "@/lib/storage";

interface UseResizableSidebarOptions {
  storageKey: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  side?: "left" | "right";
}

export function useResizableSidebar({
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
  side = "left",
}: UseResizableSidebarOptions) {
  const [width, setWidth] = useState<number>(() => {
    const saved = safeGetItem(storageKey);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
        return parsed;
      }
    }
    return defaultWidth;
  });

  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    isResizingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const resetWidth = useCallback(() => {
    setWidth(defaultWidth);
    safeSetItem(storageKey, defaultWidth.toString());
  }, [defaultWidth, storageKey]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const calculatedWidth =
        side === "left" ? e.clientX : window.innerWidth - e.clientX;
      const clampedWidth = Math.min(Math.max(calculatedWidth, minWidth), maxWidth);
      setWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        setIsResizing(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        safeSetItem(storageKey, width.toString());
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [width, minWidth, maxWidth, side, storageKey]);

  return {
    width,
    isResizing,
    startResizing,
    resetWidth,
  };
}
