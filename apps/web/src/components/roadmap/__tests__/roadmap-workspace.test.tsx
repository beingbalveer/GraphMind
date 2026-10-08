import { render, screen, fireEvent } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { curriculumFixture } from "./fixtures";
import { RoadmapWorkspace } from "../RoadmapWorkspace";
import {
  roadmapRouteMode,
  buildWorkspaceUrl,
  buildCanvasUrl,
  buildChatUrl,
  buildLibraryUrl,
  buildSettingsUrl,
} from "@/lib/urls";
vi.mock("../RoadmapCanvas", () => ({
  RoadmapCanvas: () => <div>Curriculum canvas</div>,
}));
it("counts only selected core, initially shows next phase, and preserves topic IDs", () => {
  const view = curriculumFixture();
  const open = vi.fn();
  const start = vi.fn();
  render(
    <RoadmapWorkspace
      view={view}
      mode="page"
      onOpenTopic={open}
      onStartTopic={start}
    />,
  );
  expect(screen.getByText("1 of 3 topics completed")).toBeVisible();
  expect(screen.queryByText("extra")).not.toBeInTheDocument();
  expect(screen.queryByText("Week 1")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Open chosen" }));
  expect(open).toHaveBeenCalledWith("chosen");
  fireEvent.click(screen.getByRole("button", { name: "Continue learning" }));
  expect(start).toHaveBeenCalledWith("chosen");
});
it("shows actual split weekly sessions and keeps plan details collapsed", () => {
  const view = curriculumFixture();
  view.profile.weeklyMinutes = 60;
  view.candidate.sessions = [
    { week: 1, topicId: "chosen", sequence: 0, minutes: 30 },
    { week: 2, topicId: "chosen", sequence: 1, minutes: 30 },
  ];
  render(<RoadmapWorkspace view={view} mode="page" />);
  expect(screen.getByText("Week 1")).toBeVisible();
  expect(screen.getByText("Week 2")).toBeVisible();
  expect(screen.queryByText("Sources reviewed")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "About this plan" }));
  expect(screen.getByText("Sources reviewed")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Continue learning" }),
  ).not.toBeInTheDocument();
});
it("routes only roadmap landing and its authoritative anchor canvas", () => {
  const view = curriculumFixture();
  expect(roadmapRouteMode(buildWorkspaceUrl("ws"), view)).toBe("page");
  expect(roadmapRouteMode(buildCanvasUrl("ws", "anchor"), view)).toBe("canvas");
  for (const path of [
    buildChatUrl("ws", "tutor"),
    buildCanvasUrl("ws", "tutor"),
    buildLibraryUrl("ws"),
    buildSettingsUrl("ws"),
    buildChatUrl("ws", "anchor"),
    buildWorkspaceUrl("other"),
  ])
    expect(roadmapRouteMode(path, view)).toBeNull();
  expect(roadmapRouteMode(buildWorkspaceUrl("ws"), null)).toBeNull();
});

it("keeps further learning inside a core phase out of the initial path", () => {
  const view = curriculumFixture();
  view.candidate.relations = view.candidate.relations.map((r) =>
    r.targetId === "further" ? { ...r, sourceId: "phase1" } : r,
  );
  render(<RoadmapWorkspace view={view} mode="page" />);
  expect(
    screen.queryByRole("button", { name: "further" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Further learning" }));
  expect(screen.getByRole("button", { name: "further" })).toBeVisible();
});

it("keeps future weekly details inside their collapsed phase and numbers phases by position", () => {
  const view = curriculumFixture();
  view.profile.weeklyMinutes = 120;
  view.candidate.items.find((i) => i.id === "phase1")!.order = 7;
  view.candidate.items.find((i) => i.id === "phase2")!.order = 8;
  view.candidate.sessions = [
    { week: 1, topicId: "chosen", sequence: 0, minutes: 60 },
    { week: 2, topicId: "topic2", sequence: 0, minutes: 60 },
  ];
  render(<RoadmapWorkspace view={view} mode="page" onOpenTopic={vi.fn()} />);
  expect(screen.getByRole("button", { name: "1 phase1" })).toBeVisible();
  expect(screen.getByText("Week 1")).toBeVisible();
  expect(screen.queryByText("Week 2")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "2 phase2" }));
  expect(screen.getByText("Week 2")).toBeVisible();
});

it("continues the next in-progress topic even when nothing is marked completed", () => {
  const view = curriculumFixture();
  view.progress.topic1 = {
    topicId: "topic1",
    status: "in_progress",
    completedAt: null,
  };
  render(<RoadmapWorkspace view={view} mode="page" onStartTopic={vi.fn()} />);
  expect(
    screen.getByRole("button", { name: "Continue learning" }),
  ).toBeVisible();
});
