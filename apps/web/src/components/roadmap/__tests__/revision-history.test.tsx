import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { RevisionHistory } from "../RevisionHistory";
import { curriculumFixture } from "./fixtures";
import {
  listRoadmapRevisions,
  readArchivedTopics,
  restoreRoadmapRevision,
} from "@/lib/roadmapApi";
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/roadmapApi", () => ({
  listRoadmapRevisions: vi.fn(),
  readArchivedTopics: vi.fn(),
  restoreRoadmapRevision: vi.fn(),
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listRoadmapRevisions).mockResolvedValue([
    {
      id: curriculumFixture().revisionId,
      baseRevisionId: "previous",
      status: "active",
      title: "Drawing",
      createdAt: "2026-10-08T00:00:00Z",
      added: [],
      changed: ["chosen"],
      removed: [],
      hasLearningHistory: false,
    },
  ]);
  vi.mocked(readArchivedTopics).mockResolvedValue([]);
});
it("undo returns the server view with preserved progress", async () => {
  const view = curriculumFixture();
  const saved = {
    ...view,
    revisionId: "restored",
    progress: {
      chosen: {
        topicId: "chosen",
        status: "completed" as const,
        completedAt: "2026-10-08T00:00:00Z",
      },
    },
  };
  vi.mocked(restoreRoadmapRevision).mockResolvedValue(saved);
  const changed = vi.fn();
  render(<RevisionHistory view={view} onClose={vi.fn()} onSaved={changed} />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Undo last change" }),
  );
  await waitFor(() => expect(changed).toHaveBeenCalledWith(saved));
  expect(restoreRoadmapRevision).toHaveBeenCalledWith(
    "ws",
    "previous",
    view.revisionId,
    false,
  );
});
it("archived topic can reopen its actual saved lesson", async () => {
  const view = curriculumFixture();
  vi.mocked(readArchivedTopics).mockResolvedValue([
    {
      item: view.candidate.items.find((i) => i.id === "chosen")!,
      progress: { topicId: "chosen", status: "completed", completedAt: null },
      sessions: [
        {
          id: "lesson",
          chatId: "saved-chat",
          topicId: "chosen",
          revisionId: "original",
          isNew: false,
          archived: true,
          lessonStartState: "completed",
        },
      ],
    },
  ]);
  render(<RevisionHistory view={view} onClose={vi.fn()} onSaved={vi.fn()} />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Archived topics (1)" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Open saved lesson" }));
  expect(push).toHaveBeenCalledWith("/w/ws/chat/saved-chat");
});
