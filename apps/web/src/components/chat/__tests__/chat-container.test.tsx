import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const defaultChatStreamState = {
  tree: null,
  activeMessages: [],
  isStreaming: false,
  streamingNodeId: null,
  error: null as string | null,
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

const mockUseChatStream = vi.fn(() => ({ ...defaultChatStreamState }));

vi.mock("@/hooks/useChatStream", () => ({
  useChatStream: () => mockUseChatStream(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/w/ws_test",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ logout: vi.fn(), user: null }),
}));

vi.mock("@/lib/workspaceApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/workspaceApi")>();

  return {
    ...actual,
    fetchGraphSnapshot: vi.fn(async () => ({
      workspace: { id: "ws_test", name: "Test workspace" },
    })),
    fetchWorkspaceChats: vi.fn(async () => []),
    getWorkspaceMastery: vi.fn(async () => ({ concepts: [] })),
    getWorkspaceKnowledgeGaps: vi.fn(async () => ({ gaps: [] })),
    getNextTopicRecommendations: vi.fn(async () => ({ recommendations: [] })),
  };
});

import { ChatContainer } from "../ChatContainer";

describe("ChatContainer canonical composition", () => {
  it("constrains the conversation column and keeps the composer at the bottom", () => {
    render(<ChatContainer initialWorkspaceId="ws_test" initialViewMode="chat" />);

    expect(screen.getByTestId("chat-content-column")).toHaveClass(
      "max-w-[var(--chat-content-max)]"
    );
    expect(screen.getByTestId("chat-composer-shell")).toBeVisible();
  });

  it("keeps contextual mastery outside the answer body", () => {
    render(<ChatContainer initialWorkspaceId="ws_test" initialViewMode="chat" />);

    expect(screen.getByRole("button", { name: "Open right panel" })).toBeVisible();
    expect(screen.queryByText("Mastery", { selector: "article *" })).not.toBeInTheDocument();
  });

  beforeEach(() => {
    mockUseChatStream.mockReturnValue({ ...defaultChatStreamState });
  });

  it("renders starter prompt buttons without raw buttons and allows clicking them", () => {
    render(<ChatContainer initialWorkspaceId="ws_test" initialViewMode="chat" />);

    const starterBtn = screen.getByRole("button", { name: /Explain LangGraph & State Machines/i });
    expect(starterBtn).toBeVisible();
    fireEvent.click(starterBtn);
  });

  it("renders stream error inline feedback with retry and dismiss actions", () => {
    const retryMock = vi.fn();
    const clearErrorMock = vi.fn();
    mockUseChatStream.mockReturnValue({
      ...defaultChatStreamState,
      error: "Connection timeout while streaming",
      retryLastMessage: retryMock,
      clearError: clearErrorMock,
    });

    render(<ChatContainer initialWorkspaceId="ws_test" initialViewMode="chat" />);

    const alert = screen.getByText("Stream error").closest('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert).toHaveTextContent("Connection timeout while streaming");

    const retryBtn = screen.getByRole("button", { name: "Retry" });
    const dismissBtn = screen.getByRole("button", { name: "Dismiss" });

    fireEvent.click(retryBtn);
    expect(retryMock).toHaveBeenCalled();

    fireEvent.click(dismissBtn);
    expect(clearErrorMock).toHaveBeenCalled();
  });

  it("keeps ChatContainer styles on semantic color tokens and uses no raw buttons", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/components/chat/ChatContainer.tsx"),
      "utf8"
    );

    expect(source).not.toMatch(/\b(?:bg|text|border|ring)-(?:white|zinc)-/);
    expect(source).not.toMatch(/<button\b/);
  });
});
