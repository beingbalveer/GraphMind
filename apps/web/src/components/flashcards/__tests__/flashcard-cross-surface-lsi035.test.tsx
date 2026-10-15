import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { ChatMessage } from "@/components/chat/ChatMessage";
import { SidePeekBranchSheet } from "@/components/chat/SidePeekBranchSheet";
import type { ConversationTree, Flashcard } from "@graphmind/shared";
import * as flashcardApi from "@/lib/flashcardApi";

vi.mock("@/lib/flashcardApi", () => ({
  listNodeFlashcards: vi.fn(),
  generateNodeFlashcards: vi.fn(),
  updateNodeFlashcard: vi.fn(),
  deleteNodeFlashcard: vi.fn(),
}));

const WORKSPACE_ID = "ws-035";
const GENERATION_CONFIG = {
  provider: "openai",
  model: "gpt-5",
  apiKey: "sk-lsi-035",
  baseUrl: "https://api.example.test/v1",
};

const assistantNode = {
  id: "node-root",
  parentId: "node-user",
  childrenIds: [],
  role: "assistant" as const,
  content: "WAL guarantees durability by writing changes before the data pages.",
  createdAt: "2026-10-15T00:01:00.000Z",
};

const makeCard = (id: string, position: number, question: string): Flashcard => ({
  id,
  workspaceId: WORKSPACE_ID,
  sourceNodeId: "node-root",
  question,
  answer: "Answer.",
  position,
  createdAt: "2026-10-15T00:02:00.000Z",
  updatedAt: "2026-10-15T00:02:00.000Z",
});

const rootCards: Flashcard[] = [
  makeCard("card_1", 0, "What does WAL guarantee?"),
  makeCard("card_2", 1, "When is WAL written?"),
];

const branchTree: ConversationTree = {
  id: "tree-1",
  createdAt: "2026-10-15T00:00:00.000Z",
  updatedAt: "2026-10-15T00:00:00.000Z",
  rootNodeId: "root-1",
  activeNodeId: "node-3",
  nodes: {
    "root-1": {
      id: "root-1",
      parentId: null,
      childrenIds: ["node-1"],
      role: "user",
      content: "What is attention?",
      createdAt: "2026-10-15T00:00:00.000Z",
    },
    "node-1": {
      id: "node-1",
      parentId: "root-1",
      childrenIds: ["node-2"],
      role: "assistant",
      content: "Attention weighs the relevance of every token.",
      createdAt: "2026-10-15T00:01:00.000Z",
    },
    "node-2": {
      id: "node-2",
      parentId: "node-1",
      childrenIds: ["node-3"],
      role: "user",
      content: "Explain self-attention.",
      highlightedContext: "Attention mechanism",
      createdAt: "2026-10-15T00:02:00.000Z",
    },
    "node-3": {
      id: "node-3",
      parentId: "node-2",
      childrenIds: [],
      role: "assistant",
      content: "Self-attention compares each token against every other token.",
      createdAt: "2026-10-15T00:03:00.000Z",
    },
  },
};

function renderBranchSurface() {
  return render(
    <SidePeekBranchSheet
      isOpen
      workspaceId={WORKSPACE_ID}
      flashcardGenerationConfig={GENERATION_CONFIG}
      tree={branchTree}
      historyStack={[{ nodeId: "node-3", excerpt: "Attention mechanism" }]}
      historyIndex={0}
      onClose={vi.fn()}
      onNavigateBack={vi.fn()}
      onNavigateForward={vi.fn()}
      onPushBranch={vi.fn()}
      onPromoteToPrimary={vi.fn()}
      onSendMessage={vi.fn()}
    />,
  );
}

