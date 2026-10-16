"use client";

import React from "react";
import {
  AlertCircle,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Lightbulb,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LessonMarkdown } from "./LessonMarkdown";
import type { PublicLessonDetail } from "@/lib/publicSnapshotApi";
import { cn } from "@/lib/utils";

const FORMAT_BADGE: Record<
  NonNullable<PublicLessonDetail["format"]>,
  "default" | "secondary" | "info"
> = {
  concepts: "info",
  practice: "secondary",
  project: "default",
};

export interface PublicLessonNeighbour {
  slug: string;
  title: string;
}

export interface PublicLessonReaderProps {
  lesson: PublicLessonDetail | null;
  roadmapTitle?: string | null;
  phaseTitle?: string | null;
  lessonIndex?: number;
  totalLessons?: number;
  isLoading?: boolean;
  notFound?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onBack: () => void;
  onOpenTopic: (topicSlug: string) => void;
  prev?: PublicLessonNeighbour | null;
  next?: PublicLessonNeighbour | null;
  /** Gated private action: sends a guest to sign in, never writes progress. */
  onRequireSignIn: () => void;
  className?: string;
}

/**
 * PublicLessonReader — read-only guest reader for one published lesson
 * (LSI-030).
 *
 * Renders the authored lesson body (or an honest "not generated yet" state when
 * the snapshot has no body), its objectives, practice prompt, and verified
 * sources. Everything is read-only: progress tracking and tutoring are gated
 * behind sign-in, so a guest never triggers a private mutation.
 */
