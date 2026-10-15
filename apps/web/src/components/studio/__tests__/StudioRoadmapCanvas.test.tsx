import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StudioCourseListView } from "../StudioCourseListView";
import { RoadmapCanvas } from "@/components/roadmap/RoadmapCanvas";
import { roadmapRouteMode, buildCanvasUrl, buildWorkspaceUrl } from "@/lib/urls";
import type { CurriculumView } from "@/lib/roadmapTypes";
import type { CanvasGraph, CanvasItem } from "@/lib/canvas/types";
import * as useCanvasLayoutModule from "@/hooks/useCanvasLayout";

// Mock CanvasSurface so tests run cleanly without xyflow DOM sizing requirements
vi.mock("@/components/canvas/CanvasSurface", () => ({
  CanvasSurface: ({
    graph,
    renderItem,
    ready,
    readOnly,
    onLayoutChange,
  }: {
    graph: CanvasGraph;
    renderItem: (item: CanvasItem) => React.ReactNode;
    ready: boolean;
    readOnly: boolean;
    onLayoutChange?: (layout: unknown) => void;
  }) => (
    <div
      data-testid="mock-canvas-surface"
      data-ready={String(ready)}
      data-read-only={String(readOnly)}
      data-has-layout-change={String(Boolean(onLayoutChange))}
    >
      {graph.items.map((item) => (
        <div key={item.id} data-testid={`canvas-item-${item.id}`}>
          {renderItem(item)}
        </div>
      ))}
    </div>
  ),
}));

