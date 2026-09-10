import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { TimelineReplayBar } from "../TimelineReplayBar";
import { CommandPalette } from "../CommandPalette";
import { FocusDrawer } from "../FocusDrawer";
import { ConversationTree, TreeNode } from "@graphmind/shared";

describe("Knowledge Canvas - Primitives & Semantic Tokens Compliance", () => {
  const canvasFiles = [
    "GraphCanvas.tsx",
    "ThreadGraphNode.tsx",
    "FocusDrawer.tsx",
    "TimelineReplayBar.tsx",
    "CommandPalette.tsx",
    "CustomBranchEdge.tsx",
    "MindMapEdge.tsx",
  ];

  it("ensures zero raw <button elements in all canvas components", () => {
    canvasFiles.forEach((file) => {
      const content = fs.readFileSync(
        path.resolve(__dirname, "..", file),
        "utf-8"
      );
      // Ensure no raw <button tag (allow Button component)
      const rawButtonMatches = content.match(/<button[\s>]/g);
      expect(
        rawButtonMatches,
        `Found raw <button> in components/canvas/${file}`
      ).toBeNull();
    });
  });

  it("ensures zero hardcoded zinc- color classes in all canvas components", () => {
    canvasFiles.forEach((file) => {
      const content = fs.readFileSync(
        path.resolve(__dirname, "..", file),
        "utf-8"
      );
      const zincMatches = content.match(/\bzinc-\d+\b/g);
      expect(
        zincMatches,
        `Found hardcoded zinc color classes in components/canvas/${file}: ${zincMatches?.join(", ")}`
      ).toBeNull();
    });
  });
});

describe("TimelineReplayBar Component", () => {
  const dummyTimeline: any = {
    workspaceId: "ws-1",
    totalEvents: 3,
    events: [
      {
        id: "evt-1",
        workspaceId: "ws-1",
        eventType: "node_created",
        nodeId: "n-1",
        conceptId: null,
        title: "Started inquiry",
        summary: "Introduction to concepts",
        timestamp: "2026-09-10T10:00:00Z",
        isMilestone: false,
        metadata: {},
      },
      {
        id: "evt-2",
        workspaceId: "ws-1",
        eventType: "milestone",
        nodeId: "n-2",
        conceptId: "c-1",
        title: "Understood Superposition",
        summary: "Mastered fundamental quantum concept",
        timestamp: "2026-09-10T10:15:00Z",
        isMilestone: true,
        metadata: {},
      },
      {
        id: "evt-3",
        workspaceId: "ws-1",
        eventType: "node_created",
        nodeId: "n-3",
        conceptId: null,
        title: "Diving into entanglement",
        summary: "Explored non-locality",
        timestamp: "2026-09-10T10:30:00Z",
        isMilestone: false,
        metadata: {},
      },
    ],
  };

  const defaultProps = {
    timeline: dummyTimeline,
    currentEventIndex: 1,
    onSelectEventIndex: vi.fn(),
    isPlaying: false,
    onTogglePlay: vi.fn(),
    playbackSpeed: 1,
    onSpeedChange: vi.fn(),
    onClose: vi.fn(),
    visibleNodeCount: 2,
    totalNodeCount: 3,
    masteredConceptCount: 1,
    totalConceptCount: 2,
  };

  it("renders timeline replay controls and handles play/pause clicks", () => {
    render(<TimelineReplayBar {...defaultProps} />);

    expect(screen.getByText("Event 2 of 3")).toBeInTheDocument();
    expect(screen.getByText("Understood Superposition")).toBeInTheDocument();

    const playBtn = screen.getByLabelText("Play Replay");
    fireEvent.click(playBtn);
    expect(defaultProps.onTogglePlay).toHaveBeenCalled();

    const forwardBtn = screen.getByLabelText("Next Milestone");
    fireEvent.click(forwardBtn);
    expect(defaultProps.onSelectEventIndex).toHaveBeenCalled();

    const closeBtn = screen.getByLabelText("Exit Timeline Replay");
    fireEvent.click(closeBtn);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});

describe("CommandPalette Component", () => {
  const dummyTree: ConversationTree = {
    id: "tree-1",
    rootNodeId: "root",
    activeNodeId: "root",
    createdAt: "2026-09-10T10:00:00.000Z",
    updatedAt: "2026-09-10T10:00:00.000Z",
    nodes: {
      root: {
        id: "root",
        role: "user",
        content: "What is quantum computing?",
        parentId: null,
        childrenIds: [],
        createdAt: "2026-09-10T10:00:00.000Z",
        depth: 0,
      } as TreeNode,
    },
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    tree: dummyTree,
    viewMode: "canvas" as const,
    onSelectNode: vi.fn(),
    onToggleViewMode: vi.fn(),
    onFitView: vi.fn(),
    onCenterActive: vi.fn(),
    onAutoLayout: vi.fn(),
    onClearChat: vi.fn(),
  };

  it("renders command palette and handles actions", () => {
    render(<CommandPalette {...defaultProps} />);

    expect(
      screen.getByPlaceholderText("Search conversation nodes or type a command...")
    ).toBeInTheDocument();

    expect(screen.getByText("Fit All Nodes in View")).toBeInTheDocument();
    expect(screen.getByText("Switch to Chat View")).toBeInTheDocument();

    const fitBtn = screen.getByText("Fit All Nodes in View");
    fireEvent.click(fitBtn);
    expect(defaultProps.onFitView).toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});

describe("FocusDrawer Component", () => {
  const dummyTree: ConversationTree = {
    id: "tree-1",
    rootNodeId: "root",
    activeNodeId: "root",
    createdAt: "2026-09-10T10:00:00.000Z",
    updatedAt: "2026-09-10T10:00:00.000Z",
    nodes: {
      root: {
        id: "root",
        role: "user",
        content: "What is quantum computing?",
        parentId: null,
        childrenIds: ["node-1"],
        createdAt: "2026-09-10T10:00:00.000Z",
        depth: 0,
      } as TreeNode,
      "node-1": {
        id: "node-1",
        role: "assistant",
        content: "Here is the quantum explanation...",
        parentId: "root",
        childrenIds: [],
        createdAt: "2026-09-10T10:01:00.000Z",
        depth: 1,
      } as TreeNode,
    },
  };

  it("renders node content and branch textarea", () => {
    const onSendFollowUp = vi.fn();
    const onClose = vi.fn();
    const onSelectBranch = vi.fn();
    const onExploreBranch = vi.fn();

    render(
      <FocusDrawer
        node={dummyTree.nodes["node-1"]}
        tree={dummyTree}
        isOpen={true}
        onClose={onClose}
        onSelectBranch={onSelectBranch}
        onExploreBranch={onExploreBranch}
        onSendFollowUp={onSendFollowUp}
      />
    );

    expect(screen.getByText("Here is the quantum explanation...")).toBeInTheDocument();

    const input = screen.getByPlaceholderText("Ask follow-up in this thread...");
    fireEvent.change(input, { target: { value: "Tell me more about superposition" } });

    const submitBtn = screen.getByLabelText("Send follow-up");
    fireEvent.click(submitBtn);

    expect(onSendFollowUp).toHaveBeenCalledWith("Tell me more about superposition", "node-1");
  });
});
