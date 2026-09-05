"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { PanelRightClose, Sparkles, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { safeGetItem, safeSetItem } from "@/lib/storage";

interface RightSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  title?: string;
  children?: React.ReactNode;
}

const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 520;

export function RightSidebar({
  isOpen,
  onToggle,
  title = "Notes & Tools",
  children,
}: RightSidebarProps) {
  // Resizable sidebar width with local storage persistence
  const [width, setWidth] = useState<number>(() => {
    const saved = safeGetItem("graphmind_right_sidebar_width_v1");
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
        return parsed;
      }
    }
    return DEFAULT_WIDTH;
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

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = Math.min(Math.max(window.innerWidth - e.clientX, MIN_WIDTH), MAX_WIDTH);
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        setIsResizing(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        safeSetItem("graphmind_right_sidebar_width_v1", width.toString());
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [width]);

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onToggle}
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-2xs md:hidden"
        />
      )}

      {/* Collapsible & Resizable Right Sidebar Container */}
      <aside
        suppressHydrationWarning
        style={{ width: isOpen ? `${width}px` : "0px" }}
        className={`fixed md:static inset-y-0 right-0 z-40 flex flex-col bg-[#F8F9FA] select-none relative overflow-hidden shrink-0 ${
          isOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
        } ${isResizing ? "transition-none" : "transition-[width,transform] duration-200 ease-in-out"}`}
      >
        {/* Resize Handle (Left Edge) */}
        {isOpen && (
          <div
            onMouseDown={startResizing}
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-zinc-300 transition-colors z-50 group"
            title="Drag to resize panel"
          >
            <div className="w-0.5 h-8 bg-zinc-300 rounded-full mx-auto my-auto opacity-0 group-hover:opacity-100 transition-opacity absolute inset-y-0 left-0" />
          </div>
        )}

        {/* Top Header */}
        <div className="h-13 px-3 sm:px-4 flex items-center justify-between shrink-0 bg-transparent overflow-hidden">
          <div className="flex items-center space-x-2 min-w-0">
            <Sparkles className="w-4 h-4 text-zinc-600 shrink-0" />
            <h2 className="text-xs font-semibold text-zinc-900 truncate tracking-tight">
              {title}
            </h2>
          </div>

          <Button
            variant="ghost"
            size="iconSm"
            onClick={onToggle}
            className="h-8 w-8 text-zinc-400 hover:text-zinc-950 cursor-pointer shrink-0"
            title="Collapse panel"
          >
            <PanelRightClose className="w-4 h-4" />
          </Button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col min-w-0">
          {children ? (
            children
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-8 space-y-3 select-none">
              <div className="w-10 h-10 rounded-2xl bg-white shadow-2xs flex items-center justify-center text-zinc-400">
                <StickyNote className="w-5 h-5 stroke-[1.5]" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-zinc-800">
                  Notes & Tools Panel
                </p>
                <p className="text-[11px] text-zinc-400 leading-relaxed max-w-[200px]">
                  Saved notes, active playbooks, and tool widgets will be accessible here.
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
