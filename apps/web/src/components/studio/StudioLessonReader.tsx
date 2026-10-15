"use client";

import React, { useRef, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Lightbulb,
  MessageSquare,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useReadingPosition } from "@/lib/readingPosition";
import type {
  CurriculumItemData,
  SourceData,
  TopicBrief,
} from "@/lib/roadmapTypes";

export interface StudioLessonReaderProps {
  workspaceId: string;
  topic: CurriculumItemData;
  brief?: TopicBrief | null;
  phaseTitle?: string;
  lessonIndex?: number;
  totalLessons?: number;
  sources?: SourceData[];
  isCompleted?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  onBackToOutline?: () => void;
  onPrevLesson?: () => void;
  onNextLesson?: () => void;
  onToggleComplete?: () => void;
  onAskTutor?: (quote?: string) => void;
}

export function StudioLessonReader({
  workspaceId,
  topic,
  brief,
  phaseTitle,
  lessonIndex = 0,
  totalLessons = 1,
  sources = [],
  isCompleted = false,
  isFirst = false,
  isLast = false,
  onBackToOutline,
  onPrevLesson,
  onNextLesson,
  onToggleComplete,
  onAskTutor,
}: StudioLessonReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedQuote, setSelectedQuote] = useState<string | null>(null);
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);

  const { restored } = useReadingPosition(workspaceId, topic.id, containerRef);

  // Content resolution:
  // Tier 1: Authored item markdown
  // Tier 2: Saved lesson assistant node content
  // Tier 3: Honest brief state (none generated yet)
  const authoredMarkdown = topic.contentMarkdown || brief?.item?.contentMarkdown;
  const savedLessonContent = brief?.savedLessonContent;
  const activeContent = authoredMarkdown || savedLessonContent;
  const isHonestBriefState = !activeContent;

  // Filter sources relevant to this topic
  const topicResources = brief?.resources ?? [];
  const relevantSources: Array<{ source: SourceData; rationale?: string }> =
    topicResources.length > 0
      ? topicResources.map((r) => ({
          source: r.source,
          rationale: r.rationale,
        }))
      : sources.map((s) => ({ source: s }));

  const captureSelection = (): boolean => {
    if (typeof window === "undefined") return false;
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return false;

    const text = selection.toString().trim();
    if (!text) return false;

    const range = selection.getRangeAt(0);
    const contentContainer = document.querySelector("[data-lesson-content]");

    if (contentContainer && contentContainer.contains(range.commonAncestorContainer)) {
      setSelectedQuote(text);
      setSelectionNotice(null);
      return true;
    }

    return false;
  };

  const handleRequestCapture = () => {
    const success = captureSelection();
    if (!success) {
      setSelectionNotice(
        "Select text from the lesson reading first. Controls, reflection prompts, and reference sources are not included."
      );
    }
  };

  const formatBadgeVariant = (
    fmt?: string | null
  ): "default" | "secondary" | "outline" => {
    switch (fmt) {
      case "practice":
        return "secondary";
      case "project":
        return "default";
      default:
        return "outline";
    }
  };

  const sourceVerificationVariant = (
    status: SourceData["status"]
  ): "success" | "outline" | "destructive" => {
    switch (status) {
      case "grounded":
        return "success";
      case "inspected":
        return "outline";
      case "unavailable":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 md:px-10 lg:px-16"
      tabIndex={0}
      aria-label="Lesson reader stage"
    >
      <div className="mx-auto max-w-3xl space-y-8 pb-16">
        {/* Navigation Breadcrumb & Meta */}
        <div className="space-y-3 border-b border-border-subtle pb-5">
          <nav
            aria-label="Lesson breadcrumb"
            className="flex items-center gap-2 text-xs text-foreground-muted"
          >
            {onBackToOutline && (
              <>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs text-foreground-muted hover:text-foreground"
                  onClick={onBackToOutline}
                >
                  Roadmap Outline
                </Button>
                <span aria-hidden="true">›</span>
              </>
            )}
            {phaseTitle && <span className="truncate">{phaseTitle}</span>}
          </nav>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-mono text-2xs uppercase">
                LESSON {String(lessonIndex + 1).padStart(2, "0")} /{" "}
                {String(totalLessons).padStart(2, "0")}
              </Badge>
              {topic.estimateMinutes && (
                <Badge variant="outline" className="text-2xs">
                  {topic.estimateMinutes} min
                </Badge>
              )}
              {topic.format && (
                <Badge
                  variant={formatBadgeVariant(topic.format)}
                  className="text-2xs uppercase"
                >
                  {topic.format}
                </Badge>
              )}
              {isCompleted ? (
                <Badge variant="success" className="gap-1 text-2xs">
                  <CheckCircle2 className="size-3" />
                  Completed
                </Badge>
              ) : (
                <Badge variant="outline" className="text-2xs">
                  In Progress
                </Badge>
              )}
            </div>

            {restored && (
              <span className="text-2xs text-foreground-subtle animate-fade-in">
                Resumed reading position
              </span>
            )}
          </div>

          <h1
            id="lesson-heading"
            className="text-xl sm:text-2xl font-bold tracking-tight text-foreground"
          >
            {topic.title}
          </h1>

          {topic.brief && (
            <p className="text-sm leading-relaxed text-foreground-muted">
              {topic.brief}
            </p>
          )}
        </div>

        {/* Tier 1 / 2: Real Authored or Saved Lesson Markdown */}
        {!isHonestBriefState ? (
          <article
            data-lesson-content
            onMouseUp={captureSelection}
            className="space-y-6 text-foreground leading-relaxed"
          >
            <div className="prose prose-sm dark:prose-invert max-w-none space-y-4">
              {activeContent.split("\n\n").map((para, i) => {
                const trimmed = para.trim();
                if (trimmed.startsWith("# ")) {
                  return (
                    <h1 key={i} className="text-xl font-bold mt-6 mb-3">
                      {trimmed.replace("# ", "")}
                    </h1>
                  );
                }
                if (trimmed.startsWith("## ")) {
                  return (
                    <h2 key={i} className="text-lg font-semibold mt-5 mb-2">
                      {trimmed.replace("## ", "")}
                    </h2>
                  );
                }
                if (trimmed.startsWith("### ")) {
                  return (
                    <h3 key={i} className="text-base font-medium mt-4 mb-2">
                      {trimmed.replace("### ", "")}
                    </h3>
                  );
                }
                if (trimmed.startsWith("```")) {
                  const lines = trimmed.split("\n");
                  const lang = lines[0].replace("```", "");
                  const code = lines.slice(1, -1).join("\n");
                  return (
                    <div
                      key={i}
                      className="my-4 overflow-hidden rounded-xl border border-border-subtle bg-surface"
                    >
                      {lang && (
                        <div className="border-b border-border-subtle bg-surface-hover px-4 py-1.5 text-2xs font-mono text-foreground-muted uppercase">
                          {lang}
                        </div>
                      )}
                      <pre className="overflow-x-auto p-4 text-xs font-mono leading-relaxed text-foreground">
                        <code>{code}</code>
                      </pre>
                    </div>
                  );
                }
                return (
                  <p key={i} className="text-sm leading-6 text-foreground-muted">
                    {trimmed}
                  </p>
                );
              })}
            </div>
          </article>
        ) : (
          /* Tier 3: Honest Brief & Non-Presumptuous State */
          <div className="space-y-6">
            <div className="rounded-2xl border border-border-subtle bg-surface p-5 sm:p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-surface-hover p-2 text-foreground-muted shrink-0">
                  <BookOpen className="size-5" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-base font-semibold text-foreground">
                    Lesson Overview & Core Concepts
                  </h2>
                  <p className="text-xs text-foreground-muted">
                    Full lesson body has not been generated for this topic yet.
                    You can study the learning objectives, practice reflection, and
                    cited verified sources below.
                  </p>
                </div>
              </div>

              {/* Learning Objectives */}
              {topic.objectives && topic.objectives.length > 0 && (
                <div className="pt-2 space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                    Key Learning Objectives
                  </h3>
                  <ul className="space-y-2">
                    {topic.objectives.map((obj, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs leading-5 text-foreground"
                      >
                        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xs text-primary font-semibold mt-0.5">
                          {i + 1}
                        </span>
                        <span>{obj}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Honest Notice */}
            <div className="rounded-xl border border-border-subtle bg-background-secondary p-4 flex items-center gap-3 text-xs text-foreground-muted">
              <Sparkles className="size-4 shrink-0 text-primary" />
              <span>
                Reading does not implicitly create a chat session or stream an AI
                response; you are viewing verified curriculum structure and reference
                materials.
              </span>
            </div>
          </div>
        )}

        {/* Practice / Pause and Reflect */}
        {topic.exercise && (
          <section
            aria-labelledby="reflection-heading"
            className="rounded-2xl border border-border-subtle bg-surface p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="size-4 text-warning" />
              <h2
                id="reflection-heading"
                className="text-sm font-semibold text-foreground"
              >
                Pause & Practice
              </h2>
            </div>
            <p className="text-xs sm:text-sm leading-6 text-foreground-muted">
              {topic.exercise}
            </p>
          </section>
        )}

        {/* Selected Passage & Tutor Quoting Controls */}
        <section
          aria-labelledby="tutor-passage-heading"
          className="rounded-2xl border border-border-subtle bg-surface p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2
              id="tutor-passage-heading"
              className="text-sm font-semibold text-foreground flex items-center gap-2"
            >
              <MessageSquare className="size-4 text-primary" />
              Interactive Lesson Discussion
            </h2>
          </div>

          <p className="text-xs leading-5 text-foreground-muted">
            Have questions about this topic? Highlight any text in the lesson
            reading to ask the AI tutor with specific context, or start a general
            discussion.
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onPointerDown={(e) => e.preventDefault()}
              onClick={handleRequestCapture}
            >
              Ask about selected passage
            </Button>
            <Button
              size="sm"
              onClick={() => onAskTutor?.(selectedQuote || undefined)}
            >
              {selectedQuote ? "Ask tutor with passage" : "Ask tutor about this topic"}
            </Button>
          </div>

          {selectionNotice && (
            <p role="status" className="text-xs text-foreground-muted">
              {selectionNotice}
            </p>
          )}

          {selectedQuote && (
            <div className="rounded-xl border border-border-subtle bg-background-secondary p-3 space-y-1.5">
              <div className="flex items-center justify-between text-2xs font-semibold text-foreground-muted uppercase tracking-wider">
                <span>Selected Passage</span>
                <Button
                  size="iconSm"
                  variant="ghost"
                  aria-label="Remove quoted passage"
                  onClick={() => setSelectedQuote(null)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
              <blockquote className="border-l-2 border-primary pl-3 text-xs leading-5 text-foreground italic">
                &ldquo;{selectedQuote}&rdquo;
              </blockquote>
            </div>
          )}
        </section>

        {/* Verified Reference Sources */}
        <section
          aria-labelledby="sources-heading"
          className="rounded-2xl border border-border-subtle bg-surface p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2
              id="sources-heading"
              className="text-sm font-semibold text-foreground flex items-center gap-2"
            >
              <FileText className="size-4 text-foreground-muted" />
              Verified Reference Sources
            </h2>
            <Badge variant="outline" className="text-2xs">
              {relevantSources.length}{" "}
              {relevantSources.length === 1 ? "source" : "sources"}
            </Badge>
          </div>

          {relevantSources.length === 0 ? (
            <p className="text-xs text-foreground-muted">
              No specific external reference sources attached to this topic.
            </p>
          ) : (
            <div className="grid gap-3">
              {relevantSources.map(({ source, rationale }) => {
                const isExpanded = expandedSourceId === source.id;
                return (
                  <div
                    key={source.id}
                    className="rounded-xl border border-border-subtle bg-background-secondary p-4 space-y-2.5 transition-colors"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-semibold text-foreground">
                            {source.title}
                          </span>
                          <Badge
                            variant={sourceVerificationVariant(source.status)}
                            className="text-2xs"
                          >
                            {source.status}
                          </Badge>
                          <Badge variant="outline" className="text-2xs uppercase">
                            {source.access}
                          </Badge>
                          {source.kind && (
                            <Badge variant="secondary" className="text-2xs">
                              {source.kind}
                            </Badge>
                          )}
                        </div>

                        {source.locator && (
                          <div className="text-2xs font-mono text-foreground-subtle truncate">
                            Locator: {source.locator}
                          </div>
                        )}
                      </div>

                      {source.url && (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                        >
                          <span>Official Reference</span>
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>

                    {rationale && (
                      <p className="text-xs text-foreground-muted">
                        <span className="font-medium text-foreground">Rationale: </span>
                        {rationale}
                      </p>
                    )}

                    {source.evidence && (
                      <div className="space-y-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 text-2xs text-foreground-muted hover:text-foreground"
                          onClick={() =>
                            setExpandedSourceId(isExpanded ? null : source.id)
                          }
                        >
                          {isExpanded ? "Hide source excerpt" : "View source excerpt"}
                        </Button>
                        {isExpanded && (
                          <blockquote className="rounded-lg bg-surface p-3 text-2xs leading-relaxed text-foreground-muted border border-border-subtle">
                            {source.evidence}
                          </blockquote>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Footer Navigation */}
        <footer className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border-subtle pt-6">
          <Button
            variant="ghost"
            size="sm"
            disabled={isFirst}
            onClick={onPrevLesson}
            className="w-full sm:w-auto"
          >
            <ChevronLeft className="size-4" />
            Previous lesson
          </Button>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant={isCompleted ? "secondary" : "outline"}
              size="sm"
              onClick={onToggleComplete}
            >
              {isCompleted ? (
                <>
                  <CheckCircle2 className="size-3.5 text-success" />
                  Completed
                </>
              ) : (
                "Mark as complete"
              )}
            </Button>

            <Button size="sm" onClick={onNextLesson}>
              {isLast ? "Finish roadmap" : "Continue to next lesson"}
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
