"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";

import { Search } from "lucide-react";
import { SelectionState } from "@/hooks/useTextSelection";
import { MenuCard, MenuItem } from "@/components/ui/menu";

function BranchInChatIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 18h16" />
      <path d="M10 18v-3a4 4 0 0 1 1.2-2.8l6.8-6.8" />
      <polyline points="14 5 18 5 18 9" />
    </svg>
  );
}

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
      <MenuCard className="min-w-[190px]">
        <MenuItem
          icon={<BranchInChatIcon />}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onExplore(selection.text)}
        >
          Branch in new chat
        </MenuItem>

        <MenuItem
          icon={<Search />}
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

