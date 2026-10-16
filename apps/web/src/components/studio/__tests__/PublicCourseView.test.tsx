import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { PublicCourseView } from "../PublicCourseView";
import type { PublicRoadmapDetail } from "@/lib/publicSnapshotApi";

vi.mock("@/components/roadmap/RoadmapCanvas", () => ({
  RoadmapCanvas: ({
    view,
    onOpenTopic,
    readOnly,
  }: {
    view: { canWrite: boolean };
    onOpenTopic?: (id: string) => void;
    readOnly?: boolean;
  }) => (
    <div
      data-testid="roadmap-canvas-mock"
      data-readonly={String(Boolean(readOnly))}
      data-can-write={String(view.canWrite)}
    >
      <button onClick={() => onOpenTopic?.("pub_topic_async")}>canvas topic</button>
    </div>
  ),
}));

const roadmap: PublicRoadmapDetail = {
  id: "tmpl-python",
  slug: "python-backend",
  title: "Python Backend Engineering",
  summary: "Asynchronous FastAPI services.",
  category: "backend",
  level: "intermediate",
  snapshotVersion: "2026-10-15.1",
  outcomes: ["Build async services"],
  prerequisites: ["Basic Python"],
  phases: [
    {
      id: "pub_phase_1",
      title: "Phase 1: Async",
      order: 1,
      topics: [
        {
          id: "pub_topic_async",
          slug: "async-basics",
          title: "Async basics",
          brief: "Event loops",
          order: 1,
          path: "core",
          estimateMinutes: 30,
          prerequisites: [],
        },
      ],
    },
  ],
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

function renderView(overrides: Partial<React.ComponentProps<typeof PublicCourseView>> = {}) {
  const props = {
    roadmap,
    onOpenTopic: vi.fn(),
    onRequireSignIn: vi.fn(),
    onRetry: vi.fn(),
    onModeChange: vi.fn(),
    ...overrides,
  };
  render(<PublicCourseView {...props} />);
  return props;
}

describe("PublicCourseView (LSI-030)", () => {
  it("renders a loading skeleton", () => {
    renderView({ roadmap: null, isLoading: true });
    expect(screen.getByTestId("public-course-loading")).toBeInTheDocument();
  });

  it("shows the neutral not-available state", () => {
    renderView({ roadmap: null, notFound: true });
    expect(screen.getByTestId("public-course-not-found")).toBeInTheDocument();
    expect(screen.getByText("This roadmap is not available")).toBeInTheDocument();
  });

  it("shows an error banner with retry", () => {
    const props = renderView({ roadmap: null, error: "Network error" });
    expect(screen.getByTestId("public-course-error")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders the ordered outline and opens a lesson by public slug", () => {
    const props = renderView();
    expect(screen.getByText("Python Backend Engineering")).toBeInTheDocument();
    expect(screen.getByText("Build async services")).toBeInTheDocument();
    expect(screen.getByTestId("public-phase-pub_phase_1")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("public-topic-async-basics"));
    expect(props.onOpenTopic).toHaveBeenCalledWith("async-basics");
  });

  it("switches to a read-only canvas that maps public topic ids back to slugs", () => {
    const props = renderView({ mode: "canvas" });
    const canvas = screen.getByTestId("roadmap-canvas-mock");
    expect(canvas).toHaveAttribute("data-readonly", "true");
    expect(canvas).toHaveAttribute("data-can-write", "false");

    fireEvent.click(within(canvas).getByRole("button", { name: "canvas topic" }));
    expect(props.onOpenTopic).toHaveBeenCalledWith("async-basics");
    expect(screen.queryByTestId("public-course-outline")).not.toBeInTheDocument();
  });

  it("gates the save action behind sign-in", () => {
    const props = renderView();
    fireEvent.click(screen.getByRole("button", { name: /sign in to save this roadmap/i }));
    expect(props.onRequireSignIn).toHaveBeenCalledTimes(1);
  });

  it("lists only safe verified source links", () => {
    renderView();
    const sources = screen.getByTestId("public-course-sources");
    const link = within(sources).getByRole("link", { name: /fastapi docs/i });
    expect(link).toHaveAttribute("href", "https://fastapi.tiangolo.com");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("offers a signed-in learner the save action instead of the gate", () => {
    const props = renderView({ isAuthenticated: true, onSave: vi.fn() });
    expect(
      screen.queryByRole("button", { name: /sign in to save/i }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /add to my learning/i }));
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });

  it("shows a pending save state", () => {
    renderView({ isAuthenticated: true, saveStatus: "pending" });
    const button = screen.getByRole("button", { name: /saving/i });
    expect(button).toBeDisabled();
  });

  it("confirms a created copy and opens it", () => {
    const props = renderView({
      isAuthenticated: true,
      saveStatus: "saved",
      savedCreated: true,
      onOpenSavedCopy: vi.fn(),
    });
    expect(screen.getByText("Saved to your learning")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /open my copy/i }));
    expect(props.onOpenSavedCopy).toHaveBeenCalledTimes(1);
  });

  it("reports a reused copy distinctly", () => {
    renderView({ isAuthenticated: true, saveStatus: "saved", savedCreated: false });
    expect(screen.getByText("Already in your learning")).toBeInTheDocument();
  });

  it("shows a retryable save error", () => {
    const props = renderView({
      isAuthenticated: true,
      saveStatus: "error",
      saveError: "Save failed",
      onRetrySave: vi.fn(),
    });
    expect(screen.getByTestId("public-course-save-error")).toHaveTextContent(
      "Save failed",
    );
    fireEvent.click(screen.getByRole("button", { name: /retry save/i }));
    expect(props.onRetrySave).toHaveBeenCalledTimes(1);
  });
});
