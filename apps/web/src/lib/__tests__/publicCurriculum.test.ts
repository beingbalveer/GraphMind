import { describe, expect, it } from "vitest";
import {
  projectPublicRoadmap,
  publicTopicSequence,
  PUBLIC_ROOT_PREFIX,
} from "../publicCurriculum";
import type { PublicRoadmapDetail } from "../publicSnapshotApi";

const detail: PublicRoadmapDetail = {
  id: "tmpl-python",
  slug: "python-backend",
  title: "Python Backend Engineering",
  summary: "Asynchronous FastAPI services.",
  category: "backend",
  level: "intermediate",
  snapshotVersion: "2026-10-15.1",
  outcomes: ["Build async services"],
  prerequisites: ["Basic Python"],
  phases: [
    {
      id: "pub_phase_2",
      title: "Phase 2: Persistence",
      order: 2,
      topics: [
        {
          id: "pub_topic_db",
          slug: "databases",
          title: "Async databases",
          brief: "SQLAlchemy 2.0",
          order: 1,
          path: "core",
          estimateMinutes: 45,
          prerequisites: ["pub_topic_async"],
        },
      ],
    },
    {
      id: "pub_phase_1",
      title: "Phase 1: Async",
      order: 1,
      topics: [
        {
          id: "pub_topic_async",
          slug: "async-basics",
          title: "Async basics",
          brief: "Event loops",
          order: 1,
          path: "core",
          estimateMinutes: 30,
          prerequisites: [],
        },
        {
          id: "pub_topic_further",
          slug: "advanced-asyncio",
          title: "Advanced asyncio",
          brief: "Beyond the basics",
          order: 2,
          path: "further",
          estimateMinutes: 60,
          prerequisites: [],
        },
      ],
    },
  ],
  sources: [
    {
      id: "pub_src_1",
      title: "FastAPI docs",
      url: "https://fastapi.tiangolo.com",
      locator: null,
      kind: "article",
    },
  ],
};

describe("publicCurriculum projection (LSI-030)", () => {
  it("orders topics by phase then topic order for the reading sequence", () => {
    const sequence = publicTopicSequence(detail);
    expect(sequence.map((entry) => entry.topic.slug)).toEqual([
      "async-basics",
      "advanced-asyncio",
      "databases",
    ]);
    expect(sequence[0]).toMatchObject({
      phaseId: "pub_phase_1",
      phaseTitle: "Phase 1: Async",
      index: 0,
    });
    expect(sequence[2].index).toBe(2);
  });

  it("keeps stable public ids and never grants write access or private identity", () => {
    const view = projectPublicRoadmap(detail);

    expect(view.canWrite).toBe(false);
    expect(view.workspaceId).toBe("");
    expect(view.canvasAnchorChatId).toBe("");
    expect(view.progress).toEqual({});
    expect(view.revisionId).toBe("2026-10-15.1");

    // Every phase/topic keeps the frozen public id from the snapshot.
    const ids = view.candidate.items.map((item) => item.id);
    expect(ids).toContain("pub_phase_1");
    expect(ids).toContain("pub_topic_async");
    expect(ids).toContain(`${PUBLIC_ROOT_PREFIX}:python-backend`);
  });

  it("wires containment and prerequisite edges for the canvas", () => {
    const view = projectPublicRoadmap(detail);
    const contains = view.candidate.relations.filter((r) => r.kind === "contains");
    const prereqs = view.candidate.relations.filter((r) => r.kind === "prerequisite");

    expect(contains).toContainEqual({
      sourceId: `${PUBLIC_ROOT_PREFIX}:python-backend`,
      targetId: "pub_phase_1",
      kind: "contains",
    });
    expect(contains).toContainEqual({
      sourceId: "pub_phase_1",
      targetId: "pub_topic_async",
      kind: "contains",
    });
    // A prerequisite referencing a topic inside the snapshot becomes an edge.
    expect(prereqs).toEqual([
      { sourceId: "pub_topic_async", targetId: "pub_topic_db", kind: "prerequisite" },
    ]);
  });

  it("carries project-level metadata, sources, and core minutes", () => {
    const view = projectPublicRoadmap(detail);
    expect(view.candidate.title).toBe("Python Backend Engineering");
    expect(view.profile.level).toBe("intermediate");
    expect(view.validation.coreMinutes).toBe(75); // 30 + 45; `further` excluded
    expect(view.sources).toHaveLength(1);
    expect(view.sources[0]).toMatchObject({
      id: "pub_src_1",
      title: "FastAPI docs",
      url: "https://fastapi.tiangolo.com",
    });
  });
});
