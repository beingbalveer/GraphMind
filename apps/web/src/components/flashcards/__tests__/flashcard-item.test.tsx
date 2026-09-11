import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { FlashcardItem } from "../FlashcardItem";
import type { Flashcard } from "@graphmind/shared";

describe("FlashcardItem", () => {
  const mockCard: Flashcard = {
    id: "card_123",
    workspaceId: "ws_test",
    sourceNodeId: "node_test",
    question: "What is an event loop?",
    answer: "A programming construct that dispatches events or messages in a program.",
    position: 0,
    createdAt: "2026-09-11T00:00:00Z",
    updatedAt: "2026-09-11T00:00:00Z",
  };

  it("renders question and hides answer until reveal button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <FlashcardItem
        card={mockCard}
        onSave={vi.fn()}
        onRequestDelete={vi.fn()}
      />
    );

    expect(screen.getByText("What is an event loop?")).toBeInTheDocument();
    expect(screen.queryByTestId("flashcard-answer-card_123")).not.toBeInTheDocument();

    const showButton = screen.getByRole("button", { name: /show answer/i });
    await user.click(showButton);

    expect(screen.getByTestId("flashcard-answer-card_123")).toBeInTheDocument();
    expect(
      screen.getByText(/programming construct that dispatches events/i)
    ).toBeInTheDocument();

    const hideButton = screen.getByRole("button", { name: /hide answer/i });
    await user.click(hideButton);

    expect(screen.queryByTestId("flashcard-answer-card_123")).not.toBeInTheDocument();
  });

  it("handles editing and saves trimmed updates", async () => {
    const user = userEvent.setup();
    const handleSave = vi.fn().mockResolvedValue(undefined);

    render(
      <FlashcardItem
        card={mockCard}
        onSave={handleSave}
        onRequestDelete={vi.fn()}
      />
    );

    const editButton = screen.getByRole("button", { name: /edit flashcard/i });
    await user.click(editButton);

    const qInput = screen.getByLabelText("Edit question");
    const aInput = screen.getByLabelText("Edit answer");

    expect(qInput).toHaveValue("What is an event loop?");
    expect(aInput).toHaveValue(mockCard.answer);

    await user.clear(qInput);
    await user.type(qInput, "  Updated question?  ");

    const saveButton = screen.getByRole("button", { name: /save/i });
    expect(saveButton).toBeEnabled();

    await user.click(saveButton);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith("card_123", {
        question: "Updated question?",
        answer: mockCard.answer,
      });
    });
  });

  it("cancels editing without saving", async () => {
    const user = userEvent.setup();
    const handleSave = vi.fn();

    render(
      <FlashcardItem
        card={mockCard}
        onSave={handleSave}
        onRequestDelete={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: /edit flashcard/i }));
    const qInput = screen.getByLabelText("Edit question");
    await user.type(qInput, "extra text");

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelButton);

    expect(handleSave).not.toHaveBeenCalled();
    expect(screen.getByText("What is an event loop?")).toBeInTheDocument();
  });

  it("calls onRequestDelete when delete button is clicked", async () => {
    const user = userEvent.setup();
    const handleDelete = vi.fn();

    render(
      <FlashcardItem
        card={mockCard}
        onSave={vi.fn()}
        onRequestDelete={handleDelete}
      />
    );

    const deleteButton = screen.getByRole("button", { name: /delete flashcard/i });
    await user.click(deleteButton);

    expect(handleDelete).toHaveBeenCalledWith(mockCard);
  });

  it("disables mutation controls when isBusy is true but allows reveal", async () => {
    const user = userEvent.setup();

    render(
      <FlashcardItem
        card={mockCard}
        onSave={vi.fn()}
        onRequestDelete={vi.fn()}
        isBusy={true}
      />
    );

    expect(screen.getByRole("button", { name: /edit flashcard/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /delete flashcard/i })).toBeDisabled();

    const showButton = screen.getByRole("button", { name: /show answer/i });
    expect(showButton).toBeEnabled();
    await user.click(showButton);
    expect(screen.getByTestId("flashcard-answer-card_123")).toBeInTheDocument();
  });
});
