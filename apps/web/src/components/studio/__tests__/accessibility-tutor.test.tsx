import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { expectNoA11yViolations } from "@/test/a11y";
import { StudioTutorChat } from "../StudioTutorChat";

/**
 * LSI-047 automated accessibility gate — tutor surface.
 *
 * Kept in its own file because the tutor pane mounts `useChatStream` and the
 * workspace API, which are module-mocked here. Renders the welcoming state
 * (suggested prompts + composer) and the quoted-passage state, then runs
 * axe-core over the rendered tree. See
 * `docs/integration/evidence/LSI-047.md` for the manual journey this cannot
 * replace.
 */

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
  useChatStream: vi.fn(() => ({
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
    sendMessage: vi.fn().mockResolvedValue(undefined),
    retryLastMessage: vi.fn().mockResolvedValue(undefined),
    regenerateResponse: vi.fn(),
    editUserMessage: vi.fn(),
    stopStreaming: vi.fn(),
    clearMessages: vi.fn(),
    deleteBranch: vi.fn(),
    updateNodeMetadata: vi.fn(),
    loadTree: vi.fn(),
  })),
  isRetryableAssistantResponse: vi.fn(() => false),
}));

vi.mock("@/lib/workspaceApi", () => ({
  fetchGraphSnapshot: vi.fn().mockResolvedValue(null),
  snapshotToTree: vi.fn().mockReturnValue(null),
}));

describe("LSI-047 automated accessibility — tutor surface", () => {
  it("passes on the welcoming tutor state", async () => {
    const { container } = render(
      <StudioTutorChat
        workspaceId="ws-1"
        topicId="t1"
        topicTitle="Event Loops in Python"
      />,
    );
    await waitFor(() =>
      expect(container.textContent).toContain("AI Tutor for Event Loops in Python"),
    );
    await expectNoA11yViolations(container);
  });

  it("passes on the quoted-passage tutor state", async () => {
    const { container } = render(
      <StudioTutorChat
        workspaceId="ws-1"
        topicId="t1"
        topicTitle="Event Loops in Python"
        quotedPassage="The event loop schedules coroutines cooperatively."
        onClearQuote={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(container.textContent).toContain("The event loop schedules coroutines"),
    );
    await expectNoA11yViolations(container);
  });
});
