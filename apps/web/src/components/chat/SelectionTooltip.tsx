"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";

import { GitBranch, Search } from "lucide-react";
import { SelectionState } from "@/hooks/useTextSelection";

interface SelectionTooltipProps {
  selection: SelectionState | null;
  onExplore: (highlightedText: string) => void;
  onSearch: (highlightedText: string) => void;
}

export function SelectionTooltip({
  selection,
  onExplore,
  onSearch,
}: SelectionTooltipProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!selection || !mounted) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        left: `${selection.x}px`,
        top: `${selection.y}px`,
        transform: "translate(-50%, calc(-100% - 6px))",
      }}

      onMouseDown={(e) => {
        // Prevent clearing browser selection on container click/drag
        e.preventDefault();
      }}
      className="z-50 select-none animate-in fade-in-50 zoom-in-95 duration-150"
    >
      <div className="relative flex flex-col items-center">
        {/* Menu Card */}
        <div className="bg-white border border-zinc-200 rounded-xl shadow-lg shadow-zinc-900/10 overflow-hidden min-w-[130px] p-1">
          {/* Explain Action */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onExplore(selection.text)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 transition-colors duration-100 cursor-pointer group text-left"
          >
            <span className="flex items-center justify-center w-5 h-5 rounded-md bg-zinc-100 text-zinc-700 border border-zinc-200/90 shrink-0 group-hover:bg-zinc-200 group-hover:text-zinc-950 transition-colors shadow-2xs">
              <GitBranch className="w-3 h-3" />
            </span>
            <span className="text-[12.5px] font-medium text-zinc-800 leading-none">
              Explain
            </span>
          </button>

          {/* Divider */}
          <div className="h-px bg-zinc-100 my-0.5 mx-1" />

          {/* Search Action */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSearch(selection.text)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 transition-colors duration-100 cursor-pointer group text-left"
          >
            <span className="flex items-center justify-center w-5 h-5 rounded-md bg-zinc-100 text-zinc-600 border border-zinc-200 shrink-0 group-hover:bg-zinc-200 group-hover:text-zinc-900 transition-colors">
              <Search className="w-3 h-3" />
            </span>
            <span className="text-[12.5px] font-medium text-zinc-800 leading-none">
              Search
            </span>
          </button>
        </div>

        {/* Bottom Caret pointing down toward the selection */}
        <div className="w-2.5 h-2.5 bg-white border-r border-b border-zinc-200 rotate-45 -mt-[5px] shadow-sm" />
      </div>
    </div>,
    document.body
  );
}