describe("LSI-035 flashcard cross-surface review journey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(flashcardApi.listNodeFlashcards).mockResolvedValue([]);
    vi.mocked(flashcardApi.generateNodeFlashcards).mockResolvedValue(rootCards);
    vi.mocked(flashcardApi.updateNodeFlashcard).mockImplementation(
      async (_workspaceId, _nodeId, cardId, input) => {
        const base = rootCards.find((card) => card.id === cardId) ?? rootCards[0];
        return { ...base, ...input, id: cardId };
      },
    );
    vi.mocked(flashcardApi.deleteNodeFlashcard).mockResolvedValue(undefined);
  });

  it("runs generation, edit, delete, and regenerate through the root surface services", async () => {
    const user = userEvent.setup();
    render(
      <ChatMessage
        message={assistantNode}
        workspaceId={WORKSPACE_ID}
        flashcardGenerationConfig={GENERATION_CONFIG}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Generate or review flashcards" }),
    );

    // Review: the study drawer opens for the exact source node.
    await waitFor(() => {
      expect(flashcardApi.listNodeFlashcards).toHaveBeenCalledWith(
        WORKSPACE_ID,
        "node-root",
      );
      expect(screen.getByText("What does WAL guarantee?")).toBeInTheDocument();
    });

    // Generate: BYOK config is forwarded to the generation service.
    expect(flashcardApi.generateNodeFlashcards).toHaveBeenCalledWith(
      WORKSPACE_ID,
      "node-root",
      expect.objectContaining({
        count: 5,
        replaceExisting: false,
        ...GENERATION_CONFIG,
      }),
    );

    // Edit: saving a card calls the update service.
    await user.click(screen.getByRole("button", { name: /manage cards/i }));
    const actionButtons = screen.getAllByRole("button", {
      name: "Flashcard actions",
    });
    await user.click(actionButtons[0]);
    await user.click(
      await screen.findByRole("menuitem", { name: "Edit flashcard" }),
    );
    const questionInput = screen.getByLabelText("Edit question");
    await user.clear(questionInput);
    await user.type(questionInput, "Updated WAL question?");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(flashcardApi.updateNodeFlashcard).toHaveBeenCalledWith(
        WORKSPACE_ID,
        "node-root",
        "card_1",
        { question: "Updated WAL question?", answer: "Answer." },
      );
    });

    // Delete: confirmation calls the delete service for the source node.
    await user.click(screen.getAllByRole("button", { name: "Flashcard actions" })[0]);
    await user.click(
      await screen.findByRole("menuitem", { name: "Delete flashcard" }),
    );
    await user.click(await screen.findByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(flashcardApi.deleteNodeFlashcard).toHaveBeenCalledWith(
        WORKSPACE_ID,
        "node-root",
        "card_1",
      );
    });

    // Regenerate: replacement generation reuses the same config and source node.
    await user.click(screen.getByRole("button", { name: /regenerate flashcards/i }));
    await user.click(await screen.findByRole("button", { name: /^regenerate$/i }));

    await waitFor(() => {
      expect(flashcardApi.generateNodeFlashcards).toHaveBeenLastCalledWith(
        WORKSPACE_ID,
        "node-root",
        expect.objectContaining({
          count: 5,
          replaceExisting: true,
          ...GENERATION_CONFIG,
        }),
      );
    });
  });

  it("exposes the same review/generation contract on the branch and canvas side peek", async () => {
    const user = userEvent.setup();
    renderBranchSurface();

    const trigger = screen.getByRole("button", {
      name: "Generate or review flashcards",
    });
    expect(trigger).toBeInTheDocument();

    await user.click(trigger);

    await waitFor(() => {
      expect(flashcardApi.listNodeFlashcards).toHaveBeenCalledWith(
        WORKSPACE_ID,
        "node-3",
      );
    });

    // Branch/canvas generation uses the branch node id and forwards BYOK config.
    expect(flashcardApi.generateNodeFlashcards).toHaveBeenCalledWith(
      WORKSPACE_ID,
      "node-3",
      expect.objectContaining({
        count: 5,
        replaceExisting: false,
        ...GENERATION_CONFIG,
      }),
    );
  });
});
