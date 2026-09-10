import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { MasteryPanel } from "../MasteryPanel";
import { QuizCard } from "../QuizCard";
import { ThreadGraphNode, ThreadNodeData } from "../../canvas/ThreadGraphNode";
import * as workspaceApi from "@/lib/workspaceApi";
import { Node, ReactFlowProvider } from "@xyflow/react";

vi.mock("@/lib/workspaceApi", () => ({
  getWorkspaceMastery: vi.fn(),
  getWorkspaceKnowledgeGaps: vi.fn(),
  getNextTopicRecommendations: vi.fn(),
  adoptKnowledgeGap: vi.fn(),
  createWorkspaceConcept: vi.fn(),
  updateWorkspaceConcept: vi.fn(),
}));

describe("Cross-Surface Learning Consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders MasteryPanel with consistent mastery distribution and recommendations", async () => {
    vi.mocked(workspaceApi.getWorkspaceMastery).mockResolvedValue({
      workspaceId: "ws-1",
      totalConcepts: 1,
      overallScore: 0.75,
      topMastered: [],
      distribution: {
        mastered: 4,
        quizzed: 3,
        explored: 2,
        stale: 1,
        unexplored: 0,
      },
      concepts: [
        {
          id: "c-1",
          workspaceId: "ws-1",
          name: "Attention Mechanism",
          confidenceScore: 0.9,
          masteryLevel: "mastered",
          timesQuizzed: 5,
          timesCorrect: 5,
          lastReviewedAt: "2026-09-10T00:00:00.000Z",
          createdAt: "2026-09-10T00:00:00.000Z",
          updatedAt: "2026-09-10T00:00:00.000Z",
        },
      ],
      needingReview: [
        {
          id: "c-2",
          workspaceId: "ws-1",
          name: "Positional Encoding",
          confidenceScore: 0.4,
          masteryLevel: "stale",
          timesQuizzed: 2,
          timesCorrect: 1,
          lastReviewedAt: "2026-09-01T00:00:00.000Z",
          createdAt: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-09-01T00:00:00.000Z",
        },
      ],
    });

    vi.mocked(workspaceApi.getWorkspaceKnowledgeGaps).mockResolvedValue({
      workspaceId: "ws-1",
      analyzedAt: "2026-09-10T00:00:00.000Z",
      exploredDomains: ["Transformers"],
      totalGaps: 1,
      highSeverityCount: 0,
      mediumSeverityCount: 1,
      gaps: [
        {
          id: "gap-1",
          conceptName: "Linear Projections",
          domain: "Linear Algebra",
          status: "unexplored",
          severity: "medium",
          rationale: "Fundamental for computing QKV queries.",
          dependentConcepts: ["Self-Attention"],
          suggestedAction: "Explore linear projections",
          foundationalImportance: "High",
        },
      ],
    });

    vi.mocked(workspaceApi.getNextTopicRecommendations).mockResolvedValue({
      workspaceId: "ws-1",
      activeFrontierDomains: ["Deep Learning"],
      generatedAt: "2026-09-10T00:00:00.000Z",
      recommendations: [
        {
          id: "rec-1",
          topicName: "Multi-Head Attention",
          domain: "Deep Learning",
          readiness: "ready_to_unlock",
          readinessScore: 0.8,
          rationale: "Natural follow-up to self-attention.",
          unlockedBy: ["Attention Mechanism"],
          futureUnlocks: ["Transformer Encoder"],
          suggestedPrompt: "Explain Multi-Head Attention",
          importance: "high",
        },
      ],
    });

    const handleStartTopic = vi.fn();
    const handleExploreGap = vi.fn();

    render(
      <MasteryPanel
        workspaceId="ws-1"
        onStartTopic={handleStartTopic}
        onExploreGap={handleExploreGap}
      />
    );

    // Wait for data load
    await waitFor(() => {
      expect(screen.getByText("Mastery Score")).toBeInTheDocument();
    });

    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("Mastered")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Quizzed")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    // Next Best Topics
    expect(screen.getByText("Next Best Topics")).toBeInTheDocument();
    expect(screen.getByText("Multi-Head Attention")).toBeInTheDocument();
    expect(screen.getByText("ready to unlock")).toBeInTheDocument();

    // Knowledge Gaps
    expect(screen.getByText("Knowledge Gaps")).toBeInTheDocument();
    expect(screen.getByText("Linear Projections")).toBeInTheDocument();
  });

  it("renders consistent concept mastery levels in ThreadGraphNode across zoom modes", () => {
    const mockNode: Node<ThreadNodeData> = {
      id: "node-1",
      position: { x: 0, y: 0 },
      data: {
        thread: {
          id: "th-1",
          title: "Transformer Architecture",
          leafNodeId: "msg-1",
          isActive: false,
          messages: [
            {
              id: "msg-1",
              parentId: null,
              childrenIds: [],
              role: "user",
              content: "Explain Transformers",
              createdAt: "2026-09-10T00:00:00.000Z",
            },
          ],
        },
        zoomMode: "capsule",
        isHeatmapMode: true,
        masteryInfo: {
          level: "mastered",
          score: 0.95,
          primaryConcept: "Self-Attention",
          totalConcepts: 3,
        },
      },
    };

    const { rerender } = render(
      <ReactFlowProvider>
        <ThreadGraphNode
          id="node-1"
          data={mockNode.data}
          type="threadNode"
          selected={false}
          zIndex={1}
          isConnectable={true}
          positionAbsoluteX={0}
          positionAbsoluteY={0}
          dragging={false}
          draggable={false}
          selectable={true}
          deletable={true}
        />
      </ReactFlowProvider>
    );

    // Capsule view displays thread title and primary concept with mastery percentage
    expect(screen.getByText("Transformer Architecture")).toBeInTheDocument();
    expect(screen.getByText("Self-Attention")).toBeInTheDocument();
    expect(screen.getByText("95%")).toBeInTheDocument();

    // Rerender with orb mode
    rerender(
      <ReactFlowProvider>
        <ThreadGraphNode
          id="node-1"
          data={{ ...mockNode.data, zoomMode: "orb" }}
          type="threadNode"
          selected={false}
          zIndex={1}
          isConnectable={true}
          positionAbsoluteX={0}
          positionAbsoluteY={0}
          dragging={false}
          draggable={false}
          selectable={true}
          deletable={true}
        />
      </ReactFlowProvider>
    );

    // In orb mode, hovering displays the tooltip
    expect(screen.getAllByText("Transformer Architecture").length).toBeGreaterThan(0);
  });

  it("integrates quiz results into the mastery profile feedback loop", async () => {
    const user = userEvent.setup();
    vi.mocked(workspaceApi.createWorkspaceConcept).mockResolvedValue({
      id: "concept-record-1",
      workspaceId: "ws-1",
      name: "Vector Embeddings",
      masteryLevel: "explored",
      confidenceScore: 0.2,
      timesQuizzed: 1,
      timesCorrect: 0,
      lastReviewedAt: "2026-09-10T00:00:00.000Z",
      createdAt: "2026-09-10T00:00:00.000Z",
      updatedAt: "2026-09-10T00:00:00.000Z",
    });
    vi.mocked(workspaceApi.updateWorkspaceConcept).mockResolvedValue({
      id: "concept-record-1",
      workspaceId: "ws-1",
      name: "Vector Embeddings",
      masteryLevel: "quizzed",
      confidenceScore: 0.6,
      timesQuizzed: 2,
      timesCorrect: 1,
      lastReviewedAt: "2026-09-10T00:00:00.000Z",
      createdAt: "2026-09-10T00:00:00.000Z",
      updatedAt: "2026-09-10T00:00:00.000Z",
    });

    const quizJson = JSON.stringify({
      concept: "Vector Embeddings",
      question: "What is the primary function of an embedding model?",
      options: [
        { id: "A", text: "Map tokens into dense numerical vectors", isCorrect: true },
        { id: "B", text: "Generate synthetic training data", isCorrect: false },
      ],
      explanation: "Embeddings project text tokens into high-dimensional vector space.",
    });

    render(<QuizCard rawCode={quizJson} workspaceId="ws-1" />);

    expect(screen.getByText("Interactive Quiz")).toBeInTheDocument();
    expect(screen.getByText("Vector Embeddings")).toBeInTheDocument();

    const correctOption = screen.getByText("Map tokens into dense numerical vectors");
    await user.click(correctOption);

    await waitFor(() => {
      expect(workspaceApi.createWorkspaceConcept).toHaveBeenCalledWith("ws-1", {
        name: "Vector Embeddings",
        masteryLevel: "explored",
      });
      expect(workspaceApi.updateWorkspaceConcept).toHaveBeenCalledWith("ws-1", "concept-record-1", {
        quizResult: true,
      });
    });

    expect(screen.getByText("Correct! Great retention.")).toBeInTheDocument();
  });
});
