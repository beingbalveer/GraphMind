import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StudioRoadmapGenerator } from "../StudioRoadmapGenerator";
import type { JobEventData, JobSnapshot } from "@/lib/roadmapTypes";
import * as api from "@/lib/roadmapApi";

const mock = vi.hoisted(() => ({
  job: null as unknown,
  events: [] as unknown[],
  push: vi.fn(),
  path: "/studio-preview",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mock.push }),
  usePathname: () => mock.path,
}));

vi.mock("@/lib/roadmapApi", () => ({
  createRoadmapJob: vi.fn(),
  startRoadmapJob: vi.fn(),
}));

vi.mock("@/hooks/useRoadmapJob", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/hooks/useRoadmapJob")>();
  return {
    ...actual,
    useRoadmapJob: (id: string | null) => ({
      job: id ? mock.job : null,
      events: id ? mock.events : [],
      connection: "live",
      error: null,
      cancel: vi.fn().mockResolvedValue(undefined),
      retry: vi.fn().mockResolvedValue(undefined),
    }),
  };
});

function runningJob(overrides: Partial<JobSnapshot> = {}): JobSnapshot {
  return {
    id: "job-1",
    operation: "generate",
    title: "API Basics",
    status: "running",
    stage: "research",
    startupReady: true,
    summary: "Researching the path",
    question: null,
    questionCount: 0,
    error: null,
    result: null,
    lastSequence: 4,
    createdAt: "now",
    updatedAt: "now",
    ...overrides,
  };
}

function event(sequence: number, summary: string): JobEventData {
  return {
    sequence,
    stage: "research",
    type: "stage_started",
    summary,
    metadata: {},
    createdAt: "now",
  };
}

async function submitGoal(goal: string) {
  fireEvent.change(screen.getByLabelText("Learning goal"), {
    target: { value: goal },
  });
  fireEvent.click(screen.getByRole("button", { name: "Review details" }));
  fireEvent.click(screen.getByRole("button", { name: "Generate roadmap" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mock.job = runningJob();
  mock.events = [];
  mock.path = "/studio-preview";
  vi.mocked(api.createRoadmapJob).mockResolvedValue({ id: "job-1" } as never);
  vi.mocked(api.startRoadmapJob).mockResolvedValue({ id: "job-1" } as never);
});

it("creates then starts once and switches to real server status", async () => {
  render(<StudioRoadmapGenerator />);
  await submitGoal("Learn to build a small API");

  await waitFor(() => expect(api.createRoadmapJob).toHaveBeenCalledTimes(1));
  expect(api.startRoadmapJob).toHaveBeenCalledTimes(1);
  expect(api.startRoadmapJob).toHaveBeenCalledWith("job-1");
  expect(await screen.findByTestId("studio-job-progress")).toBeVisible();
});

it("reuses one idempotency key across a duplicate submit so one job is created", async () => {
  vi.mocked(api.createRoadmapJob).mockRejectedValueOnce(
    new Error("Network timeout"),
  );
  render(<StudioRoadmapGenerator />);
  await submitGoal("Learn to build a small API");

  expect(await screen.findByText("Network timeout")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "Generate roadmap" }));
  await waitFor(() => expect(api.createRoadmapJob).toHaveBeenCalledTimes(2));
  expect(vi.mocked(api.createRoadmapJob).mock.calls[0][1]).toBe(
    vi.mocked(api.createRoadmapJob).mock.calls[1][1],
  );
  await waitFor(() => expect(api.startRoadmapJob).toHaveBeenCalledTimes(1));
});

it("mints a new idempotency key for a deliberately changed request", async () => {
  vi.mocked(api.createRoadmapJob).mockRejectedValueOnce(
    new Error("Network timeout"),
  );
  render(<StudioRoadmapGenerator />);
  await submitGoal("Learn to build a small API");
  await screen.findByText("Network timeout");

  fireEvent.click(screen.getByRole("button", { name: "Back and edit" }));
  fireEvent.change(screen.getByLabelText("Learning goal"), {
    target: { value: "Learn relational query planning instead" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Review details" }));
  fireEvent.click(screen.getByRole("button", { name: "Generate roadmap" }));

  await waitFor(() => expect(api.createRoadmapJob).toHaveBeenCalledTimes(2));
  expect(vi.mocked(api.createRoadmapJob).mock.calls[0][1]).not.toBe(
    vi.mocked(api.createRoadmapJob).mock.calls[1][1],
  );
});

it("navigates to the canonical workspace URL when generation completes", async () => {
  mock.job = runningJob({
    status: "completed",
    summary: "Your roadmap is ready",
    result: {
      kind: "published",
      workspaceId: "ws-42",
      roadmapId: "rm-42",
      revisionId: "rev-42",
    },
  });
  render(<StudioRoadmapGenerator />);
  await submitGoal("Learn to build a small API");

  await waitFor(() => expect(mock.push).toHaveBeenCalledWith("/w/ws-42"));
});

it("never auto-opens the workspace for a completed proposal", async () => {
  mock.job = runningJob({
    operation: "refine",
    status: "completed",
    result: {
      kind: "proposal",
      proposalState: "candidate",
      workspaceId: "ws-existing",
      roadmapId: "rm-existing",
      revisionId: "rev-proposal",
    },
  });
  render(<StudioRoadmapGenerator />);
  await submitGoal("Add a practice project");

  await screen.findByTestId("studio-job-progress");
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(mock.push).not.toHaveBeenCalled();
});

it("projects the server phase and persisted events without fabricating completion", async () => {
  mock.events = [event(1, "Inspected a source")];
  render(<StudioRoadmapGenerator />);
  await submitGoal("Learn to build a small API");

  await screen.findByTestId("studio-job-progress");
  expect(screen.getByTestId("studio-job-phase")).toHaveTextContent(
    "Researching the path",
  );
  expect(screen.getByText("Inspected a source")).toBeVisible();
  expect(screen.queryByText("Your roadmap is ready")).toBeNull();
});
