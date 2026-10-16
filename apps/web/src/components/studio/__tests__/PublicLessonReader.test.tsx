import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PublicLessonReader } from "../PublicLessonReader";
import type { PublicLessonDetail } from "@/lib/publicSnapshotApi";

const lesson: PublicLessonDetail = {
  templateId: "tmpl-python",
  snapshotVersion: "2026-10-15.1",
  topicId: "pub_topic_async",
  topicSlug: "async-basics",
  title: "Async basics",
  brief: "Cooperative scheduling.",
  objectives: ["Explain the event loop"],
  contentMarkdown: "## Event loop\n\nA loop that schedules coroutines.",
  exercise: "Write a concurrent gather.",
  format: "practice",
  estimateMinutes: 30,
  sources: [
    {
      id: "pub_src_1",
      title: "FastAPI docs",
      url: "https://fastapi.tiangolo.com",
      locator: null,
      kind: "article",
    },
  ],
};

function renderReader(overrides: Partial<React.ComponentProps<typeof PublicLessonReader>> = {}) {
  const props = {
    lesson,
    roadmapTitle: "Python Backend",
    phaseTitle: "Phase 1: Async",
    lessonIndex: 0,
    totalLessons: 3,
    onBack: vi.fn(),
    onOpenTopic: vi.fn(),
    onRequireSignIn: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
  render(<PublicLessonReader {...props} />);
  return props;
}

describe("PublicLessonReader (LSI-030)", () => {
  it("renders a loading skeleton", () => {
    renderReader({ lesson: null, isLoading: true });
    expect(screen.getByTestId("public-lesson-loading")).toBeInTheDocument();
  });

  it("shows the neutral not-available state with a back action", () => {
    const props = renderReader({ lesson: null, notFound: true });
    expect(screen.getByTestId("public-lesson-not-found")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /back to roadmap/i }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });

  it("shows an error banner with retry", () => {
    const props = renderReader({ lesson: null, error: "Network error" });
    expect(screen.getByTestId("public-lesson-error")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders the authored lesson body, objectives, practice, and sources", () => {
    renderReader();
    expect(screen.getByRole("heading", { name: "Async basics" })).toBeInTheDocument();
    expect(screen.getByText("Phase 1: Async")).toBeInTheDocument();
    expect(screen.getByText("Explain the event loop")).toBeInTheDocument();
    expect(screen.getByTestId("lesson-markdown")).toBeInTheDocument();
    expect(screen.getByText("Write a concurrent gather.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /fastapi docs/i })).toBeInTheDocument();
    expect(screen.getByText("Lesson 1 of 3")).toBeInTheDocument();
    expect(screen.queryByTestId("public-lesson-body-pending")).not.toBeInTheDocument();
  });

  it("states honestly when the snapshot has no authored body", () => {
    renderReader({ lesson: { ...lesson, contentMarkdown: null } });
    expect(screen.getByTestId("public-lesson-body-pending")).toBeInTheDocument();
    expect(screen.queryByTestId("lesson-markdown")).not.toBeInTheDocument();
  });

  it("navigates to previous and next lessons, disabling the ends", () => {
    const props = renderReader({
      prev: { slug: "intro", title: "Intro" },
      next: { slug: "databases", title: "Async databases" },
    });

    fireEvent.click(screen.getByRole("button", { name: /async databases/i }));
    expect(props.onOpenTopic).toHaveBeenCalledWith("databases");

    fireEvent.click(screen.getByRole("button", { name: /intro/i }));
    expect(props.onOpenTopic).toHaveBeenCalledWith("intro");
  });

  it("disables lesson navigation at the ends", () => {
    renderReader({ prev: null, next: null });
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("gates progress tracking and tutoring behind sign-in", () => {
    const props = renderReader();
    fireEvent.click(
      screen.getByRole("button", { name: /sign in to track progress and ask the tutor/i }),
    );
    expect(props.onRequireSignIn).toHaveBeenCalledTimes(1);
  });
});
