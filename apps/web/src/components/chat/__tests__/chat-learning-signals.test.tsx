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
