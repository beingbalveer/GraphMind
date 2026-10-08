import { StrictMode } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { TopicEditor } from "../TopicEditor";
import { curriculumFixture } from "./fixtures";
import { saveRoadmapEdits } from "@/lib/roadmapApi";
vi.mock("@/lib/roadmapApi", () => ({
  saveRoadmapEdits: vi.fn(),
  inspectRoadmapSource: vi.fn(),
}));
beforeEach(() => vi.resetAllMocks());
it("saves a rename against the displayed revision and returns the new view", async () => {
  const view = curriculumFixture();
  const changed = vi.fn();
  const closed = vi.fn();
  vi.mocked(saveRoadmapEdits).mockResolvedValue({
    ...view,
    revisionId: "next",
  });
  render(
    <StrictMode>
      <TopicEditor
        view={view}
        topicId="chosen"
        onClose={closed}
        onSaved={changed}
      />
    </StrictMode>,
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
    target: { value: "A clearer title" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() =>
    expect(changed).toHaveBeenCalledWith(
      expect.objectContaining({ revisionId: "next" }),
    ),
  );
  expect(saveRoadmapEdits).toHaveBeenCalledWith(
    "ws",
    expect.objectContaining({
      baseRevisionId: view.revisionId,
      patches: expect.arrayContaining([
        expect.objectContaining({
          op: "update_item",
          itemId: "chosen",
          title: "A clearer title",
        }),
      ]),
    }),
  );
  expect(closed).toHaveBeenCalled();
});
it("keeps the draft and error visible when a save fails", async () => {
  vi.mocked(saveRoadmapEdits).mockRejectedValue(new Error("Could not save"));
  render(
    <TopicEditor
      view={curriculumFixture()}
      topicId="chosen"
      onClose={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
    target: { value: "Keep this draft" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not save");
  expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue(
    "Keep this draft",
  );
  expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
});

it("offers an explicit reload on conflict while retaining the draft", async () => {
  const { ApiError } = await import("@/lib/apiClient");
  const reload = vi.fn().mockResolvedValue(undefined);
  vi.mocked(saveRoadmapEdits).mockRejectedValue(
    new ApiError(409, "Roadmap changed", { code: "REVISION_CONFLICT" }),
  );
  render(
    <TopicEditor
      view={curriculumFixture()}
      topicId="chosen"
      onClose={vi.fn()}
      onSaved={vi.fn()}
      onReload={reload}
    />,
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
    target: { value: "Unsaved work" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue(
    "Unsaved work",
  );
  expect(reload).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Reload latest and discard draft" }),
  );
  await waitFor(() => expect(reload).toHaveBeenCalled());
});
