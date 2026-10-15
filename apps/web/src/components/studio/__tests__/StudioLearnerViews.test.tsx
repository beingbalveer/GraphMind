import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StudioHomeView } from "../StudioHomeView";
import { StudioMyLearningView } from "../StudioMyLearningView";
import { WorkspaceItem } from "@/lib/workspaceApi";

const mockRoadmapWorkspaces: WorkspaceItem[] = [
  {
    id: "ws_copy_1",
    name: "Beginner Drawing - Copy 1",
    description: "Personal copy of Beginner Drawing",
    viewportX: 0,
    viewportY: 0,
    zoom: 1,
    nodeCount: 5,
    createdAt: "2026-10-10T10:00:00Z",
    updatedAt: "2026-10-14T12:00:00Z",
    curriculum: {
      roadmapId: "rm_1",
      revisionId: "rev_1",
      title: "Beginner Drawing Course",
      status: "active",
      totalTopics: 10,
      completedTopics: 4,
      progressPercent: 40.0,
      sourceSnapshotRef: "beginner-drawing",
      originJobId: null,
      updatedAt: "2026-10-14T12:00:00Z",
    },
  },
  {
    id: "ws_copy_2",
    name: "Beginner Drawing - Copy 2",
    description: "Another copy with different progress",
    viewportX: 0,
    viewportY: 0,
    zoom: 1,
    nodeCount: 5,
    createdAt: "2026-10-11T10:00:00Z",
    updatedAt: "2026-10-15T08:00:00Z", // more recent
    curriculum: {
      roadmapId: "rm_2",
      revisionId: "rev_2",
      title: "Beginner Drawing Course (Second Run)",
      status: "active",
      totalTopics: 10,
      completedTopics: 0,
      progressPercent: 0.0,
      sourceSnapshotRef: "beginner-drawing",
      originJobId: null,
      updatedAt: "2026-10-15T08:00:00Z",
    },
  },
  {
    id: "ws_completed",
    name: "Python Mastery",
    description: "Mastered python backend roadmap",
    viewportX: 0,
    viewportY: 0,
    zoom: 1,
    nodeCount: 8,
    createdAt: "2026-09-01T10:00:00Z",
    updatedAt: "2026-10-01T10:00:00Z",
    curriculum: {
      roadmapId: "rm_py",
      revisionId: "rev_py",
      title: "Python Async Architecture",
      status: "active",
      totalTopics: 5,
      completedTopics: 5,
      progressPercent: 100.0,
      sourceSnapshotRef: null,
      originJobId: "job_py_123",
      updatedAt: "2026-10-01T10:00:00Z",
    },
  },
  {
    id: "ws_ordinary",
    name: "General Brainstorming Canvas",
    description: "Not a curriculum",
    viewportX: 0,
    viewportY: 0,
    zoom: 1,
    nodeCount: 3,
    createdAt: "2026-10-12T10:00:00Z",
    updatedAt: "2026-10-12T10:00:00Z",
    curriculum: null, // Ordinary workspace
  },
];

