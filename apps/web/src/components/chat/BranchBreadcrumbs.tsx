"use client";

import React from "react";
import { ChevronRight, GitBranch, MessageSquare } from "lucide-react";

export interface BreadcrumbStep {
  id: string;
  leafId: string;
  title: string;
  isRoot?: boolean;
}

interface BranchBreadcrumbsProps {
  steps: BreadcrumbStep[];
  onSelectStep: (step: BreadcrumbStep) => void;
}

export function BranchBreadcrumbs({
  steps,
  onSelectStep,
}: BranchBreadcrumbsProps) {
  if (steps.length === 0) {
    return null;
  }

  return (
    <nav className="flex items-center space-x-1 text-xs text-zinc-500 max-w-2xl overflow-x-auto no-scrollbar animate-in fade-in duration-150 py-1">
      {steps.map((step, index) => {
        const isCurrent = index === steps.length - 1;

        return (
          <React.Fragment key={step.id + index}>
            {index > 0 && (
              <ChevronRight className="w-3.5 h-3.5 text-zinc-300 shrink-0 select-none" />
            )}
            <button
              type="button"
              disabled={isCurrent}
              onClick={() => onSelectStep(step)}
              className={`flex items-center space-x-1.5 px-2 py-1 rounded-md text-xs transition-colors shrink-0 max-w-[170px] ${
                isCurrent
                  ? "bg-zinc-100 text-zinc-950 font-semibold cursor-default shadow-2xs border border-zinc-200/60"
                  : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 font-medium cursor-pointer"
              }`}
              title={step.isRoot ? `Main Chat: ${step.title}` : `Branch: ${step.title}`}
            >
              {step.isRoot ? (
                <MessageSquare className="w-3 h-3 text-zinc-400 shrink-0" />
              ) : (
                <GitBranch className="w-3 h-3 text-emerald-600 shrink-0" />
              )}
              <span className="truncate">{step.title}</span>
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}

