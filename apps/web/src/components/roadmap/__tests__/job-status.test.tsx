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
it("shows agent steps immediately without expanding", async () => {
  render(
    <JobActivity
      events={[
        {
          sequence: 1,
          stage: "research",
          type: "tool_completed",
          summary: "Inspected a drawing syllabus",
          metadata: {
            tool: "fetch_source",
            sourceUrl: "https://example.com/drawing",
            sourceTitle: "Drawing syllabus",
          },
          createdAt: "now",
        },
      ]}
    />,
  );
  expect(screen.getByText("Inspected a drawing syllabus")).toBeVisible();
  expect(
    screen.getByRole("link", { name: "Drawing syllabus" }),
  ).toHaveAttribute("href", "https://example.com/drawing");
  expect(
    screen.queryByRole("button", { name: "View activity" }),
  ).not.toBeInTheDocument();
});
it("keeps per-search tool lines out of the visible feed", () => {
  render(
    <JobActivity
      events={[
        {
          sequence: 1,
          stage: "research",
          type: "tool_completed",
          summary: "Searched public learning resources",
          metadata: { tool: "search_web" },
          createdAt: "now",
        },
        {
          sequence: 2,
          stage: "research",
          type: "composition_progress",
          summary: "Detailed area 2 of 5; saved 34 concepts",
          metadata: {},
          createdAt: "now",
        },
      ]}
    />,
  );
  expect(
    screen.queryByText("Searched public learning resources"),
  ).not.toBeInTheDocument();
  expect(
    screen.getByText("Detailed area 2 of 5; saved 34 concepts"),
  ).toBeVisible();
});
it("shows the latest step with a working indicator while the job runs", () => {
  render(
    <JobActivity
      active
      events={[
        {
          sequence: 1,
          stage: "compose",
          type: "phase",
          summary: "Drafting the subject outline and topic lessons",
          metadata: {},
          createdAt: "now",
        },
      ]}
    />,
  );
  expect(screen.getByText("Agent steps")).toBeVisible();
  expect(
    screen.getByText("Drafting the subject outline and topic lessons"),
  ).toBeVisible();
  expect(screen.getByLabelText("Working")).toBeVisible();
});
