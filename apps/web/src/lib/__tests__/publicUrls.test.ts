import { describe, expect, it } from "vitest";
import {
  buildPublicCatalogUrl,
  buildPublicLessonUrl,
  buildPublicRoadmapUrl,
} from "../urls";

describe("public URL helpers (LSI-029)", () => {
  it("builds the bare catalog landing without filters", () => {
    expect(buildPublicCatalogUrl()).toBe("/learn");
    expect(buildPublicCatalogUrl({})).toBe("/learn");
    expect(buildPublicCatalogUrl({ query: "", category: "", level: "" })).toBe("/learn");
  });

  it("carries discovery filters as an encoded, shareable query string", () => {
    expect(buildPublicCatalogUrl({ level: "beginner" })).toBe("/learn?level=beginner");
    expect(buildPublicCatalogUrl({ query: "async await", category: "back end" })).toBe(
      "/learn?query=async+await&category=back+end",
    );
  });

  it("builds stable public roadmap and lesson deep links", () => {
    expect(buildPublicRoadmapUrl("python-backend")).toBe("/learn/python-backend");
    expect(buildPublicRoadmapUrl("dot net")).toBe("/learn/dot%20net");
    expect(buildPublicLessonUrl("python-backend", "event-loops")).toBe(
      "/learn/python-backend/lessons/event-loops",
    );
    expect(
      buildPublicLessonUrl("python-backend", "event-loops", { node: "n-1" }),
    ).toBe("/learn/python-backend/lessons/event-loops?node=n-1");
  });
});
