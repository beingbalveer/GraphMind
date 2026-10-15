import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StudioCourseOutline } from "../StudioCourseOutline";
import { StudioCourseListView } from "../StudioCourseListView";
import { CurriculumView } from "@/lib/roadmapTypes";

const mockCurriculumView: CurriculumView = {
  roadmapId: "roadmap_test_1",
  workspaceId: "ws_test_1",
  canWrite: true,
  canvasAnchorChatId: "node_anchor_1",
  revisionId: "rev_8f23abc123456789",
  profile: {
    title: "Python Async Architecture",
    prompt: "Learn Python async architecture and FastAPI",
    level: "intermediate",
    background: "Some Python basics",
    duration: { value: 3, unit: "weeks" },
    hoursPerWeek: "6",
    studyWeeks: 3,
    weeklyMinutes: 360,
    outcome: "Build production-ready asynchronous backends with FastAPI and PostgreSQL",
    assumptions: [
      "Understand event loops and async/await syntax",
      "Deploy async database connection pooling",
    ],
    knownSkills: ["Python OOP", "Basic SQL"],
  },
  candidate: {
    title: "Python Async Architecture",
    outcome: "Build production-ready asynchronous backends with FastAPI and PostgreSQL",
    assumptions: [
      "Understand event loops and async/await syntax",
      "Deploy async database connection pooling",
    ],
    items: [
      {
        id: "phase_1",
        kind: "phase",
        title: "Phase 1: Event Loops & Concurrency",
        brief: "Foundations of asynchronous execution in Python",
        objectives: ["Master async/await syntax"],
        exercise: null,
        format: null,
        order: 1,
        path: "core",
        estimateMinutes: 70,
        participation: "active",
      },
      {
        id: "topic_1",
        kind: "topic",
        title: "Event Loops & asyncio Coroutines",
        brief: "Deep dive into the asyncio loop and cooperative multitasking",
        objectives: ["Explain task scheduling in the asyncio event loop"],
        exercise: "Run concurrent HTTP tasks",
        format: "concepts",
        order: 1,
        path: "core",
        estimateMinutes: 30,
        participation: "active",
      },
      {
        id: "topic_2",
        kind: "topic",
        title: "FastAPI Async Routing",
        brief: "Build non-blocking API route handlers",
        objectives: ["Differentiate def vs async def endpoints"],
        exercise: "Create async CRUD routes",
        format: "practice",
        order: 2,
        path: "core",
        estimateMinutes: 40,
        participation: "active",
      },
      {
        id: "phase_2",
        kind: "phase",
        title: "Phase 2: Database Concurrency",
        brief: "Integrating async database drivers and ORM",
        objectives: ["Configure asyncpg connection pool"],
        exercise: null,
        format: null,
        order: 2,
        path: "core",
        estimateMinutes: 45,
        participation: "active",
      },
      {
        id: "topic_3",
        kind: "topic",
        title: "SQLAlchemy 2.0 AsyncSessions",
        brief: "Non-blocking database operations with asyncpg",
        objectives: ["Safely manage async sessions in request dependencies"],
        exercise: "Query PostgreSQL with AsyncSession",
        format: "practice",
        order: 1,
        path: "core",
        estimateMinutes: 45,
        participation: "active",
      },
    ],
    relations: [
      { sourceId: "phase_1", targetId: "topic_1", kind: "contains" },
      { sourceId: "phase_1", targetId: "topic_2", kind: "contains" },
      { sourceId: "phase_2", targetId: "topic_3", kind: "contains" },
    ],
    choices: [],
    sessions: [],
    resources: [],
  },
  sources: [
    {
      id: "src_1",
      title: "FastAPI Concurrency and async/await",
      url: "https://fastapi.tiangolo.com/async/",
      referenceId: null,
      locator: "docs/async",
      verifiedAt: "2026-10-10T12:00:00Z",
      status: "inspected",
      access: "free",
      kind: "article",
      evidence: "FastAPI supports asynchronous path operation functions natively.",
      provenance: {},
    },
  ],
  progress: {
    topic_1: {
      topicId: "topic_1",
      status: "completed",
      completedAt: "2026-10-12T14:00:00Z",
    },
    topic_2: {
      topicId: "topic_2",
      status: "in_progress",
      completedAt: null,
    },
    topic_3: {
      topicId: "topic_3",
      status: "not_started",
      completedAt: null,
    },
  },
  validation: {
    valid: true,
    issues: [],
    coreMinutes: 115,
    capacityMinutes: 360,
  },
  origins: [],
};

