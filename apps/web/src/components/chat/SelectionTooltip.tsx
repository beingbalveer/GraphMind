"use client";

import React from "react";
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
  if (!selection) return null;

  return (
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
        <div className="bg-white border border-zinc-200 rounded-xl shadow-lg shadow-zinc-900/10 overflow-hidden min-w-[172px]">
          {/* Explain Action */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onExplore(selection.text)}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-zinc-50 transition-colors duration-100 cursor-pointer group"
          >
            <span className="flex items-center justify-center w-6 h-6 rounded-md bg-zinc-100 text-zinc-700 border border-zinc-200/90 shrink-0 group-hover:bg-zinc-200 group-hover:text-zinc-950 transition-colors shadow-2xs">
              <GitBranch className="w-3.5 h-3.5" />
            </span>
            <div className="flex flex-col items-start text-left min-w-0">
              <span className="text-[12.5px] font-semibold text-zinc-800 leading-tight">
                Explain
              </span>
              <span className="text-[10.5px] text-zinc-400 leading-tight">
                Open in side branch
              </span>
            </div>
          </button>

          {/* Divider */}
          <div className="h-px bg-zinc-100 mx-2" />

          {/* Search Action */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSearch(selection.text)}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-zinc-50 transition-colors duration-100 cursor-pointer group"
          >
            <span className="flex items-center justify-center w-6 h-6 rounded-md bg-zinc-100 text-zinc-600 border border-zinc-200 shrink-0 group-hover:bg-zinc-200 group-hover:text-zinc-900 transition-colors">
              <Search className="w-3.5 h-3.5" />
            </span>
            <div className="flex flex-col items-start text-left min-w-0">
              <span className="text-[12.5px] font-semibold text-zinc-800 leading-tight">
                Search
              </span>
              <span className="text-[10.5px] text-zinc-400 leading-tight">
                Search on the web
              </span>
            </div>
          </button>
        </div>

        {/* Bottom Caret pointing down toward the selection */}
        <div className="w-2.5 h-2.5 bg-white border-r border-b border-zinc-200 rotate-45 -mt-[5px] shadow-sm" />
      </div>
    </div>
  );
}
