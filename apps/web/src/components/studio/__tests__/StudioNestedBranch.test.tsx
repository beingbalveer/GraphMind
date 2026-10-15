import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { StudioTutorChat } from "../StudioTutorChat";
import { StudioTutorRail } from "../StudioTutorRail";
import { StudioLessonReader } from "../StudioLessonReader";
import { StudioCourseRail } from "../StudioCourseRail";
import { LearningStudioShell } from "../LearningStudioShell";
import { useChatStream } from "@/hooks/useChatStream";
import { createConversationTree, addChildNode, ConversationTree } from "@graphmind/shared";
import type { CurriculumItemData } from "@/lib/roadmapTypes";

const mockStorage = new Map<string, string>();
vi.mock("@/lib/storage", () => ({
  safeGetItem: vi.fn((key: string) => mockStorage.get(key) ?? null),
  safeSetItem: vi.fn((key: string, value: string) => {
    mockStorage.set(key, value);
    return true;
  }),
  safeRemoveItem: vi.fn((key: string) => {
    mockStorage.delete(key);
    return true;
  }),
}));

vi.mock("@/hooks/useChatStream", () => ({
  useChatStream: vi.fn(),
  isRetryableAssistantResponse: vi.fn(() => false),
}));

vi.mock("@/lib/workspaceApi", () => ({
  fetchGraphSnapshot: vi.fn().mockResolvedValue(null),
  snapshotToTree: vi.fn().mockReturnValue(null),
}));

const mockTopic: CurriculumItemData = {
  id: "topic_async",
  kind: "topic",
  title: "Asynchronous Generators in Python",
  brief: "Understanding async generators and cooperative multitasking.",
  objectives: ["Explain yield in async functions"],
  exercise: "Write an async generator that yields square roots.",
  format: "concepts",
  order: 1,
  path: "core",
  estimateMinutes: 25,
  participation: "active",
};

