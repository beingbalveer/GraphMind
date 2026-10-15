import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandPalette } from "../CommandPalette";
import { searchWorkspace } from "@/lib/searchApi";
import type { SearchFileHit, SearchNodeHit } from "@/lib/searchApi";
import { buildLibraryUrl, buildNodeUrl } from "@/lib/urls";
import type { ConversationTree } from "@graphmind/shared";

vi.mock("@/lib/searchApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/searchApi")>();
  return { ...actual, searchWorkspace: vi.fn() };
});

const emptyTree: ConversationTree = {
  id: "tree-1",
  rootNodeId: "root",
  activeNodeId: "root",
  createdAt: "2026-10-10T10:00:00.000Z",
  updatedAt: "2026-10-10T10:00:00.000Z",
  nodes: {},
};

const nodeHit = (overrides: Partial<SearchNodeHit> = {}): SearchNodeHit => ({
  nodeId: "node-1",
  chatId: "chat-1",
  role: "assistant",
  content: "Raft uses randomized leader election.",
  highlightedContext: null,
  similarityScore: 0.91,
  createdAt: "2026-10-10T10:00:00Z",
  metadata: {},
  ...overrides,
});

const fileHit = (overrides: Partial<SearchFileHit> = {}): SearchFileHit => ({
  fileId: "file-1",
  filename: "raft.pdf",
  chunkId: "chunk-1",
  chunkIndex: 0,
  snippet: "heartbeat timers drive leader election",
  pageNumber: 3,
  sectionHeader: "Election",
  score: 0.02,
  ...overrides,
});

function renderPalette(props: {
  workspaceId?: string;
  onNavigateResult?: (url: string) => void;
  onClose?: () => void;
}) {
  return render(
    <CommandPalette
      isOpen
      onClose={props.onClose ?? vi.fn()}
      tree={emptyTree}
      viewMode="canvas"
      onSelectNode={vi.fn()}
      onToggleViewMode={vi.fn()}
      onFitView={vi.fn()}
      onCenterActive={vi.fn()}
      onAutoLayout={vi.fn()}
      onClearChat={vi.fn()}
      workspaceId={props.workspaceId}
      onNavigateResult={props.onNavigateResult}
    />,
  );
}

describe("CommandPalette inventory-backed search (LSI-041)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchWorkspace).mockResolvedValue({
      workspaceId: "ws-1",
      query: "raft",
      nodes: [],
      files: [],
      totalNodes: 0,
      totalFiles: 0,
    });
  });

  it("opens a workspace node result through its canonical chat deep link", async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    vi.mocked(searchWorkspace).mockResolvedValue({
      workspaceId: "ws-1",
      query: "raft",
      nodes: [nodeHit()],
      files: [],
      totalNodes: 1,
      totalFiles: 0,
    });

    const onNavigateResult = vi.fn();
    const onClose = vi.fn();
    renderPalette({ workspaceId: "ws-1", onNavigateResult, onClose });

    await user.type(
      screen.getByPlaceholderText("Search conversation nodes or type a command..."),
      "raft",
    );

    const nodeRow = await screen.findByTestId("command-palette-node-node-1");
    await user.click(nodeRow);

    expect(searchWorkspace).toHaveBeenCalledWith(
      "ws-1",
      "raft",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(onNavigateResult).toHaveBeenCalledWith(
      buildNodeUrl("ws-1", "chat-1", "node-1"),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("opens a file result in the workspace library context", async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    vi.mocked(searchWorkspace).mockResolvedValue({
      workspaceId: "ws-1",
      query: "raft",
      nodes: [],
      files: [fileHit()],
      totalNodes: 0,
      totalFiles: 1,
    });

    const onNavigateResult = vi.fn();
    renderPalette({ workspaceId: "ws-1", onNavigateResult });

    await user.type(
      screen.getByPlaceholderText("Search conversation nodes or type a command..."),
      "raft",
    );

    const fileRow = await screen.findByTestId("command-palette-file-file-1");
    await user.click(fileRow);

    expect(onNavigateResult).toHaveBeenCalledWith(
      buildLibraryUrl("ws-1", { file: "file-1" }),
    );
    expect(screen.getByText("raft.pdf")).toBeInTheDocument();
  });

  it("renders an empty state when the workspace has no matches", async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    renderPalette({ workspaceId: "ws-1" });

    await user.type(
      screen.getByPlaceholderText("Search conversation nodes or type a command..."),
      "nonexistent-topic",
    );

    expect(await screen.findByText("No matching results")).toBeInTheDocument();
    await waitFor(() => expect(searchWorkspace).toHaveBeenCalled());
  });

  it("surfaces a search error and recovers on retry", async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    vi.mocked(searchWorkspace)
      .mockRejectedValueOnce(new Error("Not authorized"))
      .mockResolvedValueOnce({
        workspaceId: "ws-1",
        query: "raft",
        nodes: [nodeHit()],
        files: [],
        totalNodes: 1,
        totalFiles: 0,
      });

    renderPalette({ workspaceId: "ws-1", onNavigateResult: vi.fn() });

    await user.type(
      screen.getByPlaceholderText("Search conversation nodes or type a command..."),
      "raft",
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Not authorized");

    await user.click(screen.getByRole("button", { name: "Retry search" }));

    expect(
      await screen.findByTestId("command-palette-node-node-1"),
    ).toBeInTheDocument();
    expect(searchWorkspace).toHaveBeenCalledTimes(2);
  });

  it("does not call the server search when no workspace is provided", async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    renderPalette({});

    await user.type(
      screen.getByPlaceholderText("Search conversation nodes or type a command..."),
      "raft",
    );

    await waitFor(() =>
      expect(screen.getByText("No matching results")).toBeInTheDocument(),
    );
    expect(searchWorkspace).not.toHaveBeenCalled();
  });
});