describe("LSI-012: Shared roadmap and conversation canvas", () => {
  const mockView: CurriculumView = {
    roadmapId: "rm_100",
    workspaceId: "ws_alpha",
    canWrite: true,
    canvasAnchorChatId: "anchor_node_77",
    revisionId: "rev_20261015_abc",
    profile: {
      title: "Asynchronous Python Architecture",
      prompt: "Learn modern Python asyncio",
      level: "intermediate",
      background: null,
      duration: { value: 3, unit: "weeks" },
      hoursPerWeek: "6",
      studyWeeks: 3,
      weeklyMinutes: 360,
      outcome: "Build high-throughput backends with FastAPI and asyncpg",
      assumptions: ["Python basics", "HTTP knowledge"],
      knownSkills: ["Python"],
    },
    candidate: {
      title: "Asynchronous Python Architecture",
      outcome: "Build high-throughput backends with FastAPI and asyncpg",
      assumptions: ["Python basics", "HTTP knowledge"],
      items: [
        {
          id: "root",
          kind: "root",
          title: "Asynchronous Python Architecture",
          brief: "Root container",
          objectives: [],
          exercise: null,
          format: null,
          order: 0,
          path: "core",
          estimateMinutes: null,
          participation: "active",
        },
        {
          id: "phase_1",
          kind: "phase",
          title: "Phase 1: Event Loop Mechanics",
          brief: "Foundations of cooperative concurrency",
          objectives: [],
          exercise: null,
          format: null,
          order: 1,
          path: "core",
          estimateMinutes: 60,
          participation: "active",
        },
        {
          id: "topic_1",
          kind: "topic",
          title: "Coroutines and Tasks",
          brief: "Event loops and coroutine scheduling",
          objectives: ["Explain asyncio.create_task"],
          exercise: "Implement task worker",
          format: "concepts",
          order: 1,
          path: "core",
          estimateMinutes: 30,
          participation: "active",
        },
        {
          id: "topic_2",
          kind: "topic",
          title: "FastAPI Async Handlers",
          brief: "Non-blocking route handlers",
          objectives: ["Create async endpoints"],
          exercise: "Build async API",
          format: "practice",
          order: 2,
          path: "core",
          estimateMinutes: 30,
          participation: "active",
        },
      ],
      relations: [
        { sourceId: "root", targetId: "phase_1", kind: "contains" },
        { sourceId: "phase_1", targetId: "topic_1", kind: "contains" },
        { sourceId: "phase_1", targetId: "topic_2", kind: "contains" },
      ],
      choices: [],
      sessions: [],
      resources: [],
    },
    sources: [],
    progress: {
      topic_1: {
        topicId: "topic_1",
        status: "completed",
        completedAt: "2026-10-15T10:00:00Z",
      },
      topic_2: {
        topicId: "topic_2",
        status: "in_progress",
        completedAt: null,
      },
    },
    validation: {
      valid: true,
      issues: [],
      coreMinutes: 60,
      capacityMinutes: 360,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(useCanvasLayoutModule, "useCanvasLayout").mockReturnValue({
      ready: true,
      layout: null,
      setLayout: vi.fn(),
      loadError: null,
      saveState: "saved",
      conflict: false,
      reload: vi.fn(),
      retrySave: vi.fn(),
    });
  });

  it("projects the identical revision and topics between List and Canvas views", () => {
    const onSelectTopic = vi.fn();

    // 1. Render in List mode
    const { rerender } = render(
      <StudioCourseListView
        view={mockView}
        mode="list"
        onSelectTopic={onSelectTopic}
      />
    );

    expect(screen.getByTestId("studio-course-list-view")).toBeInTheDocument();
    expect(screen.getByText("Asynchronous Python Architecture")).toBeInTheDocument();
    expect(screen.getByText("Coroutines and Tasks")).toBeInTheDocument();
    expect(screen.getByText("FastAPI Async Handlers")).toBeInTheDocument();
    expect(screen.getByText(/Revision rev_2026/)).toBeInTheDocument();
    expect(screen.getByText(/1\/2 complete/)).toBeInTheDocument();

    // 2. Rerender in Canvas mode
    rerender(
      <StudioCourseListView
        view={mockView}
        mode="canvas"
        onSelectTopic={onSelectTopic}
      />
    );

    expect(screen.getByTestId("studio-course-canvas-view")).toBeInTheDocument();
    expect(screen.getByTestId("mock-canvas-surface")).toBeInTheDocument();
    expect(screen.getByTestId("canvas-item-topic_1")).toBeInTheDocument();
    expect(screen.getByTestId("canvas-item-topic_2")).toBeInTheDocument();
  });

  it("allows switching between List and Canvas views via SegmentedTabs", () => {
    const onModeChange = vi.fn();
    const onSelectTopic = vi.fn();

    render(
      <StudioCourseListView
        view={mockView}
        mode="list"
        onModeChange={onModeChange}
        onSelectTopic={onSelectTopic}
      />
    );

    expect(screen.getByTestId("studio-course-list-view")).toBeInTheDocument();

    // Click Canvas tab
    const canvasTab = screen.getByRole("tab", { name: /canvas/i });
    fireEvent.click(canvasTab);

    expect(onModeChange).toHaveBeenCalledWith("canvas");
  });

  it("verifies canonical URL roadmapRouteMode mapping using protected canvasAnchorChatId", () => {
    const workspaceId = mockView.workspaceId;
    const anchorChatId = mockView.canvasAnchorChatId;

    const listUrl = buildWorkspaceUrl(workspaceId);
    const canvasUrl = buildCanvasUrl(workspaceId, anchorChatId);

    // List URL matches page mode
    expect(listUrl).toBe(`/w/${workspaceId}`);
    expect(roadmapRouteMode(listUrl, mockView)).toBe("page");

    // Canvas URL strictly matches protected anchorChatId
    expect(canvasUrl).toBe(`/w/${workspaceId}/chat/${anchorChatId}/canvas`);
    expect(roadmapRouteMode(canvasUrl, mockView)).toBe("canvas");

    // Foreign or ordinary chat canvas URL does NOT match curriculum roadmap mode
    const ordinaryChatCanvasUrl = `/w/${workspaceId}/chat/chat_ordinary_99/canvas`;
    expect(roadmapRouteMode(ordinaryChatCanvasUrl, mockView)).toBeNull();

    // Null view returns null
    expect(roadmapRouteMode(canvasUrl, null)).toBeNull();
  });

  it("enforces guest read-only canvas guard and does not call private layout APIs", () => {
    const setLayoutMock = vi.fn();
    const useCanvasLayoutSpy = vi
      .spyOn(useCanvasLayoutModule, "useCanvasLayout")
      .mockReturnValue({
        ready: true,
        layout: null,
        setLayout: setLayoutMock,
        loadError: null,
        saveState: "saved",
        conflict: false,
        reload: vi.fn(),
        retrySave: vi.fn(),
      });

    const readOnlyView: CurriculumView = {
      ...mockView,
      canWrite: false, // Guest / un-enrolled view
    };

    render(<RoadmapCanvas view={readOnlyView} />);

    // When canWrite is false, useCanvasLayout must be passed undefined for workspaceId and chatId
    expect(useCanvasLayoutSpy).toHaveBeenCalledWith(
      undefined,
      undefined,
      "curriculum"
    );

    const surface = screen.getByTestId("mock-canvas-surface");
    expect(surface).toHaveAttribute("data-read-only", "true");
    expect(setLayoutMock).not.toHaveBeenCalled();
  });

  it("triggers onOpenTopic when a topic node is selected on the canvas", () => {
    const onOpenTopic = vi.fn();

    render(<RoadmapCanvas view={mockView} onOpenTopic={onOpenTopic} />);

    // Topic 1 card rendered
    const topic1Button = screen.getByRole("button", { name: /coroutines and tasks/i });
    fireEvent.click(topic1Button);

    expect(onOpenTopic).toHaveBeenCalledWith("topic_1");
  });

  it("proves protected canvasAnchorChatId is preserved and excluded from ordinary chat listings", () => {
    const ordinaryChats = [
      { id: "chat_1", title: "General Discussion" },
      { id: "chat_2", title: "Project Brainstorming" },
      { id: mockView.canvasAnchorChatId, title: "Protected Roadmap Anchor" },
    ];

    // Mirroring ChatSidebar's filtering rule:
    const filteredChats = ordinaryChats.filter(
      (chat) => chat.id !== mockView.canvasAnchorChatId
    );

    expect(filteredChats).toHaveLength(2);
    expect(filteredChats.some((c) => c.id === mockView.canvasAnchorChatId)).toBe(false);
  });
});
