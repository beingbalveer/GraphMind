"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";

import { Search } from "lucide-react";
import { SelectionState } from "@/hooks/useTextSelection";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";

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
      <Surface variant="base" radius="card" className="flex min-w-[190px] flex-col gap-0.5 p-1.5 shadow-lg">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 px-3 py-2 text-sm font-normal"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onExplore(selection.text)}
        >
          <BranchInChatIcon className="size-4" />
          Explore branch
        </Button>

        <Button
          variant="ghost"
          className="w-full justify-start gap-3 px-3 py-2 text-sm font-normal"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSearch(selection.text)}
        >
          <Search className="size-4" />
          Search
        </Button>
      </Surface>
    </div>,
    document.body
  );
}
