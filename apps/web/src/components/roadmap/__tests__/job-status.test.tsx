import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { JobStatus } from "../JobStatus";
import { JobActivity } from "../JobActivity";
import type { JobSnapshot } from "@/lib/roadmapTypes";
const snapshot = {
  id: "job",
  status: "running",
  stage: "research",
  summary: "Building your learning path",
  question: null,
  error: null,
} as JobSnapshot;
it("backgrounding and cancellation are separate real actions", async () => {
  const background = vi.fn(),
    cancel = vi.fn().mockResolvedValue({});
  render(
    <JobStatus
      snapshot={snapshot}
      onBackground={background}
      onCancel={cancel}
      onRetry={vi.fn()}
      onAnswer={vi.fn()}
    />,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Continue in background" }),
  );
  expect(background).toHaveBeenCalledTimes(1);
  expect(cancel).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByRole("button", { name: "Cancel generation" }),
  );
  await waitFor(() => expect(cancel).toHaveBeenCalledTimes(1));
  expect(screen.queryByText(/%|countdown|2-4s/)).not.toBeInTheDocument();
});
it("asks one question and accepts a suggested answer", async () => {
  const answer = vi.fn().mockResolvedValue({});
  render(
    <JobStatus
      snapshot={{
        ...snapshot,
        status: "awaiting_input",
        question: {
          id: "q",
          text: "Which outcome matters?",
          suggestions: ["Sketching", "Painting"],
        },
      }}
      onBackground={vi.fn()}
      onCancel={vi.fn()}
      onRetry={vi.fn()}
      onAnswer={answer}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Sketching" }));
  expect(answer).toHaveBeenCalledWith("q", "Sketching");
});
it("keeps actual activity collapsed until expanded", async () => {
  render(
    <JobActivity
      events={[
        {
          sequence: 1,
          stage: "research",
          type: "tool_completed",
          summary: "Inspected a drawing syllabus",
          metadata: {
            sourceUrl: "https://example.com/drawing",
            sourceTitle: "Drawing syllabus",
          },
          createdAt: "now",
        },
      ]}
    />,
  );
  expect(
    screen.queryByText("Inspected a drawing syllabus"),
  ).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "View activity" }));
  expect(screen.getByText("Inspected a drawing syllabus")).toBeVisible();
  expect(
    screen.getByRole("link", { name: "Drawing syllabus" }),
  ).toHaveAttribute("href", "https://example.com/drawing");
});
