"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

interface ResizableSplitPaneProps {
  leftPane: React.ReactNode;
  rightPane: React.ReactNode | null;
  isOpen: boolean;
  onClose?: () => void;
  defaultLeftPercent?: number;
}

export function ResizableSplitPane({
  leftPane,
  rightPane,
  isOpen,
  defaultLeftPercent = 50,
}: ResizableSplitPaneProps) {
  const [leftPercent, setLeftPercent] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("graphmind_split_width_v1");
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 25 && parsed <= 75) {
          return parsed;
        }
      }
    }
    return defaultLeftPercent;
  });

  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const rawPercent = ((e.clientX - rect.left) / rect.width) * 100;
      // Clamp between 25% and 75%
      const clamped = Math.min(Math.max(rawPercent, 25), 75);
      setLeftPercent(clamped);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      localStorage.setItem("graphmind_split_width_v1", leftPercent.toString());
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, leftPercent]);

  // Smooth animation styles
  const transitionStyle = isDragging
    ? "transition-none"
    : "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]";

  const effectiveLeftWidth = isOpen && rightPane ? `${leftPercent}%` : "100%";
  const effectiveRightWidth = isOpen && rightPane ? `${100 - leftPercent}%` : "0%";

  return (
    <div
      ref={containerRef}
      className={`w-full h-full flex min-w-0 bg-white relative overflow-hidden select-auto ${
        isDragging ? "select-none cursor-col-resize" : ""
      }`}
    >
      {/* Left Main Chat Pane */}
      <div
        style={{ width: effectiveLeftWidth }}
        className={`h-full flex flex-col min-w-0 overflow-hidden bg-white relative ${transitionStyle}`}
      >
        {leftPane}
      </div>

      {/* Draggable Vertical Splitter Divider */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          width: isOpen && rightPane ? "8px" : "0px",
          opacity: isOpen && rightPane ? 1 : 0,
        }}
        className={`relative z-20 flex items-center justify-center cursor-col-resize group select-none shrink-0 bg-zinc-100 hover:bg-zinc-200 border-x border-zinc-200/90 overflow-hidden ${
          isOpen && rightPane ? "pointer-events-auto" : "pointer-events-none border-none"
        } ${transitionStyle}`}
        title="Drag to resize split panes"
      >
        <div className="w-0.5 h-8 rounded-full bg-zinc-400 group-hover:bg-zinc-700 transition-colors" />
      </div>

      {/* Right Branch Chat Pane */}
      <div
        style={{ width: effectiveRightWidth }}
        className={`h-full flex flex-col overflow-hidden bg-zinc-50/50 relative ${
          isOpen && rightPane
            ? "opacity-100 border-l border-zinc-200/90 pointer-events-auto"
            : "opacity-0 border-none pointer-events-none"
        } ${transitionStyle}`}
      >
        <div className="w-full h-full min-w-[320px] flex flex-col overflow-hidden">
          {rightPane}
        </div>
      </div>
    </div>
  );
}
