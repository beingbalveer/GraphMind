import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { BranchPromotionModal } from "../BranchPromotionModal";
import { curriculumFixture } from "./fixtures";
import { requestRoadmapPromotion } from "@/lib/roadmapApi";

vi.mock("@/lib/roadmapApi", () => ({
  readRoadmap: vi.fn(),
  requestRoadmapPromotion: vi.fn(),
}));
vi.mock("@/hooks/useRoadmapJob", () => ({
  useRoadmapJob: () => ({
    job: null, events: [], error: null, cancel: vi.fn(), answer: vi.fn(), retry: vi.fn(),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requestRoadmapPromotion).mockResolvedValue({ id: "promotion-job" } as never);
});

it("submits an idempotent proposal from a readable saved branch under an active container", async () => {
  const view = curriculumFixture();
  view.candidate.items.find((item) => item.id === "phase2")!.participation = "archived";
  render(
    <BranchPromotionModal
      view={view}
      sourceChatId="source-chat"
      sourceNodeId="saved-branch-leaf"
      sourceTitle="Branch exploration"
      sourceExcerpt="A meaningful saved explanation."
      isOpen
      onClose={vi.fn()}
      onSaved={vi.fn()}
      onJobAccepted={vi.fn()}
    />,
  );

  expect(screen.getByText(/Branch exploration/)).toBeVisible();
  expect(screen.getByText("A meaningful saved explanation.")).toBeVisible();
  expect(screen.queryByText("saved-branch-leaf")).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("phase1"));
  fireEvent.click(screen.getByRole("button", { name: "Prepare proposal" }));

  await waitFor(() => expect(requestRoadmapPromotion).toHaveBeenCalledTimes(1));
  expect(requestRoadmapPromotion).toHaveBeenCalledWith(
    "ws",
    {
      sourceChatId: "source-chat",
      sourceNodeId: "saved-branch-leaf",
      targetContainerId: "phase1",
      baseRevisionId: "revision",
      instruction: undefined,
    },
    expect.any(String),
  );
  expect(screen.getByRole("heading", { name: "Understanding your goal" })).toBeVisible();
});
