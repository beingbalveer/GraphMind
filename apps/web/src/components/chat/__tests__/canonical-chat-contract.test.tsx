import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChatMessage } from "../ChatMessage";
import { ChatInput } from "../ChatInput";
import { AgentToolCallsBanner } from "../AgentToolCallsBanner";

const baseMessage = {
  id: "msg-1",
  parentId: null,
  childrenIds: [],
  createdAt: "2026-09-10T00:00:00.000Z",
};

describe("Canonical Chat Contract Verification (Scope 2, Task 5)", () => {
  it("keeps the chat surface independent from an external chat package", () => {
    const webPackage = JSON.parse(
      readFileSync(path.resolve(process.cwd(), "package.json"), "utf8")
    );
    const deps = {
      ...webPackage.dependencies,
      ...webPackage.devDependencies,
    };
    const prohibitedPackage = ["assistant", "ui"].join("-");
    expect(deps[`@${prohibitedPackage}/react`]).toBeUndefined();
    expect(deps[prohibitedPackage]).toBeUndefined();
  });

  it("verifies canonical chat source files use only semantic tokens and zero raw buttons", () => {
    const chatFiles = [
      "ChatMessage.tsx",
      "ChatInput.tsx",
      "ChatContainer.tsx",
      "RightSidebar.tsx",
      "AgentToolCallsBanner.tsx",
      "BranchBreadcrumbs.tsx",
      "SelectionTooltip.tsx",
    ];

    for (const file of chatFiles) {
      const content = readFileSync(
        path.resolve(process.cwd(), `src/components/chat/${file}`),
        "utf8"
      );

      // No raw <button> tags
      expect(content, `${file} must not contain raw <button> elements`).not.toMatch(/<button\b/);

      // No hardcoded palette colors
      expect(
        content,
        `${file} must not contain hardcoded zinc or white utility classes`
      ).not.toMatch(/\b(?:bg|text|border|ring)-(?:white|zinc)-/);
    }
  });

  it("verifies user message uses a quiet filled surface and assistant message is borderless", () => {
    const { unmount } = render(
      <ChatMessage
        message={{
          ...baseMessage,
          role: "user",
          content: "What is topological sorting?",
        }}
      />
    );
    expect(screen.getByText("What is topological sorting?")).toHaveClass("bg-muted", "rounded-2xl");

    unmount();
    render(
      <ChatMessage
        message={{
          ...baseMessage,
          role: "assistant",
          content: "Topological sorting orders directed acyclic graph nodes linearly.",
        }}
      />
    );
    expect(
      screen.getByText("Topological sorting orders directed acyclic graph nodes linearly.")
    ).not.toHaveClass("border");
  });

  it("verifies composer handles keyboard semantics, empty submission, and width constraints", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    const { container } = render(
      <ChatInput
        onSendMessage={onSend}
        onStopStreaming={vi.fn()}
        isStreaming={false}
      />
    );

    // Bounded to 44rem
    const outerShell = container.firstChild as HTMLElement;
    expect(outerShell).toHaveClass("max-w-[var(--chat-content-max)]");

    // Empty prompt cannot submit
    const sendBtn = screen.getByRole("button", { name: "Send message" });
    expect(sendBtn).toBeDisabled();

    // Type prompt and submit with Enter
    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "Explain DAG");
    expect(sendBtn).not.toBeDisabled();
    await user.keyboard("{Enter}");
    expect(onSend).toHaveBeenCalledWith("Explain DAG", [], null);
  });

  it("verifies AgentToolCallsBanner is collapsed by default and visibly signals tool failures", () => {
    render(
      <AgentToolCallsBanner
        toolCalls={[
          { id: "tool-1", name: "search_graph", status: "completed" },
          { id: "tool-2", name: "query_db", status: "error", isError: true },
        ]}
      />
    );

    // Collapsed by default - details not visible initially
    expect(screen.queryByText("Arguments:")).not.toBeInTheDocument();

    // The failure badge/indicator is immediately visible even while collapsed
    expect(screen.getByText("Activity: action failed")).toBeVisible();
    expect(screen.getByText("Action failed")).toBeVisible();
  });

  it("verifies reduced-motion compatibility across animated chat surfaces", () => {
    const chatInputSource = readFileSync(
      path.resolve(process.cwd(), "src/components/chat/ChatInput.tsx"),
      "utf8"
    );
    expect(chatInputSource).toContain("motion-reduce:animate-none");
    expect(chatInputSource).toContain("motion-reduce:transition-none");

    const chatContainerSource = readFileSync(
      path.resolve(process.cwd(), "src/components/chat/ChatContainer.tsx"),
      "utf8"
    );
    expect(chatContainerSource).toContain("motion-reduce:animate-none");
  });
});
