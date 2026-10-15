import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  GapAnalysisResponse,
  NextTopicsResponse,
  WorkspaceMasterySummary,
} from "@graphmind/shared";

import { KnowledgeSignalsPanel } from "../KnowledgeSignalsPanel";
import { GraphCanvas } from "../GraphCanvas";
import * as workspaceApi from "@/lib/workspaceApi";

vi.mock("@/lib/workspaceApi", () => ({
  getWorkspaceMastery: vi.fn(),
  getWorkspaceKnowledgeGaps: vi.fn(),
  getNextTopicRecommendations: vi.fn(),
  adoptKnowledgeGap: vi.fn(),
}));

vi.mock("@/lib/canvasApi", () => ({
  readCanvasLayout: vi.fn(async () => ({ layout: null, revision: 0 })),
  writeCanvasLayout: vi.fn(async (_w, _c, _k, revision, layout) => ({
    layout,
    revision: revision + 1,
  })),
}));

vi.mock("@xyflow/react", async () => {
  const real = await vi.importActual<typeof import("@xyflow/react")>("@xyflow/react");
  return {
    ...real,
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => children,
    useViewport: () => ({ x: 0, y: 0, zoom: 0.9 }),
    useNodesInitialized: () => true,
    useReactFlow: () => ({
      fitView: vi.fn(),
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      zoomTo: vi.fn(),
      setCenter: vi.fn(),
      setViewport: vi.fn(),
      getZoom: () => 0.9,
      getNodes: () => [],
    }),
    Handle: () => null,
    Background: () => null,
    Controls: () => null,
    MiniMap: () => <div data-testid="minimap" />,
    ReactFlow: ({
      nodes,
      nodeTypes,
      children,
    }: {
      nodes: Array<{ id: string; type: string; data: unknown }>;
      nodeTypes: Record<string, React.ComponentType<{ data: unknown }>>;
      children: React.ReactNode;
    }) => (
      <div data-testid="react-flow">
        {nodes.map((node) => {
          const Component = nodeTypes[node.type];
          return <Component key={node.id} data={node.data} />;
        })}
        {children}
      </div>
    ),
  };
});

function masteryFixture(): WorkspaceMasterySummary {
  return {
    workspaceId: "ws-1",
    totalConcepts: 1,
    overallScore: 0.92,
    distribution: { unexplored: 0, explored: 0, quizzed: 0, mastered: 1, stale: 0 },
    topMastered: [],
    needingReview: [],
    concepts: [
      {
        id: "c1",
        workspaceId: "ws-1",
        name: "Vector Embeddings",
        masteryLevel: "mastered",
        confidenceScore: 0.92,
        timesQuizzed: 2,
        timesCorrect: 2,
        createdAt: "2026-10-01T00:00:00Z",
        updatedAt: "2026-10-01T00:00:00Z",
      },
    ],
  };
}

function gapsFixture(): GapAnalysisResponse {
  return {
    workspaceId: "ws-1",
    analyzedAt: "2026-10-01T00:00:00Z",
    totalGaps: 1,
    highSeverityCount: 1,
    mediumSeverityCount: 0,
    exploredDomains: ["Python Concurrency"],
    gaps: [
      {
        id: "python:event_loop",
        conceptName: "Event Loops & Task Schedulers",
        domain: "Python Concurrency",
        severity: "high",
        status: "missing",
        dependentConcepts: ["Asyncio High-Level APIs"],
        rationale: "You explored Asyncio but have not mastered the prerequisite.",
        suggestedAction: "Explore fundamentals of Event Loops & Task Schedulers.",
        foundationalImportance: "foundational",
      },
    ],
  };
}

function topicsFixture(): NextTopicsResponse {
  return {
    workspaceId: "ws-1",
    activeFrontierDomains: ["Python Concurrency"],
    generatedAt: "2026-10-01T00:00:00Z",
    recommendations: [
      {
        id: "python:asyncio",
        topicName: "Asyncio High-Level APIs",
        domain: "Python Concurrency",
        readiness: "ready_to_unlock",
        readinessScore: 0.9,
        rationale: "Natural progression from Event Loops.",
        unlockedBy: ["Event Loops & Task Schedulers"],
        futureUnlocks: ["RAG Architecture"],
        suggestedPrompt: "Teach me about Asyncio High-Level APIs.",
        importance: "core",
      },
    ],
  };
}

