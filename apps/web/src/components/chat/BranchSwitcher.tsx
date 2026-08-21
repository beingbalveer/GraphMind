"use client";

import React from "react";
import { ChevronLeft, ChevronRight, GitBranch } from "lucide-react";
import { ConversationTree, getNodeChildren } from "@graphmind/shared";

interface BranchSwitcherProps {
  tree: ConversationTree;
  parentNodeId: string;
  activeChildId?: string;
  onSelectBranch: (childNodeId: string) => void;
}

export function BranchSwitcher({
  tree,
  parentNodeId,
  activeChildId,
  onSelectBranch,
}: BranchSwitcherProps) {
  const children = getNodeChildren(tree, parentNodeId);

  // Only render if there are 2 or more parallel branches
  if (children.length <= 1) {
    return null;
  }

  const currentIndex = children.findIndex((c) => c.id === activeChildId);
  const activeIndex = currentIndex >= 0 ? currentIndex : 0;
  const currentChild = children[activeIndex];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    const prevIndex = (activeIndex - 1 + children.length) % children.length;
    onSelectBranch(children[prevIndex].id);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextIndex = (activeIndex + 1) % children.length;
    onSelectBranch(children[nextIndex].id);
  };

  return (
    <div className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-zinc-100/90 border border-zinc-200/90 text-xs text-zinc-600 select-none shadow-2xs">
      <GitBranch className="w-3 h-3 text-zinc-500 shrink-0" />
      <span className="font-medium text-zinc-800">
        Branch {activeIndex + 1} of {children.length}
      </span>
      {currentChild?.highlightedContext && (
        <span className="italic text-zinc-500 max-w-[120px] truncate hidden sm:inline">
          (&ldquo;{currentChild.highlightedContext}&rdquo;)
        </span>
      )}
      <div className="flex items-center space-x-0.5 ml-1">
        <button
          type="button"
          onClick={handlePrev}
          className="p-0.5 rounded hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer"
          title="Previous branch"
        >
          <ChevronLeft className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="p-0.5 rounded hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer"
          title="Next branch"
        >
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
