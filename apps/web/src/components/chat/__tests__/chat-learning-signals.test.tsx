import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AgentToolCallsBanner } from "../AgentToolCallsBanner";
import { BranchBreadcrumbs } from "../BranchBreadcrumbs";
import { ChatMessage } from "../ChatMessage";
import { SelectionTooltip } from "../SelectionTooltip";

const toolCall = {
  id: "tool-1",
  name: "search_graph",
  status: "completed" as const,
};

const branchProps = {
  steps: [
    { id: "root", leafId: "root", title: "Main chat", isRoot: true },
    { id: "branch", leafId: "branch", title: "Follow-up" },
  ],
  onSelectStep: vi.fn(),
};

const selectionProps = {
  selection: { text: "vector search", x: 100, y: 100 },
  onExplore: vi.fn(),
  onSearch: vi.fn(),
};

const assistantNode = {
  id: "assistant-1",
  parentId: "user-1",
  childrenIds: [],
  role: "assistant" as const,
  content: "Here is a grounded answer.",
  createdAt: "2026-09-10T00:01:00.000Z",
  metadata: {
    ragSources: [
      {
        ref_index: 1,
        ref_tag: "[1]",
        chunk_id: "chunk-1",
        file_id: "file-1",
        filename: "research.md",
        score: 0.9,
        snippet: "Grounding detail",
      },
    ],
  },
};

const failedToolCall = {
  ...toolCall,
  id: "tool-failed",
  status: "error" as const,
  isError: true,
};

describe("chat learning signals", () => {
  it("starts activity collapsed", () => {
    render(<AgentToolCallsBanner toolCalls={[toolCall]} />);

    expect(screen.getByRole("button", { name: /activity/i })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("starts sources collapsed", () => {
    render(<ChatMessage message={assistantNode} />);

    expect(screen.getByRole("button", { name: /sources/i })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("visibly announces a failed tool and offers recovery without expanding activity", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <ChatMessage
        message={{ ...assistantNode, metadata: { toolCalls: [failedToolCall] } }}
        onRetry={onRetry}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Action failed");
    expect(screen.getByRole("button", { name: /activity.*action failed/i })).toHaveAttribute("aria-expanded", "false");
    await user.click(screen.getByRole("button", { name: "Retry response" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("uses a status badge for source page indicators", async () => {
    const user = userEvent.setup();
    render(
      <ChatMessage
        message={{
          ...assistantNode,
          metadata: {
            ragSources: [{ ...assistantNode.metadata.ragSources[0], page_number: 4 }],
          },
        }}
      />
    );

    await user.click(screen.getByRole("button", { name: /sources/i }));
    expect(screen.getByText("p. 4")).toHaveClass("border-info", "rounded-full");
  });

  it("respects reduced motion for migrated signal animations", () => {
    const { container } = render(<SelectionTooltip {...selectionProps} />);
    expect(container.ownerDocument.body.lastElementChild).toHaveClass("motion-reduce:animate-none");

    const { unmount } = render(<AgentToolCallsBanner toolCalls={[{ ...toolCall, status: "running" }]} />);
    expect(screen.getByRole("button", { name: /activity/i }).querySelector("svg")).toHaveClass("motion-reduce:animate-none");
    unmount();
  });

  it("exposes branch lineage without making it a permanent message badge", () => {
    render(<BranchBreadcrumbs {...branchProps} />);

    expect(screen.getByRole("navigation", { name: "Branch lineage" })).toBeVisible();
  });

  it("offers a real selection exploration action", async () => {
    const user = userEvent.setup();
    render(<SelectionTooltip {...selectionProps} />);

    await user.click(screen.getByRole("button", { name: "Explore branch" }));
    expect(selectionProps.onExplore).toHaveBeenCalledOnce();
  });
});
