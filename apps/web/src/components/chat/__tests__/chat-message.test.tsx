import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChatMessage } from "../ChatMessage";

const userNode = {
  id: "user-1",
  parentId: null,
  childrenIds: [],
  role: "user" as const,
  content: "Explain vector embeddings.",
  createdAt: "2026-09-10T00:00:00.000Z",
};

const assistantNode = {
  id: "assistant-1",
  parentId: "user-1",
  childrenIds: [],
  role: "assistant" as const,
  content: "Vector embeddings encode semantic meaning as numbers.",
  createdAt: "2026-09-10T00:01:00.000Z",
};

describe("ChatMessage", () => {
  it("renders a user prompt in a quiet surface and an assistant answer without a border", () => {
    const { unmount } = render(<ChatMessage message={userNode} />);
    expect(screen.getByText(userNode.content)).toHaveClass("bg-muted", "rounded-2xl");

    unmount();
    render(<ChatMessage message={assistantNode} />);
    expect(screen.getByText(assistantNode.content)).not.toHaveClass("border");
  });

  it("keeps message actions available by keyboard", async () => {
    const user = userEvent.setup();
    render(
      <ChatMessage
        message={userNode}
        isLastUserMessage
        onEditUserMessage={vi.fn()}
      />
    );

    await user.tab();
    expect(screen.getByRole("button", { name: "Edit message" })).toHaveFocus();
  });
});
