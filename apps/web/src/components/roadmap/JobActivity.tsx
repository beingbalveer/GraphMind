"use client";
import { Check, Loader2 } from "lucide-react";
import type { JobEventData } from "@/lib/roadmapTypes";

const STAGE_LABELS: Record<string, string> = {
  understand: "Understand",
  research: "Research",
  compose: "Compose",
  personalize: "Plan",
  validate: "Check",
  publish: "Publish",
};

/** Readable labels for the per-tool lines that stay in the feed. */
const TOOL_LABELS: Record<string, string> = {
  search_web: "web search",
  fetch_source: "source",
  read_reference: "reference",
  list_skills: "skill",
  load_skill: "skill",
};

export function JobActivity({
  events,
  active = false,
}: {
  events: JobEventData[];
  /** When the job is still running, the latest step shows a spinner. */
  active?: boolean;
}) {
  // Newest first. Events arrive in ascending `sequence` order; reverse for a
  // console-style feed where the latest step sits on top.
  const rows = [...events].sort((a, b) => b.sequence - a.sequence);
  const current = active ? rows[0] : undefined; // eslint-disable-line @typescript-eslint/no-unnecessary-condition

  return (
    <div className="border-t border-border-subtle pt-4">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-medium text-foreground">Agent steps</h4>
        {current && (
          <Loader2
            aria-hidden="true"
            className="size-3.5 animate-spin text-foreground-muted"
          />
        )}
      </div>
      <ol className="space-y-2.5 py-3 text-sm">
        {rows.map((event) => {
          const isCurrent = current === event;
          const stage = STAGE_LABELS[event.stage] ?? event.stage;
          const tool =
            typeof event.metadata.tool === "string"
              ? (TOOL_LABELS[event.metadata.tool] ?? event.metadata.tool)
              : null;
          return (
            <li key={event.sequence} className="flex items-start gap-2.5">
              {isCurrent ? (
                <Loader2
                  aria-label="Working"
                  className="mt-0.5 size-3.5 shrink-0 animate-spin text-primary"
                />
              ) : (
                <Check
                  aria-hidden="true"
                  className="mt-0.5 size-3.5 shrink-0 text-success"
                />
              )}
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-foreground">
                  <span className="font-mono text-2xs uppercase tracking-wide text-foreground-subtle">
                    {stage}
                  </span>
                  {tool && (
                    <span className="font-mono text-2xs text-foreground-muted">
                      {tool}
                    </span>
                  )}
                  <span>{event.summary}</span>
                </p>
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
              </div>
            </li>
          );
        })}
      </ol>
      {rows.length === 0 && (
        <p className="py-3 text-sm text-foreground-muted">
          The agent&rsquo;s next step will appear here while your roadmap is built.
        </p>
      )}
    </div>
  );
}
