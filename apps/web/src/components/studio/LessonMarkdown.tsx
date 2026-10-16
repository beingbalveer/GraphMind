"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface LessonMarkdownProps {
  markdown: string;
  className?: string;
}

/**
 * LessonMarkdown — the shared, dependency-free lesson body renderer.
 *
 * Renders the authored lesson markdown that the curriculum pipeline produces
 * (`#`/`##`/`###` headings, fenced code blocks, blank-line-separated
 * paragraphs) using the standard typography scale and semantic tokens. It is
 * deliberately narrow: only the constructs the generator emits are formatted, so
 * a guest never receives raw HTML.
 */
export function LessonMarkdown({ markdown, className }: LessonMarkdownProps) {
  return (
    <div
      data-testid="lesson-markdown"
      className={cn("prose prose-sm dark:prose-invert max-w-none space-y-4", className)}
    >
      {markdown.split("\n\n").map((paragraph, index) => {
        const trimmed = paragraph.trim();
        if (trimmed.startsWith("# ")) {
          return (
            <h1 key={index} className="mt-6 mb-3 text-xl font-bold text-foreground">
              {trimmed.replace("# ", "")}
            </h1>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h2 key={index} className="mt-5 mb-2 text-lg font-semibold text-foreground">
              {trimmed.replace("## ", "")}
            </h2>
          );
        }
        if (trimmed.startsWith("### ")) {
          return (
            <h3 key={index} className="mt-4 mb-2 text-base font-medium text-foreground">
              {trimmed.replace("### ", "")}
            </h3>
          );
        }
        if (trimmed.startsWith("```")) {
          const lines = trimmed.split("\n");
          const language = lines[0].replace("```", "");
          const code = lines.slice(1, -1).join("\n");
          return (
            <div
              key={index}
              className="my-4 overflow-hidden rounded-xl border border-border-subtle bg-surface"
            >
              {language && (
                <div className="border-b border-border-subtle bg-surface-hover px-4 py-1.5 font-mono text-2xs uppercase text-foreground-muted">
                  {language}
                </div>
              )}
              <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-foreground">
                <code>{code}</code>
              </pre>
            </div>
          );
        }
        return (
          <p key={index} className="text-sm leading-6 text-foreground-muted">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}
