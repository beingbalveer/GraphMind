import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BranchChatPane } from "../BranchChatPane";
import { QuizCard } from "../QuizCard";
import { TreeSidebar } from "../../tree/TreeSidebar";
import { SidePeekBranchSheet } from "../SidePeekBranchSheet";
import { ConversationTree } from "@graphmind/shared";

describe("Auxiliary Panels & Repeated Patterns", () => {
  const mockTree: ConversationTree = {
    id: "tree-1",
    createdAt: "2026-09-10T00:00:00.000Z",
    updatedAt: "2026-09-10T00:00:00.000Z",
    rootNodeId: "root-1",
    activeNodeId: "node-2",
    nodes: {
      "root-1": {
        id: "root-1",
        parentId: null,
        childrenIds: ["node-1"],
        role: "user",
        content: "What is attention mechanism?",
        createdAt: "2026-09-10T00:00:00.000Z",
      },
      "node-1": {
        id: "node-1",
        parentId: "root-1",
        childrenIds: ["node-2"],
        role: "assistant",
        content: "Attention allows models to focus on relevant tokens.",
        createdAt: "2026-09-10T00:01:00.000Z",
      },
      "node-2": {
        id: "node-2",
        parentId: "node-1",
        childrenIds: [],
        role: "user",
        content: "Explain self-attention.",
        highlightedContext: "Attention mechanism",
        createdAt: "2026-09-10T00:02:00.000Z",
      },
    },
  };

  it("renders BranchChatPane with semantic tokens and handles tab interactions", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    const handleSelectBranchLeaf = vi.fn();
    const handleSendBranchMessage = vi.fn();
    const handleSendNewSiblingBranch = vi.fn();

    render(
      <BranchChatPane
        tree={mockTree}
        branchLeafNodeId="node-2"
        highlightedContext="Attention mechanism"
        onClose={handleClose}
        onSelectBranchLeaf={handleSelectBranchLeaf}
        onSendBranchMessage={handleSendBranchMessage}
        onSendNewSiblingBranch={handleSendNewSiblingBranch}
      />
    );

    // Context identifier badge is rendered
    expect(screen.getByText("Attention mechanism")).toBeInTheDocument();

    // Close button triggers onClose
    const closeBtn = screen.getByRole("button", { name: "Close branch view" });
    await user.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    // New sibling branch trigger opens starter templates
    const newTabBtn = screen.getByRole("button", { name: "Create new sub-branch query on this topic" });
    await user.click(newTabBtn);
    expect(screen.getByText(/Explorations for/i)).toBeInTheDocument();
    expect(screen.getByText("Deep Dive")).toBeInTheDocument();
  });

  it("renders QuizCard with interactive options and semantic badges", async () => {
    const user = userEvent.setup();
    const quizJson = JSON.stringify({
      concept: "Attention",
      question: "Which component computes similarity in self-attention?",
      options: [
        { id: "A", text: "Dot product of Query and Key", isCorrect: true },
        { id: "B", text: "Linear feed-forward layer", isCorrect: false },
      ],
      explanation: "Self-attention computes dot products between queries and keys.",
    });

    render(<QuizCard rawCode={quizJson} />);

    // Renders interactive quiz header and question
    expect(screen.getByText("Interactive Quiz")).toBeInTheDocument();
    expect(screen.getByText("Attention")).toBeInTheDocument();
    expect(screen.getByText("Which component computes similarity in self-attention?")).toBeInTheDocument();

    // Option selection
    const optionA = screen.getByText("Dot product of Query and Key");
    await user.click(optionA);

    // Displays success explanation
    expect(screen.getByText("Correct! Great retention.")).toBeInTheDocument();
    expect(screen.getByText("Self-attention computes dot products between queries and keys.")).toBeInTheDocument();
  });

  it("renders TreeSidebar and handles node navigation with shared Button primitive", async () => {
    const user = userEvent.setup();
    const handleSelectNode = vi.fn();
    const handleClose = vi.fn();

    render(
      <TreeSidebar
        tree={mockTree}
        isOpen={true}
        onClose={handleClose}
        onSelectNode={handleSelectNode}
      />
    );

    expect(screen.getByText("Conversation Tree")).toBeInTheDocument();
    expect(screen.getByText("3 nodes")).toBeInTheDocument();

    // Select a node
    const nodeButton = screen.getByText("What is attention mechanism?");
    await user.click(nodeButton);
    expect(handleSelectNode).toHaveBeenCalledWith("root-1");

    // Close button
    const closeBtn = screen.getByRole("button", { name: "Close Tree Sidebar" });
    await user.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("renders SidePeekBranchSheet using Drawer primitive and semantic tokens", () => {
    const historyStack = [
      {
        nodeId: "node-2",
        excerpt: "Attention allows models to focus",
      },
    ];

    render(
      <SidePeekBranchSheet
        isOpen={true}
        onClose={vi.fn()}
        historyStack={historyStack}
        historyIndex={0}
        onNavigateBack={vi.fn()}
        onNavigateForward={vi.fn()}
        onPushBranch={vi.fn()}
        onPromoteToPrimary={vi.fn()}
        onSendMessage={vi.fn()}
        tree={mockTree}
      />
    );

    expect(screen.getAllByText("Attention mechanism").length).toBeGreaterThan(0);
  });
});
