"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";

import { GitBranch, Search } from "lucide-react";
import { SelectionState } from "@/hooks/useTextSelection";
import { MenuCard, MenuItem } from "@/components/ui/menu";

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
      <MenuCard className="min-w-[145px]">
        <MenuItem
          icon={<GitBranch className="w-4 h-4" />}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onExplore(selection.text)}
        >
          Explain
        </MenuItem>

        <MenuItem
          icon={<Search className="w-4 h-4" />}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSearch(selection.text)}
        >
          Search
        </MenuItem>
      </MenuCard>
    </div>,
    document.body
  );
}

