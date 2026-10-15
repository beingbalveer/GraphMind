import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { LearningStudioShell } from "../LearningStudioShell";
import { StudioHeader } from "../StudioHeader";
import { StudioCourseRail } from "../StudioCourseRail";
import { StudioTutorRail } from "../StudioTutorRail";

describe("LearningStudioShell (LSI-003)", () => {
  beforeEach(() => {
    // Default mock for desktop viewport (>= 1024px)
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes("1024px") ? true : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  it("renders header and main stage correctly", () => {
    render(
      <LearningStudioShell
        header={<div data-testid="test-header">Header Content</div>}
      >
        <div data-testid="test-stage">Stage Content</div>
      </LearningStudioShell>
    );

    expect(screen.getByTestId("learning-studio-shell")).toBeVisible();
    expect(screen.getByTestId("test-header")).toHaveTextContent("Header Content");
    expect(screen.getByTestId("studio-main-stage")).toHaveTextContent("Stage Content");
  });

  it("renders desktop course rail and tutor rail when showRails is true", () => {
    render(
      <LearningStudioShell
        header={<div>Header</div>}
        showRails={true}
        isLeftRailOpen={true}
        isRightRailOpen={true}
        courseRail={<div data-testid="test-course-rail">Course Rail</div>}
        tutorRail={<div data-testid="test-tutor-rail">Tutor Rail</div>}
      >
        <div>Stage</div>
      </LearningStudioShell>
    );

    expect(screen.getByTestId("studio-desktop-left-rail")).toBeVisible();
    expect(screen.getByTestId("test-course-rail")).toHaveTextContent("Course Rail");
    expect(screen.getByTestId("studio-desktop-right-rail")).toBeVisible();
    expect(screen.getByTestId("test-tutor-rail")).toHaveTextContent("Tutor Rail");
  });

  it("does not render rails when showRails is false", () => {
    render(
      <LearningStudioShell
        header={<div>Header</div>}
        showRails={false}
        isLeftRailOpen={true}
        isRightRailOpen={true}
        courseRail={<div>Course Rail</div>}
        tutorRail={<div>Tutor Rail</div>}
      >
        <div>Stage</div>
      </LearningStudioShell>
    );

    expect(screen.queryByTestId("studio-desktop-left-rail")).toBeNull();
    expect(screen.queryByTestId("studio-desktop-right-rail")).toBeNull();
  });

  it("renders StudioHeader and StudioCourseRail subcomponents with expected tokens and controls", () => {
    const onToggleLeft = vi.fn();
    const onToggleRight = vi.fn();
    const onNav = vi.fn();

    render(
      <StudioHeader
        activeNav="learning"
        onNavigate={onNav}
        courseTitle="Advanced Machine Learning"
        showRails={true}
        isLeftRailOpen={true}
        onToggleLeftRail={onToggleLeft}
        isRightRailOpen={false}
        onToggleRightRail={onToggleRight}
      />
    );

    expect(screen.getByTestId("studio-header")).toHaveClass("h-13", "bg-background", "border-b");
    expect(screen.getByText("Advanced Machine Learning")).toBeVisible();

    const leftToggle = screen.getByLabelText("Close course rail");
    fireEvent.click(leftToggle);
    expect(onToggleLeft).toHaveBeenCalledTimes(1);

    const rightToggle = screen.getByLabelText("Open Tutor");
    fireEvent.click(rightToggle);
    expect(onToggleRight).toHaveBeenCalledTimes(1);
  });

  it("renders StudioCourseRail with progress and tab navigation", () => {
    render(
      <StudioCourseRail
        courseTitle="Test Course"
        progressPercent={45}
        outlineContent={<div>Topic 1</div>}
        chatsContent={<div>Chat 1</div>}
      />
    );

    expect(screen.getByTestId("studio-course-rail")).toBeVisible();
    expect(screen.getByText("45%")).toBeVisible();
    expect(screen.getByText("Topic 1")).toBeVisible();

    // Click Chats tab
    const chatsTab = screen.getByRole("tab", { name: "Chats" });
    fireEvent.click(chatsTab);
    expect(screen.getByText("Chat 1")).toBeVisible();
  });

  it("renders StudioTutorRail with expand toggle and tab navigation", () => {
    const onExpand = vi.fn();
    const onClose = vi.fn();

    render(
      <StudioTutorRail
        topicTitle="Introduction to Python"
        onToggleExpand={onExpand}
        onClose={onClose}
        tutorContent={<div>Tutor chat stream</div>}
        resourcesContent={<div>External references</div>}
      />
    );

    expect(screen.getByTestId("studio-tutor-rail")).toBeVisible();
    expect(screen.getByText("Introduction to Python")).toBeVisible();
    expect(screen.getByText("Tutor chat stream")).toBeVisible();

    // Toggle expand
    const expandBtn = screen.getByLabelText("Expand tutor panel width");
    fireEvent.click(expandBtn);
    expect(onExpand).toHaveBeenCalledTimes(1);

    // Switch to sources tab
    const sourcesTab = screen.getByRole("tab", { name: "Sources & Notes" });
    fireEvent.click(sourcesTab);
    expect(screen.getByText("External references")).toBeVisible();
  });
});
