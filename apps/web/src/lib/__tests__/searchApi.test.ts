import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../apiClient";
import {
  searchFileResultUrl,
  searchNodeResultUrl,
  searchWorkspace,
  type SearchFileHit,
  type SearchNodeHit,
} from "../searchApi";

vi.mock("../apiClient", () => ({ apiFetch: vi.fn() }));

describe("searchApi (LSI-041)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts a camelCase search body to the scoped workspace endpoint", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      workspaceId: "ws-1",
      query: "raft",
      nodes: [],
      files: [],
      totalNodes: 0,
      totalFiles: 0,
    });

    const controller = new AbortController();
    await searchWorkspace("ws-1", "raft", { topK: 5, signal: controller.signal });

    expect(apiFetch).toHaveBeenCalledWith("/workspaces/ws-1/search", {
      method: "POST",
      body: JSON.stringify({ query: "raft", topK: 5, minSimilarity: 0.0 }),
      signal: controller.signal,
    });
  });

  it("builds canonical node and file result URLs through @/lib/urls", () => {
    const node: SearchNodeHit = {
      nodeId: "node-1",
      chatId: "chat-9",
      role: "assistant",
      content: "content",
      highlightedContext: null,
      similarityScore: 0.8,
      createdAt: "2026-10-10T10:00:00Z",
      metadata: {},
    };
    const file: SearchFileHit = {
      fileId: "f-1",
      filename: "raft.pdf",
      chunkId: "chunk-1",
      chunkIndex: 0,
      snippet: "snippet",
      pageNumber: null,
      sectionHeader: null,
      score: 0.01,
    };

    expect(searchNodeResultUrl("ws-1", node)).toBe("/w/ws-1/chat/chat-9?node=node-1");
    expect(searchFileResultUrl("ws-1", file)).toBe("/w/ws-1/library?file=f-1");
  });
});
