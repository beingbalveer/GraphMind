"use client";

import { useState } from "react";
import { FileText, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

export interface RagSourceItem {
  ref_index: number;
  ref_tag: string;
  chunk_id: string;
  file_id: string;
  filename: string;
  page_number?: number;
  section_header?: string;
  score: number;
  snippet?: string;
}

interface RagSourcesStripProps {
  sources: RagSourceItem[];
  /** Open the grounded citation in a real viewer (PDF page or snippet). */
  onSelectSource: (source: RagSourceItem) => void;
  className?: string;
}

/**
 * Grounded RAG knowledge-base citation strip.
 *
 * Reused by both the main conversation (`ChatMessage`) and the Learning Studio
 * tutor pane so citations keep one renderer and one interaction contract.
 */
export function RagSourcesStrip({
  sources,
  onSelectSource,
  className,
}: RagSourcesStripProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!sources?.length) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Surface
        variant="muted"
        radius="widget"
        className={cn(
          "mb-2 border-0 bg-info-bg p-1.5 select-none animate-in fade-in-50 duration-150 motion-reduce:animate-none",
          className,
        )}
      >
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto w-full justify-between px-1 py-1.5 text-left"
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Sparkles className="size-3.5 text-info" />
              <span>Verified sources</span>
              <Badge variant="info">{sources.length}</Badge>
            </span>
            <span className="text-foreground-muted">{isOpen ? "Hide" : "Show"}</span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-1 pb-1">
          <div className="flex flex-wrap gap-1.5 pt-1.5">
            {sources.map((src) => (
              <Button
                key={`${src.chunk_id}-${src.ref_index}`}
                variant="outline"
                size="sm"
                onClick={() => onSelectSource(src)}
                className="group/src h-auto items-center space-x-1.5 border-info/30 bg-surface px-2.5 py-1 text-xs text-foreground-muted hover:bg-surface-hover hover:shadow-xs"
                title={
                  src.snippet
                    ? `Snippet: ${src.snippet.slice(0, 160)}...`
                    : src.filename
                }
              >
                <FileText className="size-3.5 text-info" />
                <span className="max-w-[200px] truncate font-medium text-foreground">
                  {src.filename}
                </span>
                {src.page_number && (
                  <Badge variant="info" className="font-mono">
                    p. {src.page_number}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </CollapsibleContent>
      </Surface>
    </Collapsible>
  );
}
