import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { RoadmapWorkspace } from "../RoadmapWorkspace";
import { curriculumFixture } from "./fixtures";
import {
  projectCurriculum,
  selectedCoreTopics,
} from "@/lib/canvas/curriculumProjection";

vi.mock("../RoadmapCanvas", () => ({ RoadmapCanvas: () => <div /> }));

it("page selection and canvas projection retain topic identities through refinement and undo", () => {
  const original = curriculumFixture();
  const edited = structuredClone(original);
  edited.revisionId = "refined";
  edited.candidate.items.find((item) => item.id === "chosen")!.title =
    "Focused practice";
  const open = vi.fn();
  const { rerender } = render(
    <RoadmapWorkspace view={original} mode="page" onOpenTopic={open} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Open chosen" }));
  rerender(<RoadmapWorkspace view={edited} mode="page" onOpenTopic={open} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Open Focused practice" }),
  );
  expect(open.mock.calls).toEqual([["chosen"], ["chosen"]]);
  const expanded = new Set(edited.candidate.items.map((item) => item.id));
  const canvas = projectCurriculum(edited, expanded);
  expect(canvas.items.find((item) => item.id === "chosen")?.title).toBe(
    "Focused practice",
  );
  expect(canvas.items.find((item) => item.id === "chosen")?.selectionId).toBe(
    "chosen",
  );
  expect(selectedCoreTopics(edited).map((item) => item.id)).toEqual(
    selectedCoreTopics(original).map((item) => item.id),
  );
  const restored = {
    ...original,
    revisionId: "restored",
    progress: edited.progress,
  };
  rerender(<RoadmapWorkspace view={restored} mode="page" onOpenTopic={open} />);
  expect(screen.getByText("1 of 3 topics completed")).toBeVisible();
  expect(screen.getByRole("button", { name: "Open chosen" })).toBeVisible();
  expect(restored.progress).toEqual(original.progress);
});
