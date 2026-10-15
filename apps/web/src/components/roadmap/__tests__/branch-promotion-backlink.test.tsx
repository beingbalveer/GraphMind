import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { TopicBriefDrawer } from "../TopicBriefDrawer";
import { curriculumFixture } from "./fixtures";
import { buildNodeUrl } from "@/lib/urls";
import { readTopicBrief, listTopicSessions } from "@/lib/roadmapApi";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/w/ws",
}));
vi.mock("@/lib/roadmapApi", () => ({
  readTopicBrief: vi.fn(),
  openTopicSession: vi.fn(),
  listTopicSessions: vi.fn(),
  setTopicProgress: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  const view = curriculumFixture();
  vi.mocked(readTopicBrief).mockResolvedValue({
    item: view.candidate.items.find((i) => i.id === "chosen")!,
    resources: [],
    prerequisites: [],
    progress: { topicId: "chosen", status: "not_started", completedAt: null },
    defaultChatId: null,
    latestCheck: null,
  });
  vi.mocked(listTopicSessions).mockResolvedValue({ sessions: [] });
});

it("promoted topic backlinks to the exact persistent source branch via buildNodeUrl", async () => {
  const view = curriculumFixture();
  view.origins = [
    {
      topicId: "chosen",
      creationRevisionId: "proposal",
      sourceWorkspaceId: "ws",
      sourceChatId: "source-root",
      sourceNodeId: "branch-leaf",
      sourceTitle: "A useful exploration",
      sourceExcerpt: "A persisted explanation worth keeping.",
      unavailable: false,
    },
  ];
  render(
    <TopicBriefDrawer
      view={view}
      topicId="chosen"
      onClose={vi.fn()}
      onProgress={vi.fn()}
    />,
  );

  await screen.findByRole("heading", { name: "chosen" });
  expect(await screen.findByText("Added from exploration")).toBeVisible();
  expect(screen.getByText("A useful exploration")).toBeVisible();
  expect(screen.getByText("A persisted explanation worth keeping.")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "Open source branch" }));
  expect(push).toHaveBeenCalledWith(
    buildNodeUrl("ws", "source-root", "branch-leaf"),
  );
});

it("shows an honest state and no link when the source branch was removed", async () => {
  const view = curriculumFixture();
  view.origins = [
    {
      topicId: "chosen",
      creationRevisionId: "proposal",
      sourceWorkspaceId: "ws",
      sourceChatId: null,
      sourceNodeId: null,
      sourceTitle: "A deleted exploration",
      sourceExcerpt: "",
      unavailable: true,
    },
  ];
  render(
    <TopicBriefDrawer
      view={view}
      topicId="chosen"
      onClose={vi.fn()}
      onProgress={vi.fn()}
    />,
  );

  await screen.findByRole("heading", { name: "chosen" });
  await waitFor(() =>
    expect(
      screen.getByText("The source conversation is no longer available."),
    ).toBeVisible(),
  );
  expect(
    screen.queryByRole("button", { name: "Open source branch" }),
  ).not.toBeInTheDocument();
});

it("does not attach source provenance to topics that were not promoted", async () => {
  const view = curriculumFixture();
  view.origins = [
    {
      topicId: "other",
      creationRevisionId: "proposal",
      sourceWorkspaceId: "ws",
      sourceChatId: "source-root",
      sourceNodeId: "branch-leaf",
      sourceTitle: "Unrelated exploration",
      sourceExcerpt: "Belongs to another topic.",
      unavailable: false,
    },
  ];
  render(
    <TopicBriefDrawer
      view={view}
      topicId="chosen"
      onClose={vi.fn()}
      onProgress={vi.fn()}
    />,
  );

  await screen.findByRole("heading", { name: "chosen" });
  expect(screen.queryByText("Added from exploration")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Open source branch" }),
  ).not.toBeInTheDocument();
});
