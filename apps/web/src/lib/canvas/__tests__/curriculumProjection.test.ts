import { expect, it } from "vitest";
import { curriculumFixture } from "@/components/roadmap/__tests__/fixtures";
import {
  initialCurriculumExpansion,
  projectCurriculum,
  selectedCoreTopics,
} from "../curriculumProjection";
it("keeps ordered milestones, topic identity and explicit prerequisites", () => {
  const view = curriculumFixture();
  const graph = projectCurriculum(
    view,
    new Set(view.candidate.items.map((i) => i.id)),
  );
  expect(
    graph.items.filter((i) => i.lane === "spine").map((i) => i.id),
  ).toEqual(["root", "phase1", "group", "choice", "phase2", "further"]);
  expect(graph.links).toContainEqual(
    expect.objectContaining({
      source: "topic1",
      target: "topic2",
      kind: "prerequisite",
    }),
  );
  expect(graph.links).toContainEqual(
    expect.objectContaining({
      source: "group",
      target: "topic1",
      kind: "containment",
    }),
  );
  expect(graph.items.find((i) => i.id === "topic2")?.selectionId).toBe(
    "topic2",
  );
  expect(selectedCoreTopics(view).map((i) => i.id)).toEqual([
    "topic1",
    "chosen",
    "topic2",
  ]);
});
it("collapsed groups retain labels without resources or further descendants", () => {
  const view = curriculumFixture();
  const graph = projectCurriculum(view, new Set(["root", "phase1", "phase2"]));
  expect(graph.items.map((i) => i.id)).toContain("group");
  expect(graph.items.map((i) => i.id)).toContain("further");
  expect(graph.items.map((i) => i.id)).not.toContain("extra");
  expect(graph.items.map((i) => i.id)).not.toContain("topic1");
  view.candidate.resources = Array.from({ length: 100 }, (_, order) => ({
    topicId: "topic1",
    sourceId: String(order),
    order,
    rationale: "Useful",
  }));
  expect(
    projectCurriculum(view, new Set(["root", "phase1", "phase2"])),
  ).toEqual(graph);
});
it("prerequisites override hierarchy while unrelated topics preserve phase order", () => {
  const view = curriculumFixture();
  view.candidate.relations.push({
    sourceId: "topic2",
    targetId: "chosen",
    kind: "prerequisite",
  });
  expect(selectedCoreTopics(view).map((i) => i.id)).toEqual([
    "topic1",
    "topic2",
    "chosen",
  ]);
});

it("initial canvas expansion keeps future phases collapsed", () => {
  const view = curriculumFixture();
  const expanded = initialCurriculumExpansion(view);
  expect(expanded.has("root")).toBe(true);
  expect(expanded.has("phase1")).toBe(true);
  expect(expanded.has("phase2")).toBe(false);
  const graph = projectCurriculum(view, expanded);
  expect(graph.items.map((i) => i.id)).toContain("phase2");
  expect(graph.items.map((i) => i.id)).not.toContain("topic2");
});

it("preserves selected choices and further semantics without exposing optional routes by default", () => {
  const view = curriculumFixture();
  const expanded = new Set(view.candidate.items.map((i) => i.id));
  const graph = projectCurriculum(view, expanded);
  expect(graph.items.find((i) => i.id === "chosen")?.metaLabel).toBe(
    "Selected path",
  );
  expect(graph.items.find((i) => i.id === "choice")?.summary).toBe(
    "Fits your goal",
  );
  expect(graph.items.some((i) => i.id === "other")).toBe(false);
  expect(graph.items.find((i) => i.id === "extra")?.metaLabel).toBe(
    "Further learning",
  );
  const alternatives = projectCurriculum(view, expanded, true);
  expect(alternatives.items.find((i) => i.id === "other")?.metaLabel).toBe(
    "Alternative",
  );
  expect(selectedCoreTopics(view).map((i) => i.id)).toEqual([
    "topic1",
    "chosen",
    "topic2",
  ]);
});
