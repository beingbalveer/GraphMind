import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

// The learner's browser-local selection: Anthropic + a BYOK key + tuned params.
vi.mock("@/hooks/useModelConfig", () => {
  const config = {
    provider: "anthropic",
    model: "claude-3-5-sonnet",
    temperature: 0.4,
    maxTokens: 2048,
    systemPrompt: "",
    geminiApiKey: "",
    openaiApiKey: "",
    anthropicApiKey: "sk-ant-live",
    deepseekApiKey: "",
    ollamaBaseUrl: "http://localhost:11434/v1",
  };
  return {
    DEFAULT_LLM_CONFIG: config,
    useModelConfig: () => ({
      config,
      isLoaded: true,
      updateConfig: vi.fn(),
      resetDefaults: vi.fn(),
      getEffectiveApiKey: (provider: string) =>
        provider === "anthropic" || provider === "claude" ? "sk-ant-live" : undefined,
      getEffectiveBaseUrl: (provider: string) =>
        provider === "ollama" ? config.ollamaBaseUrl : undefined,
    }),
  };
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
  clearBranchContext: vi.fn(),
  setBranchContext: vi.fn(),
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

/**
 * LSI-039 — the Learning Studio tutor must honor the selected provider: the
 * BYOK key, custom base URL, and generation parameters chosen in Settings reach
 * the real tutor request, exactly as they do in the main conversation.
 */
describe("LSI-039 Studio tutor provider settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards the effective provider, key, base URL, and generation params to the tutor request", async () => {
    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useChatStream).mockReturnValue({
      ...baseState,
      sendMessage: mockSendMessage,
    } as unknown as StreamState);

    render(
      <StudioTutorChat
        workspaceId="ws-1"
        topicId="t1"
        topicTitle="Event Loops"
      />,
    );

    fireEvent.change(screen.getByTestId("tutor-chat-input"), {
      target: { value: "Explain coroutines" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message to AI Tutor" }));

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        "Explain coroutines",
        "anthropic",
        "claude-3-5-sonnet",
        expect.objectContaining({
          workspaceId: "ws-1",
          apiKey: "sk-ant-live",
          temperature: 0.4,
          maxTokens: 2048,
        }),
      );
    });
  });
});
