"use client";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { JobEventData } from "@/lib/roadmapTypes";
export function JobActivity({ events }: { events: JobEventData[] }) {
  return (
    <Collapsible className="border-t border-border-subtle pt-4">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between text-foreground-muted"
        >
          View activity
          <ChevronDown className="size-4" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol className="space-y-3 py-3 text-sm">
          {events.map((event) => (
            <li key={event.sequence} className="space-y-1">
              <p>{event.summary}</p>
              {typeof event.metadata.sourceUrl === "string" && (
                <a
                  href={event.metadata.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block break-words text-xs text-foreground-muted underline"
                >
                  {typeof event.metadata.sourceTitle === "string"
                    ? event.metadata.sourceTitle
                    : event.metadata.sourceUrl}
                </a>
              )}
              {typeof event.metadata.skill === "string" && (
                <p className="text-xs text-foreground-muted">
                  {event.metadata.skill}
                </p>
              )}
            </li>
          ))}
        </ol>
        {events.length === 0 && (
          <p className="py-3 text-sm text-foreground-muted">
            Activity appears when the agent starts.
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
