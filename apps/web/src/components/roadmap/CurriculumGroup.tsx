"use client";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
export function CurriculumGroup({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onToggle} className="min-w-0">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto w-full justify-between whitespace-normal py-3 text-left text-sm"
          aria-controls={`group-${id}`}
        >
          <span>{title}</span>
          <ChevronDown
            className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent id={`group-${id}`}>
        <div className="space-y-2 pb-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