export function PublicLessonReader({
  lesson,
  roadmapTitle,
  phaseTitle,
  lessonIndex = 0,
  totalLessons = 1,
  isLoading = false,
  notFound = false,
  error = null,
  onRetry,
  onBack,
  onOpenTopic,
  prev = null,
  next = null,
  onRequireSignIn,
  className,
}: PublicLessonReaderProps) {
  if (isLoading) {
    return (
      <div
        data-testid="public-lesson-loading"
        className={cn("mx-auto max-w-3xl px-6 py-10 md:px-10", className)}
      >
        <div className="h-4 w-32 animate-pulse rounded-md bg-muted" />
        <div className="mt-5 h-8 w-3/4 animate-pulse rounded-md bg-muted" />
        <div className="mt-6 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-4 w-full animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div
        data-testid="public-lesson-not-found"
        className={cn("mx-auto max-w-2xl px-6 py-20 text-center md:px-10", className)}
      >
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted text-foreground-muted">
          <BookOpen className="size-6" />
        </div>
        <h1 className="text-lg font-semibold">This lesson is not available</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-foreground-muted">
          It may have been unpublished or replaced in a newer snapshot.
        </p>
        <div className="mt-5 flex justify-center">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="mr-1 size-4" />
            Back to roadmap
          </Button>
        </div>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div
        data-testid="public-lesson-error"
        className={cn("mx-auto max-w-3xl px-6 py-16 md:px-10", className)}
      >
        <div className="flex items-start justify-between gap-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div>
              <h2 className="text-sm font-semibold text-destructive">
                Failed to load this lesson
              </h2>
              <p className="mt-1 text-xs text-foreground-muted">
                {error ?? "This lesson could not be loaded."}
              </p>
            </div>
          </div>
          {onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry} className="shrink-0">
              <RefreshCw className="mr-1.5 size-3.5" />
              Retry
            </Button>
          )}
        </div>
      </div>
    );
  }

  const hasBody = Boolean(lesson.contentMarkdown && lesson.contentMarkdown.trim());

  return (
    <div
      data-testid="public-lesson-reader"
      className={cn("mx-auto max-w-3xl px-6 py-10 md:px-10", className)}
    >
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-foreground-muted">
          <ChevronLeft className="size-4" />
          {roadmapTitle ?? "Back to roadmap"}
        </Button>
        <span className="text-xs text-foreground-muted">
          Lesson {lessonIndex + 1} of {totalLessons}
        </span>
      </div>

      <header className="mt-6">
        {phaseTitle && (
          <p className="text-xs uppercase tracking-wide text-foreground-muted">
            {phaseTitle}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {lesson.format && (
            <Badge variant={FORMAT_BADGE[lesson.format]}>
              {lesson.format.charAt(0).toUpperCase() + lesson.format.slice(1)}
            </Badge>
          )}
          {lesson.estimateMinutes != null && (
            <span className="inline-flex items-center gap-1.5 text-xs text-foreground-muted">
              <Clock3 className="size-3.5" />
              {lesson.estimateMinutes} min
            </span>
          )}
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight sm:text-2xl">
          {lesson.title}
        </h1>
        {lesson.brief && (
          <p className="mt-2 text-sm leading-6 text-foreground-muted">{lesson.brief}</p>
        )}
      </header>

      {lesson.objectives.length > 0 && (
        <section className="mt-6 rounded-2xl border border-border-subtle bg-surface p-5">
          <h2 className="text-sm font-semibold">Learning objectives</h2>
          <ul className="mt-3 space-y-2">
            {lesson.objectives.map((objective) => (
              <li
                key={objective}
                className="flex items-start gap-2 text-sm text-foreground-muted"
              >
                <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-primary" />
                {objective}
              </li>
            ))}
          </ul>
        </section>
      )}

      <article data-lesson-content className="mt-8 space-y-6">
        {hasBody ? (
          <LessonMarkdown markdown={lesson.contentMarkdown as string} />
        ) : (
          <div
            data-testid="public-lesson-body-pending"
            className="rounded-2xl border border-border-subtle bg-surface p-5"
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-lg bg-surface-hover p-2 text-foreground-muted">
                <BookOpen className="size-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-foreground">
                  Full lesson body not published yet
                </h2>
                <p className="text-xs text-foreground-muted">
                  This snapshot does not include an authored lesson body. Use the
                  objectives and cited sources below to study this topic.
                </p>
              </div>
            </div>
          </div>
        )}

        {lesson.exercise && (
          <div className="rounded-2xl border border-border-subtle bg-surface p-5">
            <div className="flex items-center gap-2">
              <Lightbulb className="size-4 text-primary" />
              <h2 className="text-sm font-semibold">Practice</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-foreground-muted">
              {lesson.exercise}
            </p>
          </div>
        )}

        {lesson.sources.length > 0 && (
          <div className="rounded-2xl border border-border-subtle bg-surface p-5">
            <h2 className="text-sm font-semibold">Verified sources</h2>
            <ul className="mt-3 space-y-2">
              {lesson.sources.map((source) =>
                source.url ? (
                  <li key={source.id}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      {source.title}
                      <ExternalLink className="size-3.5" />
                    </a>
                  </li>
                ) : (
                  <li key={source.id} className="text-sm text-foreground-muted">
                    {source.title}
                  </li>
                ),
              )}
            </ul>
          </div>
        )}
      </article>

      <div className="mt-8 flex items-center justify-center">
        <Button variant="outline" onClick={onRequireSignIn} className="gap-1.5">
          <Sparkles className="size-4" />
          Sign in to track progress and ask the tutor
        </Button>
      </div>

      <nav
        data-testid="public-lesson-nav"
        className="mt-8 flex items-center justify-between gap-3"
        aria-label="Lesson navigation"
      >
        <Button
          variant="outline"
          onClick={() => prev && onOpenTopic(prev.slug)}
          disabled={!prev}
          className="max-w-[45%] justify-start"
        >
          <ChevronLeft className="mr-1 size-4 shrink-0" />
          <span className="truncate">{prev ? prev.title : "Previous"}</span>
        </Button>
        <Button
          variant="outline"
          onClick={() => next && onOpenTopic(next.slug)}
          disabled={!next}
          className="max-w-[45%] justify-end"
        >
          <span className="truncate">{next ? next.title : "Next"}</span>
          <ChevronRight className="ml-1 size-4 shrink-0" />
        </Button>
      </nav>
    </div>
  );
}
