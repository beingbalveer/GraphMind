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

  // If right pane is not open, left pane takes 100% width
  if (!isOpen || !rightPane) {
    return (
      <div className="w-full h-full flex flex-col min-w-0 bg-white relative">
        {leftPane}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`w-full h-full flex min-w-0 bg-white relative overflow-hidden select-auto ${
        isDragging ? "select-none cursor-col-resize" : ""
      }`}
    >
      {/* Left Main Chat Pane */}
      <div
        style={{ width: `${leftPercent}%` }}
        className="h-full flex flex-col min-w-[320px] overflow-hidden bg-white relative transition-[width] duration-75 ease-out"
      >
        {leftPane}
      </div>

      {/* Draggable Vertical Splitter Divider */}
      <div
        onMouseDown={handleMouseDown}
        className="w-2 relative z-20 flex items-center justify-center cursor-col-resize group select-none shrink-0 bg-zinc-100 hover:bg-zinc-200 border-x border-zinc-200/90 transition-colors"
        title="Drag to resize split panes"
      >
        <div className="w-0.5 h-8 rounded-full bg-zinc-400 group-hover:bg-zinc-700 transition-colors" />
      </div>

      {/* Right Branch Chat Pane */}
      <div
        style={{ width: `${100 - leftPercent}%` }}
        className="h-full flex flex-col min-w-[320px] overflow-hidden bg-zinc-50/50 border-l border-zinc-200/90 relative transition-[width] duration-75 ease-out"
      >
        {rightPane}
      </div>
    </div>
  );
}
