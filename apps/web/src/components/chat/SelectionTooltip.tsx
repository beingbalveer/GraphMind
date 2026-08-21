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
      className="z-50 select-none animate-in fade-in-50 zoom-in-95 duration-150"
    >
      <button
        type="button"
        onMouseDown={(e) => {
          // Prevent losing selection on button click
          e.preventDefault();
        }}
        onClick={() => onExplore(selection.text)}
        className="px-3 py-1.5 rounded-full bg-zinc-900 text-white shadow-xl hover:bg-zinc-800 border border-zinc-700/80 flex items-center space-x-1.5 text-xs font-medium cursor-pointer transition-transform hover:scale-105 active:scale-95"
        title="Spawn a sub-topic branch from this excerpt"
      >
        <GitBranch className="w-3.5 h-3.5 text-zinc-300" />
        <span>Explore Sub-topic</span>
      </button>
    </div>
  );
}
