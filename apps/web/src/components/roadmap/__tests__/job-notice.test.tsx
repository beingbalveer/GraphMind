import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { RoadmapJobsNotice } from "../RoadmapJobsNotice";
import { listRoadmapJobs } from "@/lib/roadmapApi";
const mock = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mock.push }) }));
vi.mock("@/lib/roadmapApi", () => ({ listRoadmapJobs: vi.fn() }));
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_ROADMAP_GENERATOR_ENABLED", "true");
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllEnvs());
it("reopens saved generation and refreshes ready results on return", async () => {
  const open = vi.fn();
  vi.mocked(listRoadmapJobs).mockResolvedValue([
    {
      id: "job",
      title: "Drawing",
      status: "running",
      startupReady: true,
    } as never,
  ]);
  render(<RoadmapJobsNotice onOpenJob={open} />);
  await userEvent.click(
    await screen.findByRole("button", { name: "View progress" }),
  );
  expect(open).toHaveBeenCalledWith("job");
  vi.mocked(listRoadmapJobs).mockResolvedValue([
    {
      id: "job",
      title: "Drawing",
      status: "completed",
      startupReady: true,
      result: { workspaceId: "ws_drawing" },
    } as never,
  ]);
  act(() => window.dispatchEvent(new Event("focus")));
  await userEvent.click(
    await screen.findByRole("button", { name: "Open roadmap" }),
  );
  expect(mock.push).toHaveBeenCalledWith("/w/ws_drawing");
});
it("keeps unfinished setup records out of progress notices", async () => {
  vi.mocked(listRoadmapJobs).mockResolvedValue([
    { id: "draft", status: "queued", startupReady: false } as never,
  ]);
  render(<RoadmapJobsNotice onOpenJob={vi.fn()} />);
  await waitFor(() => expect(listRoadmapJobs).toHaveBeenCalled());
  expect(
    screen.queryByRole("button", { name: "View progress" }),
  ).not.toBeInTheDocument();
});

it("shows an actionable status error instead of silently hiding saved jobs", async () => {
  vi.mocked(listRoadmapJobs)
    .mockRejectedValueOnce(new Error("Unavailable"))
    .mockResolvedValue([
      {
        id: "job",
        title: "Drawing",
        status: "running",
        startupReady: true,
      } as never,
    ]);
  render(<RoadmapJobsNotice onOpenJob={vi.fn()} />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Retry status" }),
  );
  expect(
    await screen.findByRole("button", { name: "View progress" }),
  ).toBeVisible();
});
