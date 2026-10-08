import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { RoadmapModal } from "@/components/workspace/RoadmapModal";
import * as api from "@/lib/roadmapApi";

const mock = vi.hoisted(() => ({
  job: null as unknown,
  cancel: vi.fn(),
  push: vi.fn(),
  path: "/",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mock.push }),
  usePathname: () => mock.path,
}));
vi.mock("@/lib/roadmapApi", () => ({
  createRoadmapJob: vi.fn(),
  attachRoadmapFile: vi.fn(),
  attachRoadmapLink: vi.fn(),
  startRoadmapJob: vi.fn(),
  generateRoadmap: vi.fn(),
  readRoadmap: vi.fn(),
  readRoadmapJob: vi.fn(),
}));
vi.mock("@/hooks/useRoadmapJob", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useRoadmapJob")>();
  return {
    ...actual,
    useRoadmapJob: (id: string | null) => ({
      job: id ? mock.job : null,
      events: [],
      connection: "live",
      cancel: mock.cancel,
      retry: vi.fn(),
      answer: vi.fn(),
    }),
  };
});

const queued = {
  id: "job",
  title: "Drawing",
  status: "queued",
  stage: "understand",
  summary: "Ready for the roadmap agent",
  result: null,
  question: null,
  error: null,
};
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_ROADMAP_GENERATOR_ENABLED", "true");
  vi.clearAllMocks();
  mock.job = queued;
  mock.path = "/";
  vi.mocked(api.createRoadmapJob).mockResolvedValue(queued as never);
  vi.mocked(api.startRoadmapJob).mockResolvedValue(queued as never);
});
afterEach(() => vi.unstubAllEnvs());

it("keeps background fields collapsed in the approved clean setup", async () => {
  render(<RoadmapModal isOpen onClose={vi.fn()} />);
  expect(screen.getByLabelText("Learning prompt")).toBeVisible();
  expect(screen.getByLabelText(/Title/)).toBeVisible();
  expect(
    screen.queryByLabelText("What do you already know?"),
  ).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: /Background & references/ }),
  );
  expect(screen.getByLabelText("What do you already know?")).toBeVisible();
  expect(screen.getByLabelText("Reference files")).toBeVisible();
  expect(screen.queryByText(/Curriculum Focus/)).not.toBeInTheDocument();
});

it("starts once and allows backgrounding without canceling", async () => {
  const close = vi.fn();
  render(<RoadmapModal isOpen onClose={close} />);
  await userEvent.type(
    screen.getByLabelText("Learning prompt"),
    "Learn drawing with practical exercises",
  );
  await userEvent.dblClick(
    screen.getByRole("button", { name: /Generate roadmap/ }),
  );
  await waitFor(() => expect(api.createRoadmapJob).toHaveBeenCalledTimes(1));
  await userEvent.click(
    await screen.findByRole("button", { name: "Continue in background" }),
  );
  expect(close).toHaveBeenCalled();
  expect(mock.cancel).not.toHaveBeenCalled();
});

it("retains input and accepted job when an upload fails then resumes submission", async () => {
  vi.mocked(api.attachRoadmapFile)
    .mockRejectedValueOnce(new Error("Upload unavailable"))
    .mockResolvedValueOnce({ id: "ref", status: "inspected" } as never);
  render(<RoadmapModal isOpen onClose={vi.fn()} />);
  await userEvent.type(
    screen.getByLabelText("Learning prompt"),
    "Learn drawing with practical exercises",
  );
  await userEvent.click(
    screen.getByRole("button", { name: /Background & references/ }),
  );
  await userEvent.upload(
    screen.getByLabelText("Reference files"),
    new File(["notes"], "notes.txt", { type: "text/plain" }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: /Generate roadmap/ }),
  );
  expect(await screen.findByText(/Upload unavailable/)).toBeVisible();
  expect(screen.getByLabelText("Learning prompt")).toHaveValue(
    "Learn drawing with practical exercises",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Retry submission" }),
  );
  await waitFor(() => expect(api.startRoadmapJob).toHaveBeenCalledTimes(1));
  expect(api.createRoadmapJob).toHaveBeenCalledTimes(1);
});

it("shows learner-facing labels instead of internal select values", () => {
  render(<RoadmapModal isOpen onClose={vi.fn()} />);
  expect(
    screen.getByRole("combobox", { name: "Current level" }),
  ).toHaveTextContent("Beginner in this subject");
  expect(
    screen.getByRole("combobox", { name: "Target duration" }),
  ).toHaveTextContent("Unsure");
});

it("uses a new key for a deliberately changed request after uncertain create failure", async () => {
  vi.mocked(api.createRoadmapJob).mockRejectedValueOnce(
    new Error("Network timeout"),
  );
  render(<RoadmapModal isOpen onClose={vi.fn()} />);
  await userEvent.type(
    screen.getByLabelText("Learning prompt"),
    "Learn drawing with practical exercises",
  );
  await userEvent.click(
    screen.getByRole("button", { name: /Generate roadmap/ }),
  );
  await screen.findByText("Network timeout");
  await userEvent.type(
    screen.getByLabelText("Learning prompt"),
    " and shading",
  );
  await userEvent.click(
    screen.getByRole("button", { name: /Generate roadmap/ }),
  );
  await waitFor(() => expect(api.createRoadmapJob).toHaveBeenCalledTimes(2));
  expect(vi.mocked(api.createRoadmapJob).mock.calls[0][1]).not.toBe(
    vi.mocked(api.createRoadmapJob).mock.calls[1][1],
  );
});

it("opens completed work only while observing the original route", async () => {
  const close = vi.fn();
  const { rerender } = render(
    <RoadmapModal isOpen resumeJobId="job" onClose={close} />,
  );
  mock.path = "/w/another";
  mock.job = {
    ...queued,
    status: "completed",
    result: { workspaceId: "ws_drawing" },
  };
  rerender(<RoadmapModal isOpen resumeJobId="job" onClose={close} />);
  expect(mock.push).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
});

it("opens the completed roadmap workspace while progress is being watched", async () => {
  mock.job = {
    ...queued,
    status: "completed",
    result: { workspaceId: "ws_drawing" },
  };
  render(<RoadmapModal isOpen resumeJobId="job" onClose={vi.fn()} />);
  await waitFor(() => expect(mock.push).toHaveBeenCalledWith("/w/ws_drawing"));
});

it("a completed refinement never uses generation's automatic workspace navigation", async () => {
  vi.mocked(api.readRoadmap).mockRejectedValue(
    new Error("Temporary unavailability"),
  );
  mock.job = {
    ...queued,
    id: "refine",
    operation: "refine",
    status: "completed",
    result: {
      workspaceId: "existing",
      revisionId: "proposal",
      roadmapId: "roadmap",
      kind: "proposal",
      proposalState: "candidate",
    },
  };
  render(<RoadmapModal isOpen onClose={vi.fn()} resumeJobId="refine" />);
  await waitFor(() => expect(mock.push).not.toHaveBeenCalled());
});

it("does not open an old completed job when switching the resumed job", async () => {
  mock.job = { ...queued, id: "old-job", operation: "generate" };
  const close = vi.fn();
  const { rerender } = render(
    <RoadmapModal isOpen resumeJobId="old-job" onClose={close} />,
  );
  mock.job = {
    ...queued,
    id: "old-job",
    operation: "generate",
    status: "completed",
    result: { kind: "published", workspaceId: "old-workspace" },
  };
  rerender(<RoadmapModal isOpen resumeJobId="new-job" onClose={close} />);
  await waitFor(() => expect(screen.getByText("Drawing")).toBeInTheDocument());
  expect(mock.push).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
});
