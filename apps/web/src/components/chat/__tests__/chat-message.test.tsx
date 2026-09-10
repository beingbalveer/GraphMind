import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChatMessage, MarkdownRenderer } from "../ChatMessage";

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

  it("uses semantic Markdown surfaces for inline code, quotes, and tables", () => {
    render(
      <MarkdownRenderer
        content={"Inline `code`.\n\n> Quoted text\n\n| Header |\n| --- |\n| Value |"}
      />
    );

    expect(screen.getByText("code")).toHaveClass("bg-muted", "border-border");
    expect(screen.getByText("Quoted text").closest("blockquote")).toHaveClass(
      "bg-background-secondary",
      "border-border-strong"
    );
    expect(screen.getByRole("table")).toHaveClass("divide-border");
  });

  it("opens injected branch links through the supplied branch callback", async () => {
    const user = userEvent.setup();
    const onOpenSideBranch = vi.fn();
    render(
      <MarkdownRenderer
        content="Explore this exact excerpt next."
        branchLinks={[{ excerpt: "exact excerpt", leafId: "branch-leaf-1" }]}
        onOpenSideBranch={onOpenSideBranch}
      />
    );

    await user.click(screen.getByRole("button", { name: "exact excerpt" }));
    expect(onOpenSideBranch).toHaveBeenCalledWith("branch-leaf-1", "exact excerpt");
  });

  it("uses semantic destructive text for failed assistant responses", () => {
    render(<ChatMessage message={{ ...assistantNode, isError: true }} />);

    expect(screen.getByText(assistantNode.content).parentElement).toHaveClass("text-destructive");
  });

  it("uses the semantic overlay token for an image preview", async () => {
    const user = userEvent.setup();
    render(
      <ChatMessage
        message={{
          ...userNode,
          attachments: [
            {
              id: "image-1",
              name: "Diagram",
              sizeBytes: 10,
              mimeType: "image/png",
              fileCategory: "image",
              data: "data:image/png;base64,AA==",
            },
          ],
        }}
      />
    );

    await user.click(screen.getByTitle("Click to view full screen"));
    const closePreview = screen.getByRole("button", { name: "Close preview" });
    expect(closePreview.closest("div.fixed")).toHaveClass("bg-overlay", "text-foreground");
    expect(screen.getByTitle("Download image")).toHaveClass("text-foreground");
    expect(closePreview).toHaveClass("text-foreground");
  });
});
