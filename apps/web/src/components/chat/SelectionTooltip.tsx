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
          className="px-3.5 py-1.5 rounded-full bg-zinc-900 text-white hover:bg-zinc-800 border border-zinc-900 shadow-lg flex items-center space-x-1.5 text-xs font-semibold cursor-pointer transition-all duration-150 hover:scale-[1.03] active:scale-95"
          title="Explain this concept in a parallel side branch"
        >
          <GitBranch className="w-3.5 h-3.5 text-zinc-300" />
          <span>Explain this</span>
        </button>

        {/* Subtle Bottom Caret */}
        <div className="w-2 h-2 bg-zinc-900 rotate-45 -mt-1 shadow-2xs" />
      </div>
    </div>
  );
}