describe("Nested Branch UI & Canonical Navigation (LSI-016)", () => {
  let mockSendMessage: ReturnType<typeof vi.fn>;
  let mockSwitchBranch: ReturnType<typeof vi.fn>;
  let mockClearMessages: ReturnType<typeof vi.fn>;
  let mockStopStreaming: ReturnType<typeof vi.fn>;
  let mockLoadTree: ReturnType<typeof vi.fn>;

  function createTestTree(): {
    tree: ConversationTree;
    rootId: string;
    ans1Id: string;
    branch1Id: string;
    branch1ReplyId: string;
    branch2Id: string;
    subBranchId: string;
  } {
    let tree = createConversationTree({
      role: "user",
      content: "Explain asynchronous generators in Python",
    });
    const rootId = tree.rootNodeId;

    const { tree: t1, node: ans1Node } = addChildNode(tree, {
      parentId: rootId,
      role: "assistant",
      content: "Async generators use `async def` and `yield` to stream values asynchronously.",
    });
    tree = t1;
    const ans1Id = ans1Node.id;

    const { tree: t2, node: b1Node } = addChildNode(tree, {
      parentId: ans1Id,
      role: "user",
      content: "Explain `yield` mechanics in an async function",
      highlightedContext: "`yield` to stream values asynchronously",
    });
    tree = t2;
    const branch1Id = b1Node.id;

    const { tree: t3, node: b1ReplyNode } = addChildNode(tree, {
      parentId: branch1Id,
      role: "assistant",
      content: "Each `yield` suspends execution and returns control to the event loop.",
    });
    tree = t3;
    const branch1ReplyId = b1ReplyNode.id;

    // Sibling branch
    const { tree: t4, node: b2Node } = addChildNode(tree, {
      parentId: ans1Id,
      role: "user",
      content: "Show code example for async generators",
      highlightedContext: "`yield` to stream values asynchronously",
      metadata: { title: "Code Example" },
    });
    tree = t4;
    const branch2Id = b2Node.id;

    // Nested sub-branch
    const { tree: t5, node: subNode } = addChildNode(tree, {
      parentId: branch1ReplyId,
      role: "user",
      content: "Explain how exceptions propagate through an async generator",
      highlightedContext: "returns control to the event loop",
    });
    tree = t5;
    const subBranchId = subNode.id;

    return {
      tree,
      rootId,
      ans1Id,
      branch1Id,
      branch1ReplyId,
      branch2Id,
      subBranchId,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.clear();

    mockSendMessage = vi.fn().mockResolvedValue(undefined);
    mockSwitchBranch = vi.fn();
    mockClearMessages = vi.fn();
    mockStopStreaming = vi.fn();
    mockLoadTree = vi.fn();

    vi.mocked(useChatStream).mockReturnValue({
      tree: null,
      activeMessages: [],
      isStreaming: false,
      streamingNodeId: null,
      error: null,
      activeBranch: null,
      clearBranchContext: vi.fn(),
      setBranchContext: vi.fn(),
      switchBranch: mockSwitchBranch,
      clearError: vi.fn(),
      sendMessage: mockSendMessage,
      retryLastMessage: vi.fn(),
      regenerateResponse: vi.fn(),
      editUserMessage: vi.fn(),
      stopStreaming: mockStopStreaming,
      clearMessages: mockClearMessages,
      deleteBranch: vi.fn(),
      updateNodeMetadata: vi.fn(),
      loadTree: mockLoadTree,
    });
  });

  afterEach(() => {
    mockStorage.clear();
  });

  it("keeps lesson reader and course outline visible while branch rail is active on desktop", () => {
    render(
      <LearningStudioShell
        header={<header data-testid="studio-header">Header</header>}
        showRails={true}
        isLeftRailOpen={true}
        isRightRailOpen={true}
        courseRail={
          <StudioCourseRail
            courseTitle="Backend Engineering with Python"
            progressPercent={40}
            outlineContent={<div>Outline Lessons</div>}
          />
        }
        tutorRail={
          <StudioTutorRail
            workspaceId="ws_1"
            topicId="t1"
            topicTitle="Asynchronous Generators in Python"
          />
        }
      >
        <StudioLessonReader
          workspaceId="ws_1"
          topic={mockTopic}
          lessonIndex={0}
          totalLessons={3}
        />
      </LearningStudioShell>
    );

    // Desktop left outline rail is visible
    expect(screen.getByTestId("studio-desktop-left-rail")).toBeVisible();
    expect(screen.getByText("Backend Engineering with Python")).toBeInTheDocument();

    // Center lesson reader stage is visible with lesson heading
    expect(screen.getByTestId("studio-main-stage")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Asynchronous Generators in Python", level: 1 })
    ).toBeInTheDocument();

    // Desktop right tutor / branch rail is visible and displays topic title as companion
    expect(screen.getByTestId("studio-desktop-right-rail")).toBeVisible();
    expect(screen.getByTestId("studio-tutor-rail")).toBeInTheDocument();
    expect(screen.getAllByText("Asynchronous Generators in Python").length).toBeGreaterThanOrEqual(2);
  });

  it("reconstructs branch ancestry breadcrumbs from initialNodeId deep link", () => {
    const { tree, subBranchId } = createTestTree();
    tree.activeNodeId = subBranchId;

    vi.mocked(useChatStream).mockReturnValue({
      tree,
      activeMessages: [
        tree.nodes[subBranchId],
      ],
      isStreaming: false,
      streamingNodeId: null,
      error: null,
      activeBranch: null,
      clearBranchContext: vi.fn(),
      setBranchContext: vi.fn(),
      switchBranch: mockSwitchBranch,
      clearError: vi.fn(),
      sendMessage: mockSendMessage,
      retryLastMessage: vi.fn(),
      regenerateResponse: vi.fn(),
      editUserMessage: vi.fn(),
      stopStreaming: mockStopStreaming,
      clearMessages: mockClearMessages,
      deleteBranch: vi.fn(),
      updateNodeMetadata: vi.fn(),
      loadTree: mockLoadTree,
    });

    const onBranchChange = vi.fn();

    render(
      <StudioTutorChat
        workspaceId="ws_1"
        topicId="topic_async"
        topicTitle="Asynchronous Generators in Python"
        initialNodeId={subBranchId}
        onBranchChange={onBranchChange}
      />
    );

    // Branch lineage banner is rendered
    const lineageBanner = screen.getByTestId("branch-lineage-banner");
    expect(lineageBanner).toBeInTheDocument();

    // Breadcrumb navigation contains ancestor steps
    const nav = screen.getByRole("navigation", { name: "Branch lineage" });
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveTextContent("Asynchronous Generators in Python");

    // Click "Main conversation" button to return to root
    const returnBtn = screen.getByRole("button", { name: "Return to main tutor" });
    fireEvent.click(returnBtn);

    expect(mockSwitchBranch).toHaveBeenCalledWith(tree.rootNodeId);
    expect(onBranchChange).toHaveBeenCalledWith(null);
  });

  it("allows branching from assistant message reply and text selection", async () => {
    const { tree, ans1Id } = createTestTree();
    tree.activeNodeId = tree.rootNodeId;

    vi.mocked(useChatStream).mockReturnValue({
      tree,
      activeMessages: [
        tree.nodes[tree.rootNodeId],
        tree.nodes[ans1Id],
      ],
      isStreaming: false,
      streamingNodeId: null,
      error: null,
      activeBranch: null,
      clearBranchContext: vi.fn(),
      setBranchContext: vi.fn(),
      switchBranch: mockSwitchBranch,
      clearError: vi.fn(),
      sendMessage: mockSendMessage,
      retryLastMessage: vi.fn(),
      regenerateResponse: vi.fn(),
      editUserMessage: vi.fn(),
      stopStreaming: mockStopStreaming,
      clearMessages: mockClearMessages,
      deleteBranch: vi.fn(),
      updateNodeMetadata: vi.fn(),
      loadTree: mockLoadTree,
    });

    render(
      <StudioTutorChat
        workspaceId="ws_1"
        topicId="topic_async"
        topicTitle="Asynchronous Generators in Python"
      />
    );

    // Assistant message contains "Branch from reply"
    const branchBtn = screen.getByRole("button", { name: "Branch from reply" });
    expect(branchBtn).toBeInTheDocument();

    fireEvent.click(branchBtn);

    // Origin quote banner appears in composer
    const branchBanner = screen.getByTestId("branch-origin-banner");
    expect(branchBanner).toBeInTheDocument();
    expect(branchBanner).toHaveTextContent("Branching Conversation");

    // Enter branch question and send
    const input = screen.getByTestId("tutor-chat-input");
    fireEvent.change(input, { target: { value: "Can you elaborate on yield?" } });

    const sendBtn = screen.getByRole("button", { name: "Send message to AI Tutor" });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalled();
    });

    const sendOptions = mockSendMessage.mock.calls[0][3];
    expect(sendOptions.branchOverride).toMatchObject({
      parentNodeId: ans1Id,
    });
  });

  it("switches between sibling branch tabs stemming from the same parent", () => {
    const { tree, branch1ReplyId, branch2Id } = createTestTree();
    tree.activeNodeId = branch1ReplyId;

    vi.mocked(useChatStream).mockReturnValue({
      tree,
      activeMessages: [
        tree.nodes[branch1ReplyId],
      ],
      isStreaming: false,
      streamingNodeId: null,
      error: null,
      activeBranch: null,
      clearBranchContext: vi.fn(),
      setBranchContext: vi.fn(),
      switchBranch: mockSwitchBranch,
      clearError: vi.fn(),
      sendMessage: mockSendMessage,
      retryLastMessage: vi.fn(),
      regenerateResponse: vi.fn(),
      editUserMessage: vi.fn(),
      stopStreaming: mockStopStreaming,
      clearMessages: mockClearMessages,
      deleteBranch: vi.fn(),
      updateNodeMetadata: vi.fn(),
      loadTree: mockLoadTree,
    });

    const onBranchChange = vi.fn();

    render(
      <StudioTutorChat
        workspaceId="ws_1"
        topicId="topic_async"
        topicTitle="Asynchronous Generators in Python"
        onBranchChange={onBranchChange}
      />
    );

    // Sibling tabs are rendered
    const siblingContainer = screen.getByTestId("sibling-branch-tabs");
    expect(siblingContainer).toBeInTheDocument();

    // Sibling tab for "Code Example"
    const codeExampleBtn = screen.getByRole("button", { name: "Code Example" });
    expect(codeExampleBtn).toBeInTheDocument();

    fireEvent.click(codeExampleBtn);

    expect(mockSwitchBranch).toHaveBeenCalledWith(branch2Id);
    expect(onBranchChange).toHaveBeenCalledWith(branch2Id);
  });
});
