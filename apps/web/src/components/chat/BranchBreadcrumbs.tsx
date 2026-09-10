"use client";

import React from "react";
import { ChevronRight, GitBranch, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface BreadcrumbStep { id: string; leafId: string; title: string; isRoot?: boolean; }

interface BranchBreadcrumbsProps { steps: BreadcrumbStep[]; onSelectStep: (step: BreadcrumbStep) => void; }

export function BranchBreadcrumbs({ steps, onSelectStep }: BranchBreadcrumbsProps) {
  if (steps.length === 0) return null;

  return (
    <nav aria-label="Branch lineage" className="flex max-w-2xl items-center gap-1 overflow-x-auto py-1 text-xs text-foreground-muted">
      {steps.map((step, index) => {
        const isCurrent = index === steps.length - 1;
        return <React.Fragment key={step.id + index}>
          {index > 0 && <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-foreground-subtle" />}
          <Button type="button" variant={isCurrent ? "secondary" : "ghost"} size="sm" disabled={isCurrent} onClick={() => onSelectStep(step)} className="max-w-[170px] shrink-0 gap-1.5 px-2 font-medium" title={step.isRoot ? `Main chat: ${step.title}` : `Branch: ${step.title}`}>
            {step.isRoot ? <MessageSquare aria-hidden="true" className="size-3 shrink-0" /> : <GitBranch aria-hidden="true" className="size-3 shrink-0 text-success" />}
            <span className="truncate">{step.title}</span>
          </Button>
        </React.Fragment>;
      })}
    </nav>
  );
}
