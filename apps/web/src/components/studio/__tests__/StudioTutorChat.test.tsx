import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { StudioTutorChat } from "../StudioTutorChat";
import { useChatStream } from "@/hooks/useChatStream";

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
  isRetryableAssistantResponse: vi.fn((content: string, state: unknown) => {
    return (
      !content ||
      state === "failed" ||
      state === "interrupted" ||
      content.includes("⚠️") ||
      content.includes("stopped")
    );
  }),
}));

vi.mock("@/lib/workspaceApi", () => ({
  fetchGraphSnapshot: vi.fn().mockResolvedValue(null),
  snapshotToTree: vi.fn().mockReturnValue(null),
}));

describe("StudioTutorChat — SSE Stream & Local Context Lifecycle (LSI-014)", () => {
  let mockSendMessage: ReturnType<typeof vi.fn>;
  let mockRetryLastMessage: ReturnType<typeof vi.fn>;
  let mockStopStreaming: ReturnType<typeof vi.fn>;
  let mockClearMessages: ReturnType<typeof vi.fn>;
  let mockLoadTree: ReturnType<typeof vi.fn>;
  let mockClearError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.clear();

    mockSendMessage = vi.fn().mockResolvedValue(undefined);
    mockRetryLastMessage = vi.fn().mockResolvedValue(undefined);
    mockStopStreaming = vi.fn();
    mockClearMessages = vi.fn();
    mockLoadTree = vi.fn();
    mockClearError = vi.fn();

    vi.mocked(useChatStream).mockReturnValue({
      tree: null,
      activeMessages: [],
      isStreaming: false,
      streamingNodeId: null,
      error: null,
      activeBranch: null,
      clearBranchContext: vi.fn(),
      setBranchContext: vi.fn(),
      switchBranch: vi.fn(),
      clearError: mockClearError,
      sendMessage: mockSendMessage,
      retryLastMessage: mockRetryLastMessage,
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

  it("renders welcoming empty state with suggested prompts and populates composer on click", () => {
    render(
      <StudioTutorChat
        workspaceId="ws-1"
        topicId="t1"
        topicTitle="Event Loops in Python"
      />,
    );

    expect(screen.getByText("AI Tutor for Event Loops in Python")).toBeInTheDocument();
    expect(
      screen.getByText("Summarize the key ideas of Event Loops in Python"),
    ).toBeInTheDocument();

    const promptBtn = screen.getByText("Show a practical code example");
    fireEvent.click(promptBtn);

    const textarea = screen.getByTestId("tutor-chat-input") as HTMLTextAreaElement;
    expect(textarea.value).toBe("Show a practical code example");
  });

  it("persists composer draft to scoped localStorage key and clears on send", async () => {
    const draftKey = "graphmind_studio_tutor_draft_ws-1_session-123";

    render(
      <StudioTutorChat
        workspaceId="ws-1"
        topicId="t1"
        topicTitle="Event Loops"
        topicSessionId="session-123"
      />,
    );

    const textarea = screen.getByTestId("tutor-chat-input");
    fireEvent.change(textarea, { target: { value: "Can you explain asyncio tasks?" } });

    expect(mockStorage.get(draftKey)).toBe("Can you explain asyncio tasks?");

    const sendBtn = screen.getByRole("button", { name: "Send message to AI Tutor" });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        "Can you explain asyncio tasks?",
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          workspaceId: "ws-1",
          topicSessionId: "session-123",
        }),
      );
    });

    expect(mockStorage.get(draftKey)).toBeUndefined();
  });

  it("restores existing draft when mounted for the same topic session", () => {
    const draftKey = "graphmind_studio_tutor_draft_ws-1_session-existing";
    mockStorage.set(draftKey, "Restored draft question from previous visit");

    render(
      <StudioTutorChat
        workspaceId="ws-1"
        topicId="t1"
        topicSessionId="session-existing"
      />,
    );

    const textarea = screen.getByTestId("tutor-chat-input") as HTMLTextAreaElement;
    expect(textarea.value).toBe("Restored draft question from previous visit");
  });

  it("displays quoted passage banner and includes it with message context", async () => {
    const onClearQuote = vi.fn();
    render(
      <StudioTutorChat
        workspaceId="ws-1"
        topicId="t1"
        topicSessionId="session-1"
        quotedPassage="Async functions return coroutines that must be awaited."
        onClearQuote={onClearQuote}
      />,
    );

    expect(screen.getByTestId("quoted-passage-banner")).toBeInTheDocument();
    expect(
      screen.getByText(/Async functions return coroutines that must be awaited./),
    ).toBeInTheDocument();

    const textarea = screen.getByTestId("tutor-chat-input");
    fireEvent.change(textarea, { target: { value: "Why do they return coroutines?" } });

    const sendBtn = screen.getByRole("button", { name: "Send message to AI Tutor" });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.stringContaining('Async functions return coroutines that must be awaited.'),
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          workspaceId: "ws-1",
          topicSessionId: "session-1",
          branchOverride: expect.objectContaining({
            highlightedText: "Async functions return coroutines that must be awaited.",
          }),
        }),
      );
    });

    expect(onClearQuote).toHaveBeenCalled();
  });

  it("renders messages and provides stop generation control when streaming", () => {
    vi.mocked(useChatStream).mockReturnValue({
      tree: null,
      activeMessages: [
        {
          id: "msg-1",
          role: "user",
          content: "What is an event loop?",
          createdAt: "2026-10-10T12:00:00Z",
          parentId: null,
          childrenIds: ["msg-2"],
          highlightedContext: null,
          metadata: {},
        },
        {
          id: "msg-2",
          role: "assistant",
          content: "The event loop is the core mechanism...",
          createdAt: "2026-10-10T12:00:05Z",
          parentId: "msg-1",
          childrenIds: [],
          highlightedContext: null,
          metadata: {},
        },
      ],
      isStreaming: true,
      streamingNodeId: "msg-2",
      error: null,
      activeBranch: null,
      clearBranchContext: vi.fn(),
      setBranchContext: vi.fn(),
      switchBranch: vi.fn(),
      clearError: mockClearError,
      sendMessage: mockSendMessage,
      retryLastMessage: mockRetryLastMessage,
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
        workspaceId="ws-1"
        topicId="t1"
        topicSessionId="session-1"
      />,
    );

    expect(screen.getByTestId("tutor-message-user")).toHaveTextContent("What is an event loop?");
    expect(screen.getByTestId("tutor-message-assistant")).toHaveTextContent("The event loop is the core mechanism...");
    expect(screen.getByText("streaming")).toBeInTheDocument();

    const stopButton = screen.getByRole("button", { name: "Stop" });
    fireEvent.click(stopButton);

    expect(mockStopStreaming).toHaveBeenCalled();
  });

  it("provides retry capability for failed or interrupted assistant responses", () => {
    vi.mocked(useChatStream).mockReturnValue({
      tree: null,
      activeMessages: [
        {
          id: "msg-1",
          role: "user",
          content: "Explain tasks",
          createdAt: "2026-10-10T12:00:00Z",
          parentId: null,
          childrenIds: ["msg-2"],
          highlightedContext: null,
          metadata: {},
        },
        {
          id: "msg-2",
          role: "assistant",
          content: "⚠️ **Error:** Connection lost during generation.",
          createdAt: "2026-10-10T12:00:05Z",
          parentId: "msg-1",
          childrenIds: [],
          highlightedContext: null,
          metadata: { responseState: "failed" },
        },
      ],
      isStreaming: false,
      streamingNodeId: null,
      error: "Generation interrupted",
      activeBranch: null,
      clearBranchContext: vi.fn(),
      setBranchContext: vi.fn(),
      switchBranch: vi.fn(),
      clearError: mockClearError,
      sendMessage: mockSendMessage,
      retryLastMessage: mockRetryLastMessage,
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
        workspaceId="ws-1"
        topicId="t1"
        topicSessionId="session-1"
      />,
    );

    const retryButtons = screen.getAllByRole("button", { name: /retry/i });
    expect(retryButtons.length).toBeGreaterThan(0);

    fireEvent.click(retryButtons[0]);

    expect(mockRetryLastMessage).toHaveBeenCalled();
  });

  it("stops stream on topic/session switch to prevent late-output cross-contamination", () => {
    const { rerender, unmount } = render(
      <StudioTutorChat
        workspaceId="ws-1"
        topicId="t1"
        topicSessionId="session-1"
      />,
    );

    // Initial mount calls stopStreaming as safeguard
    expect(mockStopStreaming).toHaveBeenCalled();
    mockStopStreaming.mockClear();

    // Switch topic/session
    rerender(
      <StudioTutorChat
        workspaceId="ws-1"
        topicId="t2"
        topicSessionId="session-2"
      />,
    );

    // Stream must be stopped immediately
    expect(mockStopStreaming).toHaveBeenCalled();

    mockStopStreaming.mockClear();
    unmount();

    // Unmount must stop stream
    expect(mockStopStreaming).toHaveBeenCalled();
  });
});
