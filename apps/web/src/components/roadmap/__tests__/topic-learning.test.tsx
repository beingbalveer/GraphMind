import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { curriculumFixture } from "./fixtures";
import { TopicBriefDrawer } from "../TopicBriefDrawer";
import { TopicProgressControl } from "../TopicProgressControl";
import {
  readTopicBrief,
  openTopicSession,
  setTopicProgress,
} from "@/lib/roadmapApi";
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/w/ws",
}));
vi.mock("@/lib/roadmapApi", () => ({
  readTopicBrief: vi.fn(),
  openTopicSession: vi.fn(),
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
});
it("opens a real persistent lesson through canonical chat routing", async () => {
  vi.mocked(openTopicSession).mockResolvedValue({
    id: "lesson",
    chatId: "chat",
    topicId: "chosen",
    revisionId: "revision",
    isNew: true,
    lessonStartState: "pending",
    archived: false,
  });
  render(
    <TopicBriefDrawer
      view={curriculumFixture()}
      topicId="chosen"
      onClose={vi.fn()}
      onProgress={vi.fn()}
    />,
  );
  await screen.findByRole("heading", { name: "chosen" });
  expect(screen.queryByText("Resources reviewed")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Start learning" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/w/ws/chat/chat"));
  expect(openTopicSession).toHaveBeenCalledWith(
    "ws",
    "chosen",
    expect.any(String),
    false,
  );
});
it("rolls back optimistic completion on failure and allows retry", async () => {
  vi.mocked(setTopicProgress).mockRejectedValueOnce(
    new Error("Could not save"),
  );
  const changed = vi.fn();
  render(
    <TopicProgressControl
      workspaceId="ws"
      progress={{ topicId: "chosen", status: "in_progress", completedAt: null }}
      onChange={changed}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Mark completed" }));
  await screen.findByRole("alert");
  expect(changed.mock.calls[0][0].status).toBe("completed");
  expect(changed.mock.calls[1][0].status).toBe("in_progress");
  expect(screen.getByRole("button", { name: "Mark completed" })).toBeEnabled();
});

it("reopening a completed topic offers its saved lesson and keeps completion", async () => {
  const view = curriculumFixture();
  const item = view.candidate.items.find((i) => i.id === "chosen")!;
  vi.mocked(readTopicBrief).mockResolvedValue({
    item,
    resources: [],
    prerequisites: [],
    progress: {
      topicId: "chosen",
      status: "completed",
      completedAt: "2026-10-08T00:00:00Z",
    },
    defaultChatId: "saved-chat",
    latestCheck: null,
  });
  render(
    <TopicBriefDrawer
      view={view}
      topicId="chosen"
      onClose={vi.fn()}
      onProgress={vi.fn()}
    />,
  );
  await screen.findByRole("button", { name: "Continue lesson" });
  expect(screen.getByRole("button", { name: "Mark incomplete" })).toBeVisible();
  expect(setTopicProgress).not.toHaveBeenCalled();
});

it("does not navigate after the learner closes a pending lesson request", async () => {
  let resolve!: (value: Awaited<ReturnType<typeof openTopicSession>>) => void;
  vi.mocked(openTopicSession).mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const view = curriculumFixture();
  const props = {
    view,
    topicId: "chosen",
    onClose: vi.fn(),
    onProgress: vi.fn(),
  };
  const mounted = render(<TopicBriefDrawer {...props} />);
  await screen.findByRole("button", { name: "Start learning" });
  fireEvent.click(screen.getByRole("button", { name: "Start learning" }));
  mounted.rerender(<TopicBriefDrawer {...props} topicId={null} />);
  resolve({
    id: "lesson",
    chatId: "chat",
    topicId: "chosen",
    revisionId: "revision",
    isNew: true,
    lessonStartState: "pending",
    archived: false,
  });
  await waitFor(() => expect(openTopicSession).toHaveBeenCalled());
  await new Promise((done) => setTimeout(done, 0));
  expect(push).not.toHaveBeenCalled();
});
