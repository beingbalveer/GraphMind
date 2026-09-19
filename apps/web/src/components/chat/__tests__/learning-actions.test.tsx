import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChatMessage } from "../ChatMessage";
import { buildLearningActionPrompt, getLearningActionDisplayPrompt } from "../LearningActions";

const assistantNode = {
  id: "assistant-learning-1",
  parentId: "user-1",
  childrenIds: [],
  role: "assistant" as const,
  content: "Embeddings represent semantic meaning as vectors.",
  createdAt: "2026-09-19T00:01:00.000Z",
};

describe("learning actions", () => {
  it("offers focused next steps for the learner's current answer", async () => {
    const user = userEvent.setup();
    const onLearningAction = vi.fn();

    render(
      <ChatMessage
        message={assistantNode}
        isLastAssistantMessage
        onLearningAction={onLearningAction}
      />
    );

    expect(screen.getByText("Continue learning")).toBeVisible();
    expect(screen.getByRole("button", { name: "Explain simply" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Show a worked example" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Quiz me" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "More learning options" }));
    await user.click(screen.getByRole("menuitem", { name: "Production context" }));

    expect(onLearningAction).toHaveBeenCalledWith("assistant-learning-1", "production");
  });

  it("keeps completed earlier answers visually quiet", () => {
    render(
      <ChatMessage
        message={assistantNode}
        isLastAssistantMessage={false}
        onLearningAction={vi.fn()}
      />
    );

    expect(screen.queryByText("Continue learning")).not.toBeInTheDocument();
  });

  it("creates a distinct teaching instruction for each learning intent", () => {
    expect(buildLearningActionPrompt("simple")).toMatch(/plain language/i);
    expect(buildLearningActionPrompt("example")).toMatch(/worked example/i);
    expect(buildLearningActionPrompt("production")).toMatch(/production/i);
    expect(buildLearningActionPrompt("quiz")).toMatch(/one question at a time/i);
    expect(buildLearningActionPrompt("teach_back")).toMatch(/their own words/i);
  });

  it("keeps the learner-visible branch request natural", () => {
    expect(getLearningActionDisplayPrompt("simple")).toBe(
      "Explain this topic in simpler language."
    );
    expect(getLearningActionDisplayPrompt("production")).toBe(
      "Show me the production context for this topic."
    );
  });
});
