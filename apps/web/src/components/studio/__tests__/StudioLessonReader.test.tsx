import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StudioLessonReader } from "../StudioLessonReader";
import type { CurriculumItemData, SourceData, TopicBrief } from "@/lib/roadmapTypes";
import { saveReadingPosition, getReadingPositionKey } from "@/lib/readingPosition";

describe("StudioLessonReader", () => {
  const mockTopic: CurriculumItemData = {
    id: "topic_1",
    kind: "topic",
    title: "Understanding Python Event Loops",
    brief: "Detailed guide to asynchronous I/O and task cooperative scheduling.",
    objectives: [
      "Explain the single-threaded event loop cycle",
      "Differentiate between coroutines and futures",
    ],
    exercise: "Write a small asyncio routine that runs two tasks concurrently.",
    format: "concepts",
    order: 1,
    path: "core",
    estimateMinutes: 30,
    participation: "active",
  };

  const mockSources: SourceData[] = [
    {
      id: "src_1",
      title: "Python asyncio Official Documentation",
      url: "https://docs.python.org/3/library/asyncio.html",
      referenceId: null,
      locator: "https://docs.python.org/3/library/asyncio.html",
      verifiedAt: "2026-10-15T00:00:00Z",
      status: "grounded",
      access: "free",
      kind: "documentation",
      evidence: "asyncio provides infrastructure for managing the event loop.",
      provenance: {},
    },
    {
      id: "src_2",
      title: "PEP 492 Coroutines with async and await",
      url: "https://peps.python.org/pep-0492/",
      referenceId: null,
      locator: "https://peps.python.org/pep-0492/",
      verifiedAt: "2026-10-15T00:00:00Z",
      status: "inspected",
      access: "free",
      kind: "article",
      evidence: "Defines the async/await syntax in modern Python.",
      provenance: {},
    },
  ];

  let storage: Record<string, string> = {};

  beforeEach(() => {
    storage = {};
    const localStorageMock = {
      getItem: vi.fn((key: string) => storage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete storage[key];
      }),
      clear: vi.fn(() => {
        storage = {};
      }),
    };
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });
    vi.clearAllMocks();
  });

  it("renders Tier 3 honest brief state when no markdown body exists", () => {
    render(
      <StudioLessonReader
        workspaceId="ws_1"
        topic={mockTopic}
        phaseTitle="Phase 1: Foundations"
        lessonIndex={0}
        totalLessons={3}
        sources={mockSources}
      />
    );

    expect(screen.getByText("Understanding Python Event Loops")).toBeInTheDocument();
    expect(screen.getByText("Phase 1: Foundations")).toBeInTheDocument();
    expect(screen.getByText(/LESSON 01 \/ 03/)).toBeInTheDocument();
    expect(screen.getByText(/30 min/)).toBeInTheDocument();

    // Objectives rendered
    expect(screen.getByText("Explain the single-threaded event loop cycle")).toBeInTheDocument();
    expect(screen.getByText("Differentiate between coroutines and futures")).toBeInTheDocument();

    // Honest brief notice
    expect(
      screen.getByText(/Full lesson body has not been generated for this topic yet/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Reading does not implicitly create a chat session/)
    ).toBeInTheDocument();

    // Pause & practice exercise
    expect(
      screen.getByText("Write a small asyncio routine that runs two tasks concurrently.")
    ).toBeInTheDocument();
  });

  it("renders Tier 1 authored markdown when contentMarkdown is present on item", () => {
    const authoredTopic: CurriculumItemData = {
      ...mockTopic,
      contentMarkdown: `# Event Loops Deep Dive\n\nThis is the complete authored lesson content.\n\n\`\`\`python\nimport asyncio\nawait asyncio.sleep(1)\n\`\`\``,
    };

    render(
      <StudioLessonReader
        workspaceId="ws_1"
        topic={authoredTopic}
        lessonIndex={1}
        totalLessons={5}
      />
    );

    expect(screen.getByText("Event Loops Deep Dive")).toBeInTheDocument();
    expect(
      screen.getByText("This is the complete authored lesson content.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/import asyncio/)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Full lesson body has not been generated/)
    ).not.toBeInTheDocument();
  });

  it("renders Tier 2 saved lesson content from server TopicBrief assistant node", () => {
    const briefWithSavedLesson: TopicBrief = {
      item: mockTopic,
      resources: [],
      prerequisites: [],
      progress: { topicId: mockTopic.id, status: "in_progress", completedAt: null },
      defaultChatId: "node_chat_1",
      latestCheck: null,
      savedLessonContent: "## Saved Assistant Lesson\n\nServer generated lesson from previous tutoring session.",
    };

    render(
      <StudioLessonReader
        workspaceId="ws_1"
        topic={mockTopic}
        brief={briefWithSavedLesson}
      />
    );

    expect(screen.getByText("Saved Assistant Lesson")).toBeInTheDocument();
    expect(
      screen.getByText("Server generated lesson from previous tutoring session.")
    ).toBeInTheDocument();
  });

  it("renders verified reference sources with badges and expandable locator excerpts", () => {
    render(
      <StudioLessonReader
        workspaceId="ws_1"
        topic={mockTopic}
        sources={mockSources}
      />
    );

    expect(screen.getByText("Python asyncio Official Documentation")).toBeInTheDocument();
    expect(screen.getByText("PEP 492 Coroutines with async and await")).toBeInTheDocument();
    expect(screen.getByText("grounded")).toBeInTheDocument();
    expect(screen.getByText("inspected")).toBeInTheDocument();

    // Toggle source excerpt
    const excerptBtns = screen.getAllByRole("button", { name: "View source excerpt" });
    fireEvent.click(excerptBtns[0]);
    expect(
      screen.getByText("asyncio provides infrastructure for managing the event loop.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide source excerpt" })).toBeInTheDocument();
  });

  it("handles passage selection and quote capture properly", () => {
    const onAskTutor = vi.fn();
    const authoredTopic: CurriculumItemData = {
      ...mockTopic,
      contentMarkdown: "# Async Introduction\n\nCooperative multitasking enables non-blocking IO without threads.",
    };

    render(
      <StudioLessonReader
        workspaceId="ws_1"
        topic={authoredTopic}
        onAskTutor={onAskTutor}
      />
    );

    // Clicking without selecting text warns user
    const askPassageBtn = screen.getByRole("button", { name: "Ask about selected passage" });
    fireEvent.click(askPassageBtn);
    expect(
      screen.getByText(/Select text from the lesson reading first/)
    ).toBeInTheDocument();

    // General question asks without quote
    const askGeneralBtn = screen.getByRole("button", { name: "Ask tutor about this topic" });
    fireEvent.click(askGeneralBtn);
    expect(onAskTutor).toHaveBeenCalledWith(undefined);
  });

  it("navigates previous and next lessons and toggles completion", () => {
    const onPrevLesson = vi.fn();
    const onNextLesson = vi.fn();
    const onToggleComplete = vi.fn();

    const { rerender } = render(
      <StudioLessonReader
        workspaceId="ws_1"
        topic={mockTopic}
        lessonIndex={0}
        totalLessons={2}
        isFirst={true}
        isLast={false}
        isCompleted={false}
        onPrevLesson={onPrevLesson}
        onNextLesson={onNextLesson}
        onToggleComplete={onToggleComplete}
      />
    );

    // Prev disabled on first lesson
    expect(screen.getByRole("button", { name: /Previous lesson/ })).toBeDisabled();

    // Toggle complete
    fireEvent.click(screen.getByRole("button", { name: "Mark as complete" }));
    expect(onToggleComplete).toHaveBeenCalledOnce();

    // Continue to next lesson
    fireEvent.click(screen.getByRole("button", { name: /Continue to next lesson/ }));
    expect(onNextLesson).toHaveBeenCalledOnce();

    // On last lesson
    rerender(
      <StudioLessonReader
        workspaceId="ws_1"
        topic={mockTopic}
        lessonIndex={1}
        totalLessons={2}
        isFirst={false}
        isLast={true}
        isCompleted={true}
        onPrevLesson={onPrevLesson}
        onNextLesson={onNextLesson}
        onToggleComplete={onToggleComplete}
      />
    );

    expect(screen.getByRole("button", { name: /Previous lesson/ })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /Finish roadmap/ })).toBeInTheDocument();
  });

  it("persists and restores reading position from localStorage", () => {
    saveReadingPosition("ws_1", "topic_1", { scrollRatio: 0.5, scrollY: 200 });

    render(
      <StudioLessonReader
        workspaceId="ws_1"
        topic={mockTopic}
      />
    );

    expect(window.localStorage.getItem(getReadingPositionKey("ws_1", "topic_1"))).toBeTruthy();
  });
});
