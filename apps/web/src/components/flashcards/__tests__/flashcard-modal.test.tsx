import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FlashcardModal } from "../FlashcardModal";
import * as flashcardApi from "@/lib/flashcardApi";
import type { Flashcard } from "@graphmind/shared";

vi.mock("@/lib/flashcardApi", () => ({
  listNodeFlashcards: vi.fn(),
  generateNodeFlashcards: vi.fn(),
  updateNodeFlashcard: vi.fn(),
  deleteNodeFlashcard: vi.fn(),
}));

describe("FlashcardModal", () => {
  const mockCards: Flashcard[] = [
    {
      id: "card_1",
      workspaceId: "ws_test",
      sourceNodeId: "node_1",
      question: "What is WAL in Postgres?",
      answer: "Write-Ahead Logging guarantees data integrity.",
      position: 0,
      createdAt: "2026-09-11T00:00:00Z",
      updatedAt: "2026-09-11T00:00:00Z",
    },
    {
      id: "card_2",
      workspaceId: "ws_test",
      sourceNodeId: "node_1",
      question: "Why use WAL?",
      answer: "Fast crash recovery and reduced disk random writes.",
      position: 1,
      createdAt: "2026-09-11T00:00:00Z",
      updatedAt: "2026-09-11T00:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and displays existing flashcards without triggering generation", async () => {
    vi.mocked(flashcardApi.listNodeFlashcards).mockResolvedValueOnce(mockCards);

    render(
      <FlashcardModal
        isOpen={true}
        onClose={vi.fn()}
        workspaceId="ws_test"
        nodeId="node_1"
        sourcePreview="PostgreSQL WAL explanation"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("What is WAL in Postgres?")).toBeInTheDocument();
      expect(screen.getByText("Why use WAL?")).toBeInTheDocument();
    });

    expect(flashcardApi.listNodeFlashcards).toHaveBeenCalledWith("ws_test", "node_1");
    expect(flashcardApi.generateNodeFlashcards).not.toHaveBeenCalled();
    expect(screen.getByText("2 cards")).toBeInTheDocument();
  });

  it("automatically generates cards when no existing cards exist", async () => {
    vi.mocked(flashcardApi.listNodeFlashcards).mockResolvedValueOnce([]);
    vi.mocked(flashcardApi.generateNodeFlashcards).mockResolvedValueOnce(mockCards);

    render(
      <FlashcardModal
        isOpen={true}
        onClose={vi.fn()}
        workspaceId="ws_test"
        nodeId="node_1"
        sourcePreview="PostgreSQL WAL explanation"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("What is WAL in Postgres?")).toBeInTheDocument();
    });

    expect(flashcardApi.listNodeFlashcards).toHaveBeenCalledWith("ws_test", "node_1");
    expect(flashcardApi.generateNodeFlashcards).toHaveBeenCalledWith("ws_test", "node_1", {
      count: 5,
      replaceExisting: false,
    });
  });

  it("displays error with retry on load failure", async () => {
    const user = userEvent.setup();
    vi.mocked(flashcardApi.listNodeFlashcards)
      .mockRejectedValueOnce(new Error("Network timeout"))
      .mockResolvedValueOnce(mockCards);

    render(
      <FlashcardModal
        isOpen={true}
        onClose={vi.fn()}
        workspaceId="ws_test"
        nodeId="node_1"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Network timeout")).toBeInTheDocument();
    });

    const retryButton = screen.getByRole("button", { name: /retry/i });
    await user.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText("What is WAL in Postgres?")).toBeInTheDocument();
    });
  });

  it("calls onGoToSource and closes modal", async () => {
    const user = userEvent.setup();
    const handleGoToSource = vi.fn();
    const handleClose = vi.fn();

    vi.mocked(flashcardApi.listNodeFlashcards).mockResolvedValueOnce(mockCards);

    render(
      <FlashcardModal
        isOpen={true}
        onClose={handleClose}
        workspaceId="ws_test"
        nodeId="node_1"
        onGoToSource={handleGoToSource}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("What is WAL in Postgres?")).toBeInTheDocument();
    });

    const goToSourceBtn = screen.getByRole("button", { name: /go to source/i });
    await user.click(goToSourceBtn);

    expect(handleGoToSource).toHaveBeenCalledTimes(1);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("deletes a card via confirmation dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(flashcardApi.listNodeFlashcards).mockResolvedValueOnce(mockCards);
    vi.mocked(flashcardApi.deleteNodeFlashcard).mockResolvedValueOnce(undefined);

    render(
      <FlashcardModal
        isOpen={true}
        onClose={vi.fn()}
        workspaceId="ws_test"
        nodeId="node_1"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("What is WAL in Postgres?")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole("button", { name: /delete flashcard/i });
    await user.click(deleteButtons[0]);

    expect(screen.getByText(/Are you sure you want to delete Card 1\?/i)).toBeInTheDocument();

    const confirmDeleteBtn = screen.getByRole("button", { name: /^delete$/i });
    await user.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(flashcardApi.deleteNodeFlashcard).toHaveBeenCalledWith(
        "ws_test",
        "node_1",
        "card_1"
      );
      expect(screen.queryByText("What is WAL in Postgres?")).not.toBeInTheDocument();
      expect(screen.getByText("Why use WAL?")).toBeInTheDocument();
    });
  });

  it("regenerates cards via confirmation dialog", async () => {
    const user = userEvent.setup();
    const freshCards: Flashcard[] = [
      {
        id: "card_fresh_1",
        workspaceId: "ws_test",
        sourceNodeId: "node_1",
        question: "Brand new generated question?",
        answer: "New answer.",
        position: 0,
        createdAt: "2026-09-11T00:05:00Z",
        updatedAt: "2026-09-11T00:05:00Z",
      },
    ];

    vi.mocked(flashcardApi.listNodeFlashcards).mockResolvedValueOnce(mockCards);
    vi.mocked(flashcardApi.generateNodeFlashcards).mockResolvedValueOnce(freshCards);

    render(
      <FlashcardModal
        isOpen={true}
        onClose={vi.fn()}
        workspaceId="ws_test"
        nodeId="node_1"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("What is WAL in Postgres?")).toBeInTheDocument();
    });

    const regenBtn = screen.getByRole("button", { name: /regenerate flashcards/i });
    await user.click(regenBtn);

    expect(
      screen.getByText(/Are you sure you want to regenerate all flashcards\?/i)
    ).toBeInTheDocument();

    const confirmRegenBtn = screen.getByRole("button", { name: /^regenerate$/i });
    await user.click(confirmRegenBtn);

    await waitFor(() => {
      expect(flashcardApi.generateNodeFlashcards).toHaveBeenCalledWith(
        "ws_test",
        "node_1",
        {
          count: 5,
          replaceExisting: true,
        }
      );
      expect(screen.getByText("Brand new generated question?")).toBeInTheDocument();
      expect(screen.queryByText("What is WAL in Postgres?")).not.toBeInTheDocument();
    });
  });
});
