"use client";

import React from "react";
import { GitBranch } from "lucide-react";
import { SelectionState } from "@/hooks/useTextSelection";

interface SelectionTooltipProps {
  selection: SelectionState | null;
  onExplore: (highlightedText: string) => void;
}

export function SelectionTooltip({
  selection,
  onExplore,
}: SelectionTooltipProps) {
  if (!selection) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: `${selection.x}px`,
        top: `${selection.y}px`,
        transform: "translate(-50%, -100%)",
      }}
      onMouseDown={(e) => {
        // Prevent clearing browser selection on container click/drag
        e.preventDefault();
      }}
      className="z-50 select-none pb-2 animate-in fade-in-50 zoom-in-95 duration-150"
    >
      <div className="relative flex flex-col items-center">
        <button
          type="button"
          onMouseDown={(e) => {
            // Prevent losing text highlight on button press
            e.preventDefault();
          }}
          onClick={() => onExplore(selection.text)}
          className="px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-md text-zinc-800 hover:text-zinc-950 hover:bg-zinc-50 border border-zinc-200/90 shadow-md shadow-zinc-900/10 flex items-center space-x-1.5 text-xs font-medium cursor-pointer transition-all duration-150 hover:scale-[1.03] active:scale-95"
          title="Spawn a sub-topic branch from this excerpt"
        >
          <GitBranch className="w-3.5 h-3.5 text-zinc-600" />
          <span>Explore Sub-topic</span>
        </button>

        {/* Subtle Bottom Caret */}
        <div className="w-2 h-2 bg-white rotate-45 border-r border-b border-zinc-200/90 -mt-1 shadow-2xs" />
      </div>
    </div>
  );
}
