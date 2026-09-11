import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  listNodeFlashcards,
  generateNodeFlashcards,
  updateNodeFlashcard,
  deleteNodeFlashcard,
} from "../flashcardApi";
import { ApiError } from "../apiClient";

describe("flashcardApi", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("lists flashcards with GET request to encoded endpoint", async () => {
    const mockCards = [
      {
        id: "card_1",
        workspaceId: "ws_1",
        sourceNodeId: "node_1",
        question: "What is WAL?",
        answer: "Write-Ahead Logging.",
        position: 0,
        createdAt: "2026-09-11T00:00:00Z",
        updatedAt: "2026-09-11T00:00:00Z",
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockCards,
    });

    const result = await listNodeFlashcards("ws_1", "node_1");
    expect(result).toEqual(mockCards);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/workspaces/ws_1/nodes/node_1/flashcards",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
      })
    );
  });

  it("generates flashcards with POST request and JSON body", async () => {
    const mockGenerated = [
      {
        id: "card_1",
        workspaceId: "ws_1",
        sourceNodeId: "node_1",
        question: "Q?",
        answer: "A.",
        position: 0,
        createdAt: "2026-09-11T00:00:00Z",
        updatedAt: "2026-09-11T00:00:00Z",
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => mockGenerated,
    });

    const result = await generateNodeFlashcards("ws_1", "node_1", {
      count: 5,
      replaceExisting: true,
    });
    expect(result).toEqual(mockGenerated);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/workspaces/ws_1/nodes/node_1/flashcards/generate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ count: 5, replaceExisting: true }),
      })
    );
  });

  it("updates flashcard with PATCH request", async () => {
    const mockUpdated = {
      id: "card_1",
      workspaceId: "ws_1",
      sourceNodeId: "node_1",
      question: "Updated?",
      answer: "A.",
      position: 0,
      createdAt: "2026-09-11T00:00:00Z",
      updatedAt: "2026-09-11T00:01:00Z",
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockUpdated,
    });

    const result = await updateNodeFlashcard("ws_1", "node_1", "card_1", {
      question: "Updated?",
    });
    expect(result).toEqual(mockUpdated);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/workspaces/ws_1/nodes/node_1/flashcards/card_1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ question: "Updated?" }),
      })
    );
  });

  it("deletes flashcard with DELETE request handling 204 No Content", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
    });

    const result = await deleteNodeFlashcard("ws_1", "node_1", "card_1");
    expect(result).toBeNull();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/workspaces/ws_1/nodes/node_1/flashcards/card_1",
      expect.objectContaining({
        method: "DELETE",
      })
    );
  });

  it("throws ApiError on 502 Bad Gateway response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
      json: async () => ({ detail: "Flashcard generation failed" }),
    });

    await expect(
      generateNodeFlashcards("ws_1", "node_1", { count: 5 })
    ).rejects.toThrow(ApiError);
  });

  it("forwards custom baseUrl and provider in generation request payload", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => [],
    });

    await generateNodeFlashcards("ws_1", "node_1", {
      count: 5,
      provider: "ollama",
      model: "llama3",
      baseUrl: "http://localhost:11434/v1",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/workspaces/ws_1/nodes/node_1/flashcards/generate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          count: 5,
          provider: "ollama",
          model: "llama3",
          baseUrl: "http://localhost:11434/v1",
        }),
      })
    );
  });
});
