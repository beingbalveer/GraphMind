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
        transform: "translate(-50%, calc(-100% - 8px))",
      }}
      onMouseDown={(e) => {
        // Prevent clearing browser selection on container click/drag
        e.preventDefault();
      }}
      className="z-50 select-none animate-in fade-in-50 zoom-in-95 duration-150"
    >
      {/* Menu Card */}
      <div className="bg-white border border-zinc-200/80 rounded-[20px] shadow-[0_4px_24px_rgba(0,0,0,0.08)] p-1.5 min-w-[145px] flex flex-col space-y-0.5">
        {/* Explain Action */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onExplore(selection.text)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-normal text-zinc-800 hover:text-zinc-950 hover:bg-zinc-100/90 transition-colors cursor-pointer group text-left"
        >
          <GitBranch className="w-4 h-4 text-zinc-700 group-hover:text-zinc-950 shrink-0" />
          <span>Explain</span>
        </button>

        {/* Search Action */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSearch(selection.text)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-normal text-zinc-800 hover:text-zinc-950 hover:bg-zinc-100/90 transition-colors cursor-pointer group text-left"
        >
          <Search className="w-4 h-4 text-zinc-700 group-hover:text-zinc-950 shrink-0" />
          <span>Search</span>
        </button>
      </div>
    </div>,
    document.body
  );
}