describe("StudioCourseOutline (LSI-007)", () => {
  it("renders phases and topics from real CurriculumView", () => {
    const handleSelect = vi.fn();
    render(
      <StudioCourseOutline
        view={mockCurriculumView}
        activeTopicId="topic_2"
        onSelectTopic={handleSelect}
      />
    );

    // Phases
    expect(screen.getByText("Phase 1: Event Loops & Concurrency")).toBeInTheDocument();
    expect(screen.getByText("Phase 2: Database Concurrency")).toBeInTheDocument();

    // Topics
    expect(screen.getByText("Event Loops & asyncio Coroutines")).toBeInTheDocument();
    expect(screen.getByText("FastAPI Async Routing")).toBeInTheDocument();
    expect(screen.getByText("SQLAlchemy 2.0 AsyncSessions")).toBeInTheDocument();

    // Completed topic has checkmark
    expect(screen.getByTestId("topic-done-topic_1")).toBeInTheDocument();
    expect(screen.getByTestId("topic-todo-topic_2")).toBeInTheDocument();
    expect(screen.getByTestId("topic-todo-topic_3")).toBeInTheDocument();

    // Active topic highlighted
    const activeBtn = screen.getByTestId("outline-topic-topic_2");
    expect(activeBtn).toHaveAttribute("aria-current", "true");

    // Click topic
    fireEvent.click(screen.getByTestId("outline-topic-topic_3"));
    expect(handleSelect).toHaveBeenCalledWith("topic_3");
  });

  it("handles empty items gracefully", () => {
    const emptyView: CurriculumView = {
      ...mockCurriculumView,
      candidate: {
        ...mockCurriculumView.candidate,
        items: [],
      },
    };
    render(
      <StudioCourseOutline
        view={emptyView}
        onSelectTopic={vi.fn()}
      />
    );
    expect(screen.getByTestId("studio-outline-empty")).toBeInTheDocument();
  });
});

describe("StudioCourseListView (LSI-007)", () => {
  it("renders structured course overview, phased lessons, outcomes, and sources", () => {
    const handleSelect = vi.fn();
    render(
      <StudioCourseListView
        view={mockCurriculumView}
        onSelectTopic={handleSelect}
      />
    );

    // Header metadata
    expect(screen.getByText("Python Async Architecture")).toBeInTheDocument();
    expect(screen.getByText("3 weeks")).toBeInTheDocument();
    expect(screen.getByText("1/3 complete (33%)")).toBeInTheDocument();

    // Phased lessons
    expect(screen.getByText("Phase 1: Event Loops & Concurrency")).toBeInTheDocument();
    expect(screen.getByText("Phase 2: Database Concurrency")).toBeInTheDocument();

    // Completed topic shows check icon
    expect(screen.getByTestId("list-topic-check-topic_1")).toBeInTheDocument();

    // Non-completed topics show two-digit index (e.g. 02, 03)
    expect(screen.getByText("02")).toBeInTheDocument();
    expect(screen.getByText("03")).toBeInTheDocument();

    // Click lesson button
    const topic2Btn = screen.getByTestId("list-topic-button-topic_2");
    fireEvent.click(topic2Btn);
    expect(handleSelect).toHaveBeenCalledWith("topic_2");

    // Right sidebar sections
    expect(screen.getByText("You will practice")).toBeInTheDocument();
    expect(screen.getByText("Understand event loops and async/await syntax")).toBeInTheDocument();
    expect(screen.getByText("Before you begin")).toBeInTheDocument();
    expect(screen.getByText("Python OOP")).toBeInTheDocument();
    expect(screen.getByText("References")).toBeInTheDocument();
    expect(screen.getByText("FastAPI Concurrency and async/await")).toBeInTheDocument();
  });

  it("renders loading skeleton when isLoading is true", () => {
    render(
      <StudioCourseListView
        isLoading={true}
        onSelectTopic={vi.fn()}
      />
    );
    expect(screen.getByTestId("studio-list-view-loading")).toBeInTheDocument();
  });

  it("renders error state and invokes onRetry", () => {
    const handleRetry = vi.fn();
    render(
      <StudioCourseListView
        error="Access forbidden: Workspace member required"
        onRetry={handleRetry}
        onSelectTopic={vi.fn()}
      />
    );
    expect(screen.getByTestId("studio-list-view-error")).toBeInTheDocument();
    expect(screen.getByText("Access forbidden: Workspace member required")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it("renders ordinary workspace degradation without crashing when view is null", () => {
    render(
      <StudioCourseListView
        view={null}
        onSelectTopic={vi.fn()}
      />
    );
    expect(screen.getByTestId("studio-list-view-not-found")).toBeInTheDocument();
    expect(screen.getByText("No curriculum roadmap attached")).toBeInTheDocument();
  });
});