function mockLoaded() {
  vi.mocked(workspaceApi.getWorkspaceMastery).mockResolvedValue(masteryFixture());
  vi.mocked(workspaceApi.getWorkspaceKnowledgeGaps).mockResolvedValue(gapsFixture());
  vi.mocked(workspaceApi.getNextTopicRecommendations).mockResolvedValue(topicsFixture());
  vi.mocked(workspaceApi.adoptKnowledgeGap).mockResolvedValue(
    masteryFixture().concepts[0]
  );
}

describe("LSI-042 knowledge signals panel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoaded();
  });

  it("surfaces explicit mastery signals distinctly from completion", async () => {
    render(<KnowledgeSignalsPanel workspaceId="ws-1" />);

    expect(await screen.findByText("Mastery profile")).toBeVisible();
    expect(screen.getByText("Vector Embeddings")).toBeVisible();
    expect(screen.getByText("mastered")).toBeVisible();
    expect(screen.getAllByText("92%").length).toBeGreaterThan(0);

    // The panel states the invariant explicitly and never claims completion.
    expect(
      screen.getByText(/stays separate from lesson completion/i)
    ).toBeVisible();
    expect(screen.queryByText(/mark completed/i)).not.toBeInTheDocument();

    // Curator signals are visible too.
    expect(screen.getByText("Knowledge gaps")).toBeVisible();
    expect(screen.getByText("Event Loops & Task Schedulers")).toBeVisible();
    expect(screen.getByText("Recommended next topics")).toBeVisible();
    expect(screen.getByText("Asyncio High-Level APIs")).toBeVisible();
  });

  it("adopts a gap through the exposed service and refreshes persisted state", async () => {
    render(<KnowledgeSignalsPanel workspaceId="ws-1" />);
    const adopt = await screen.findByRole("button", { name: "Adopt gap" });
    const callsBefore = vi.mocked(workspaceApi.getWorkspaceKnowledgeGaps).mock.calls.length;

    fireEvent.click(adopt);

    await waitFor(() =>
      expect(workspaceApi.adoptKnowledgeGap).toHaveBeenCalledWith(
        "ws-1",
        "python:event_loop"
      )
    );
    // Adoption dispatches the canonical refresh; state is reloaded, not faked.
    await waitFor(() =>
      expect(
        vi.mocked(workspaceApi.getWorkspaceKnowledgeGaps).mock.calls.length
      ).toBeGreaterThan(callsBefore)
    );
  });

  it("reports denied writes honestly instead of pretending success", async () => {
    vi.mocked(workspaceApi.adoptKnowledgeGap).mockResolvedValue(null);
    render(<KnowledgeSignalsPanel workspaceId="ws-1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Adopt gap" }));

    expect(
      await screen.findByText(/needs write access to this workspace/i)
    ).toBeVisible();
  });

  it("shows an honest unavailable state when services cannot be reached", async () => {
    vi.mocked(workspaceApi.getWorkspaceMastery).mockResolvedValue(null);
    vi.mocked(workspaceApi.getWorkspaceKnowledgeGaps).mockResolvedValue(null);
    vi.mocked(workspaceApi.getNextTopicRecommendations).mockResolvedValue(null);

    render(<KnowledgeSignalsPanel workspaceId="ws-1" />);

    expect(
      await screen.findByText("Knowledge signals unavailable")
    ).toBeVisible();
    expect(screen.queryByTestId("knowledge-signals-panel")).not.toBeInTheDocument();
  });

  it("is reachable from the canvas actions menu", async () => {
    const tree = {
      id: "w",
      rootNodeId: "r",
      activeNodeId: "r",
      createdAt: "",
      updatedAt: "",
      nodes: {
        r: { id: "r", parentId: null, childrenIds: [], role: "user" as const, content: "Start", createdAt: "" },
      },
    };
    render(<GraphCanvas tree={tree} workspaceId="ws-1" onSelectNode={vi.fn()} />);

    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Canvas options" }),
      { button: 0, ctrlKey: false, pointerType: "mouse" }
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Knowledge signals" }));

    expect(await screen.findByTestId("knowledge-signals-panel")).toBeVisible();
    expect(screen.getByText("Mastery profile")).toBeVisible();
  });

  it("uses shared primitives and semantic tokens (no raw buttons or zinc colors)", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/components/canvas/KnowledgeSignalsPanel.tsx"),
      "utf8"
    );
    expect(source).not.toMatch(/<button\b/);
    expect(source).not.toMatch(/\b(?:bg|text|border|ring)-zinc-\d+/);
    expect(source).toMatch(/bg-surface|text-foreground|border-border/);
  });
});
