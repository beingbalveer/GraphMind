import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage", () => ({
  safeGetItem: vi.fn(() => null),
  safeSetItem: vi.fn(() => true),
  safeRemoveItem: vi.fn(() => true),
}));

vi.mock("@/hooks/useChatStream", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useChatStream")>();
  return { ...actual, useChatStream: vi.fn() };
});

vi.mock("@/lib/workspaceApi", () => ({
  fetchGraphSnapshot: vi.fn().mockResolvedValue(null),
  snapshotToTree: vi.fn().mockReturnValue(null),
  resolveFileUrl: vi.fn((fileId: string) => `/api/v1/files/${fileId}`),
}));

import { StudioTutorChat } from "../StudioTutorChat";
import { useChatStream } from "@/hooks/useChatStream";

type StreamState = ReturnType<typeof useChatStream>;

const baseState = {
  tree: null,
  activeMessages: [],
  isStreaming: false,
  streamingNodeId: null,
  error: null,
  activeBranch: null,
  setBranchContext: vi.fn(),
  clearBranchContext: vi.fn(),
  switchBranch: vi.fn(),
  clearError: vi.fn(),
  sendMessage: vi.fn(),
  retryLastMessage: vi.fn(),
  regenerateResponse: vi.fn(),
  editUserMessage: vi.fn(),
  stopStreaming: vi.fn(),
  clearMessages: vi.fn(),
  deleteBranch: vi.fn(),
  updateNodeMetadata: vi.fn(),
  loadTree: vi.fn(),
};

function setStreamState(overrides: Partial<StreamState> = {}) {
  vi.mocked(useChatStream).mockReturnValue({
    ...baseState,
    ...overrides,
  } as unknown as StreamState);
}

const assistantMessage = (overrides: Record<string, unknown> = {}) => ({
  id: "assistant-rich",
  role: "assistant" as const,
  content: "A plain reply.",
  createdAt: "2026-10-10T12:00:05Z",
  parentId: "user-1",
  childrenIds: [],
  highlightedContext: null,
  metadata: {},
  ...overrides,
});

describe("LSI-019 Studio tutor rich replies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setStreamState();
  });

  it("renders assistant replies through the shared markdown renderer", () => {
    setStreamState({
      activeMessages: [
        assistantMessage({
          content: "# Event loop\n\n**Schedules** work and runs `callbacks`.",
        }),
      ],
    } as unknown as Partial<StreamState>);

    render(<StudioTutorChat workspaceId="ws-1" topicId="t1" topicTitle="Event Loops" />);

    expect(screen.getByRole("heading", { name: "Event loop" })).toBeVisible();
    expect(screen.getByText("Schedules").tagName).toBe("STRONG");
    expect(screen.getByText("callbacks")).toHaveClass("bg-muted");
  });

  it("keeps agent tool failures visibly surfaced in the tutor pane", () => {
    setStreamState({
      activeMessages: [
        assistantMessage({
          metadata: {
            toolCalls: [
              { id: "tool-1", name: "search_graph", status: "completed" },
              {
                id: "tool-2",
                name: "fetch_url",
                status: "error",
                isError: true,
                result: "HTTP 503",
              },
            ],
          },
        }),
      ],
    } as unknown as Partial<StreamState>);

    render(<StudioTutorChat workspaceId="ws-1" topicId="t1" />);

    expect(screen.getByText("Activity: action failed")).toBeVisible();
    expect(screen.getByText("Action failed")).toBeVisible();
  });

  it("renders grounded citations and opens the real snippet viewer", async () => {
    const user = userEvent.setup();
    setStreamState({
      activeMessages: [
        assistantMessage({
          metadata: {
            ragSources: [
              {
                ref_index: 1,
                ref_tag: "[1]",
                chunk_id: "chunk-1",
                file_id: "file-1",
                filename: "research.md",
                score: 0.9,
                snippet: "Grounding detail for the tutor reply.",
              },
            ],
          },
        }),
      ],
    } as unknown as Partial<StreamState>);

    render(<StudioTutorChat workspaceId="ws-1" topicId="t1" />);

    await user.click(screen.getByRole("button", { name: /sources/i }));
    await user.click(screen.getByRole("button", { name: /research\.md/i }));

    expect(
      screen.getByText("Grounding detail for the tutor reply."),
    ).toBeVisible();
  });

  it("retains working copy and branch learning actions on tutor replies", async () => {
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);

    setStreamState({
      activeMessages: [assistantMessage({ content: "Copyable tutor answer." })],
    } as unknown as Partial<StreamState>);

    render(<StudioTutorChat workspaceId="ws-1" topicId="t1" />);

    await user.click(screen.getByRole("button", { name: "Copy message text" }));
    expect(writeText).toHaveBeenCalledWith("Copyable tutor answer.");

    expect(
      screen.getByRole("button", { name: /Branch from reply/i }),
    ).toBeVisible();
  });

  it("retains the retry action for a failed tutor reply", async () => {
    const user = userEvent.setup();
    const retryLastMessage = vi.fn();
    setStreamState({
      retryLastMessage,
      activeMessages: [
        assistantMessage({
          content: "⚠️ **Error:** Connection lost during generation.",
          metadata: { responseState: "failed" },
        }),
      ],
    } as unknown as Partial<StreamState>);

    render(<StudioTutorChat workspaceId="ws-1" topicId="t1" />);

    await user.click(screen.getAllByRole("button", { name: /^Retry$/i })[0]);
    expect(retryLastMessage).toHaveBeenCalled();
  });
});