describe("StudioHomeView (LSI-006)", () => {
  it("renders loading skeleton when isLoading is true", () => {
    render(
      <StudioHomeView
        workspaces={[]}
        isLoading={true}
        onResume={vi.fn()}
        onBrowse={vi.fn()}
        onCreate={vi.fn()}
      />
    );
    expect(screen.getByTestId("studio-home-loading")).toBeInTheDocument();
  });

  it("renders error banner and triggers onRetry", () => {
    const handleRetry = vi.fn();
    render(
      <StudioHomeView
        workspaces={[]}
        error="Network error"
        onRetry={handleRetry}
        onResume={vi.fn()}
        onBrowse={vi.fn()}
        onCreate={vi.fn()}
      />
    );
    expect(screen.getByTestId("studio-home-error")).toBeInTheDocument();
    expect(screen.getByText("Network error")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it("renders empty state when no curriculum workspaces exist", () => {
    const handleBrowse = vi.fn();
    const handleCreate = vi.fn();
    render(
      <StudioHomeView
        workspaces={[mockRoadmapWorkspaces[3]]} // only ordinary workspace
        onResume={vi.fn()}
        onBrowse={handleBrowse}
        onCreate={handleCreate}
      />
    );
    expect(screen.getByText("Choose a roadmap for your next skill.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /browse sample roadmaps/i }));
    expect(handleBrowse).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /create roadmap/i }));
    expect(handleCreate).toHaveBeenCalledTimes(1);
  });

  it("picks the most recently updated learning roadmap and displays authoritative progress", () => {
    const handleResume = vi.fn();
    render(
      <StudioHomeView
        workspaces={mockRoadmapWorkspaces}
        onResume={handleResume}
        onBrowse={vi.fn()}
        onCreate={vi.fn()}
        displayName="Ada Lovelace"
      />
    );

    // Welcome back banner
    expect(screen.getByText("Welcome back, Ada Lovelace.")).toBeInTheDocument();

    // Most recent is ws_copy_2 (updated 2026-10-15)
    expect(screen.getByText("Beginner Drawing Course (Second Run)")).toBeInTheDocument();
    expect(screen.getByText("0/10 lessons")).toBeInTheDocument();
    expect(screen.getByText("IN PROGRESS")).toBeInTheDocument();

    // Click resume
    const resumeBtn = screen.getByRole("button", { name: /continue learning/i });
    fireEvent.click(resumeBtn);
    expect(handleResume).toHaveBeenCalledWith("ws_copy_2");
  });

  it("displays PATH COMPLETE and Review lessons when active roadmap is completed", () => {
    const completedOnly = [mockRoadmapWorkspaces[2]]; // ws_completed
    const handleResume = vi.fn();
    render(
      <StudioHomeView
        workspaces={completedOnly}
        onResume={handleResume}
        onBrowse={vi.fn()}
        onCreate={vi.fn()}
      />
    );

    expect(screen.getByText("PATH COMPLETE")).toBeInTheDocument();
    expect(screen.getByText("5/5 lessons")).toBeInTheDocument();
    const reviewBtn = screen.getByRole("button", { name: /review lessons/i });
    expect(reviewBtn).toBeInTheDocument();
    fireEvent.click(reviewBtn);
    expect(handleResume).toHaveBeenCalledWith("ws_completed");
  });
});

describe("StudioMyLearningView (LSI-006)", () => {
  it("renders distinct identities for separate copies of the same template", () => {
    const handleOpen = vi.fn();
    render(
      <StudioMyLearningView
        workspaces={mockRoadmapWorkspaces}
        onOpen={handleOpen}
        onBrowse={vi.fn()}
      />
    );

    // Both copies rendered with separate titles and authoritative counts
    expect(screen.getByTestId("workspace-curriculum-card-ws_copy_1")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-curriculum-card-ws_copy_2")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-curriculum-card-ws_completed")).toBeInTheDocument();

    // Ordinary workspace not rendered in curriculum list
    expect(screen.queryByTestId("workspace-curriculum-card-ws_ordinary")).not.toBeInTheDocument();

    // Authoritative topic counts
    expect(screen.getByText("4/10 complete")).toBeInTheDocument();
    expect(screen.getByText("0/10 complete")).toBeInTheDocument();
    expect(screen.getByText("5/5 complete")).toBeInTheDocument();

    // Click open on ws_copy_1
    const card1 = screen.getByTestId("workspace-curriculum-card-ws_copy_1");
    const openBtn = card1.querySelector("button")!;
    fireEvent.click(openBtn);
    expect(handleOpen).toHaveBeenCalledWith("ws_copy_1");
  });

  it("filters roadmaps by search query", () => {
    render(
      <StudioMyLearningView
        workspaces={mockRoadmapWorkspaces}
        onOpen={vi.fn()}
        onBrowse={vi.fn()}
      />
    );

    const searchInput = screen.getByLabelText("Search My learning");
    fireEvent.change(searchInput, { target: { value: "Async" } });

    // Only python course matches
    expect(screen.queryByTestId("workspace-curriculum-card-ws_copy_1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("workspace-curriculum-card-ws_copy_2")).not.toBeInTheDocument();
    expect(screen.getByTestId("workspace-curriculum-card-ws_completed")).toBeInTheDocument();
  });

  it("filters roadmaps by progress tab (not-started, in-progress, completed)", () => {
    render(
      <StudioMyLearningView
        workspaces={mockRoadmapWorkspaces}
        onOpen={vi.fn()}
        onBrowse={vi.fn()}
      />
    );

    // Tab 1: not-started (ws_copy_2: 0/10)
    fireEvent.click(screen.getByRole("tab", { name: "Not started" }));
    expect(screen.getByTestId("workspace-curriculum-card-ws_copy_2")).toBeInTheDocument();
    expect(screen.queryByTestId("workspace-curriculum-card-ws_copy_1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("workspace-curriculum-card-ws_completed")).not.toBeInTheDocument();

    // Tab 2: in-progress (ws_copy_1: 4/10)
    fireEvent.click(screen.getByRole("tab", { name: "In progress" }));
    expect(screen.getByTestId("workspace-curriculum-card-ws_copy_1")).toBeInTheDocument();
    expect(screen.queryByTestId("workspace-curriculum-card-ws_copy_2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("workspace-curriculum-card-ws_completed")).not.toBeInTheDocument();

    // Tab 3: completed (ws_completed: 5/5)
    fireEvent.click(screen.getByRole("tab", { name: "Completed" }));
    expect(screen.getByTestId("workspace-curriculum-card-ws_completed")).toBeInTheDocument();
    expect(screen.queryByTestId("workspace-curriculum-card-ws_copy_1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("workspace-curriculum-card-ws_copy_2")).not.toBeInTheDocument();
  });

  it("displays empty state with Clear search and filters button when filter produces no results", () => {
    render(
      <StudioMyLearningView
        workspaces={mockRoadmapWorkspaces}
        onOpen={vi.fn()}
        onBrowse={vi.fn()}
      />
    );

    const searchInput = screen.getByLabelText("Search My learning");
    fireEvent.change(searchInput, { target: { value: "Nonexistent topic xyz" } });

    expect(screen.getByText("No matching roadmaps")).toBeInTheDocument();
    const clearBtn = screen.getByRole("button", { name: /clear search and filters/i });
    fireEvent.click(clearBtn);

    // Cleared -> cards reappear
    expect(screen.getByTestId("workspace-curriculum-card-ws_copy_1")).toBeInTheDocument();
  });
});
