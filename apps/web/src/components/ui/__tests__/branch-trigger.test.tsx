import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BranchChatPane } from "@/components/chat/BranchChatPane";
import { SidePeekBranchSheet } from "@/components/chat/SidePeekBranchSheet";
import type { ConversationTree } from "@graphmind/shared";

const tree: ConversationTree = {
  id: "tree", rootNodeId: "branch", activeNodeId: "branch", createdAt: "2026-09-10", updatedAt: "2026-09-10",
  nodes: { branch: { id: "branch", parentId: null, childrenIds: [], role: "user", content: "Explain", highlightedContext: "Context", createdAt: "2026-09-10" } },
};

describe("real branch menu triggers", () => {
  it.each(["primary", "side"])("reveals %s branch controls for keyboard focus and after Escape", async (surface) => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(surface === "primary"
      ? <BranchChatPane tree={tree} branchLeafNodeId="branch" onClose={vi.fn()} onSelectBranchLeaf={vi.fn()} onSendBranchMessage={vi.fn()} onSendNewSiblingBranch={vi.fn()} />
      : <SidePeekBranchSheet tree={tree} isOpen historyStack={[{ nodeId: "branch" }]} historyIndex={0} onClose={vi.fn()} onNavigateBack={vi.fn()} onNavigateForward={vi.fn()} onPushBranch={vi.fn()} onPromoteToPrimary={vi.fn()} onSendMessage={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: surface === "primary" ? "Branch tab options" : "Side branch tab options" });
    act(() => trigger.focus());
    expect(trigger).toHaveFocus();
    const wrapper = trigger.parentElement!;
    // Compiled-theme tests verify this focus-within rule sets opacity to 100%.
    expect(wrapper).toHaveClass("focus-within:opacity-100");
    expect(wrapper.contains(document.activeElement)).toBe(true);
    await user.keyboard("{ArrowDown}{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(wrapper).toHaveClass("focus-within:opacity-100");
  }, 30000);
});
