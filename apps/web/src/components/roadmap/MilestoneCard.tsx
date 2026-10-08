import type { ReactNode } from "react";
import type { CurriculumItemData } from "@/lib/roadmapTypes";
import { CurriculumGroup } from "./CurriculumGroup";
export function MilestoneCard({
  phase,
  ordinal,
  children,
  open,
  onToggle,
}: {
  phase: CurriculumItemData;
  ordinal: number;
  children: ReactNode;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-3">
      <CurriculumGroup
        id={phase.id}
        title={
          <span className="flex items-center gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs text-foreground-subtle">
              {ordinal}
            </span>
            <span>{phase.title}</span>
          </span>
        }
        open={open}
        onToggle={onToggle}
      >
        <div className="space-y-3 px-1">
          <p className="text-sm text-foreground-muted">{phase.brief}</p>
          {children}
        </div>
      </CurriculumGroup>
    </section>
  );
}
