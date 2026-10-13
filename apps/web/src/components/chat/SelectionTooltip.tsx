"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";

import { Search } from "lucide-react";
import { SelectionState } from "@/hooks/useTextSelection";
import { DropdownMenu } from "@/components/ui/dropdown-menu";

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
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setIsOpen(true);
  }, [selection?.text, selection?.x, selection?.y]);

  if (!selection || !mounted) return null;

  return createPortal(
    <div
      style={{ position: "fixed", left: selection.x, top: selection.y }}
      onMouseDown={(e) => e.preventDefault()}
      className="z-dropdown select-none"
    >
      <DropdownMenu
        open={isOpen}
        onOpenChange={setIsOpen}
        side="top"
        align="center"
        sideOffset={8}
        className="min-w-48 animate-in fade-in-50 zoom-in-95 duration-150 motion-reduce:animate-none"
        trigger={<span aria-hidden="true" className="inline-block size-0" />}
        items={[
          {
            label: "Explore branch",
            icon: <BranchInChatIcon />,
            onClick: () => onExplore(selection.text),
          },
          {
            label: "Search",
            icon: <Search />,
            onClick: () => onSearch(selection.text),
          },
        ]}
      />
    </div>,
    document.body
  );
}
