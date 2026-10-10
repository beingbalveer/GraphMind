import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { QuizCard } from "../QuizCard";
import { ThreadGraphNode, ThreadNodeData } from "../../canvas/ThreadGraphNode";
import * as workspaceApi from "@/lib/workspaceApi";
import { Node, ReactFlowProvider } from "@xyflow/react";

vi.mock("@/lib/workspaceApi", () => ({
  createWorkspaceConcept: vi.fn(),
  updateWorkspaceConcept: vi.fn(),
}));

describe("Cross-Surface Learning Consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
