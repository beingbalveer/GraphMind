"use client";

import React from "react";
import { Button } from "@/components/ui/button";

export interface BreadcrumbStep {
  id: string;
  leafId: string;
  title: string;
  isRoot?: boolean;
}

interface BranchBreadcrumbsProps {
  steps: BreadcrumbStep[];
  onSelectStep: (step: BreadcrumbStep) => void;
  rootLabel?: string;
  suffix?: string;
}

export function BranchBreadcrumbs({
  steps,
  onSelectStep,
  rootLabel = "Workspace",
  suffix,
}: BranchBreadcrumbsProps) {
  if (steps.length === 0) return null;

  return (
    <nav
      aria-label="Branch lineage"
      className="flex items-center gap-1.5 text-sm text-foreground font-medium select-none overflow-x-auto max-w-full"
    >
      <span className="text-foreground-muted shrink-0">{rootLabel}</span>
      <span className="text-foreground-subtle shrink-0">/</span>

      {steps.map((step, index) => {
        const isCurrent = index === steps.length - 1 && !suffix;

        return (
          <React.Fragment key={step.id + index}>
            {index > 0 && (
              <span className="text-foreground-subtle shrink-0">/</span>
            )}
            {isCurrent ? (
              <span
                className="truncate max-w-[200px] sm:max-w-[280px] text-foreground font-medium"
                title={step.title}
              >
                {step.title}
              </span>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onSelectStep(step)}
                className="h-auto max-w-[180px] cursor-pointer truncate p-0 text-sm font-medium text-foreground-muted hover:bg-transparent hover:text-foreground shadow-none shrink-0"
                title={step.isRoot ? `Main chat: ${step.title}` : `Branch: ${step.title}`}
              >
                <span className="truncate">{step.title}</span>
              </Button>
            )}
          </React.Fragment>
        );
      })}

      {suffix && (
        <>
          <span className="text-foreground-subtle shrink-0">/</span>
          <span className="text-foreground font-medium shrink-0">{suffix}</span>
        </>
      )}
    </nav>
  );
}
