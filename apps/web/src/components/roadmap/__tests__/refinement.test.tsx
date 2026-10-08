import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { RevisionProposal } from "../RevisionProposal";
import { curriculumFixture } from "./fixtures";
import {
  readRoadmapProposal,
  applyRoadmapRevision,
  rejectRoadmapProposal,
} from "@/lib/roadmapApi";
import { ApiError } from "@/lib/apiClient";
vi.mock("@/lib/roadmapApi", () => ({
  readRoadmapProposal: vi.fn(),
  applyRoadmapRevision: vi.fn(),
  rejectRoadmapProposal: vi.fn(),
}));
beforeEach(() => {
  vi.resetAllMocks();
  const view = { ...curriculumFixture(), revisionId: "proposal" };
  vi.mocked(readRoadmapProposal).mockResolvedValue({
    original: view.candidate,
    view,
    baseRevisionId: "revision",
    diff: {
      added: [],
      changed: ["chosen"],
      removed: [],
      summary: "0 added, 1 changed, 0 removed",
      identityChanges: [],
    },
    affectedCompletedTopics: ["chosen"],
    outdated: false,
    status: "candidate",
  });
});
it("completion shows a proposal and applies only after an explicit click", async () => {
  const saved = vi.fn();
  const view = curriculumFixture();
  vi.mocked(applyRoadmapRevision).mockResolvedValue({
    ...view,
    revisionId: "proposal",
  });
  render(
    <RevisionProposal
      workspaceId="ws"
      revisionId="proposal"
      onSaved={saved}
      onClose={vi.fn()}
      onRegenerate={vi.fn()}
    />,
  );
  await screen.findByRole("button", { name: "Apply changes" });
  expect(applyRoadmapRevision).not.toHaveBeenCalled();
  expect(saved).not.toHaveBeenCalled();
  const apply = screen.getByRole("button", { name: "Apply changes" });
  fireEvent.click(apply);
  fireEvent.click(apply);
  await waitFor(() =>
    expect(saved).toHaveBeenCalledWith(
      expect.objectContaining({ revisionId: "proposal" }),
    ),
  );
  expect(applyRoadmapRevision).toHaveBeenCalledTimes(1);
});
it("retains a conflicting proposal and offers regeneration", async () => {
  vi.mocked(applyRoadmapRevision).mockRejectedValue(
    new ApiError(409, "A newer edit exists", { code: "REVISION_CONFLICT" }),
  );
  const regenerate = vi.fn();
  render(
    <RevisionProposal
      workspaceId="ws"
      revisionId="proposal"
      onSaved={vi.fn()}
      onClose={vi.fn()}
      onRegenerate={regenerate}
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Apply changes" }));
  await screen.findByRole("alert");
  expect(
    screen.queryByRole("button", { name: "Apply changes" }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Reload and regenerate" }),
  );
  expect(regenerate).toHaveBeenCalled();
});
it("keeping current rejects only the candidate and preserves the active view", async () => {
  vi.mocked(rejectRoadmapProposal).mockResolvedValue(undefined);
  const saved = vi.fn();
  const closed = vi.fn();
  render(
    <RevisionProposal
      workspaceId="ws"
      revisionId="proposal"
      onSaved={saved}
      onClose={closed}
      onRegenerate={vi.fn()}
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Keep current" }));
  await waitFor(() => expect(closed).toHaveBeenCalled());
  expect(saved).not.toHaveBeenCalled();
  expect(applyRoadmapRevision).not.toHaveBeenCalled();
});

it("shows actual before and after exercises inside collapsed change details",async()=>{
 const original=curriculumFixture().candidate;const view=curriculumFixture();view.candidate.items=view.candidate.items.map(item=>item.id==="chosen"?{...item,exercise:"Draw twenty slow lines and compare pressure."}:item);
 vi.mocked(readRoadmapProposal).mockResolvedValue({original,view,baseRevisionId:"revision",diff:{added:[],changed:["chosen"],removed:[],summary:"0 added, 1 changed, 0 removed",identityChanges:[]},affectedCompletedTopics:[],outdated:false,status:"candidate"});
 render(<RevisionProposal workspaceId="ws" revisionId="proposal" onSaved={vi.fn()} onClose={vi.fn()} onRegenerate={vi.fn()}/>);
 await screen.findByRole("button",{name:"View changes"});expect(screen.queryByText("Draw twenty slow lines and compare pressure.")).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:"View changes"}));fireEvent.click(screen.getByRole("button",{name:"chosen"}));expect(screen.getByText("Draw twenty slow lines and compare pressure.")).toBeVisible();expect(screen.getByText("Practice")).toBeVisible();
});
