import { describe, expect, it, vi } from "vitest";
import { resumePendingIntent, type ResumeDeps } from "../intentResume";
import type { PendingIntent } from "../authIntent";
import type { PublicRoadmapDetail } from "../publicSnapshotApi";
import type { EnrollmentDetail } from "../enrollmentApi";

const ROADMAP: PublicRoadmapDetail = {
  id: "tmpl-python",
  slug: "python-backend",
  title: "Python Backend Engineering",
  summary: "Asynchronous FastAPI services.",
  category: "backend",
  level: "intermediate",
  snapshotVersion: "2026-10-15.1",
  outcomes: [],
  prerequisites: [],
  phases: [
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
      ],
    },
  ],
  sources: [],
};

const ENROLLMENT: EnrollmentDetail = {
  roadmapId: "rm_1",
  workspaceId: "ws_new",
  revisionId: "rev_1",
  sourceSnapshotRef: "tmpl-python:2026-10-15.1",
  title: "Python Backend Engineering",
  createdAt: "2026-10-16T00:00:00Z",
  updatedAt: "2026-10-16T00:00:00Z",
  topicProgress: {},
  topicMap: [{ publicTopicId: "pub_topic_async", privateTopicId: "item_async" }],
};

const intent = (value: Partial<PendingIntent> & { kind: PendingIntent["kind"] }) =>
  ({
    createdAt: 1_000,
    expiresAt: 9_999_999,
    readingRatio: null,
    ...value,
  }) as PendingIntent;

function makeDeps(overrides: Partial<ResumeDeps> = {}) {
  const readPublicRoadmap = vi.fn().mockResolvedValue(ROADMAP);
  const performSaveRoadmapCopy = vi.fn(async (input: { publicTopicId?: string | null }) => ({
    enrollment: ENROLLMENT,
    created: true,
    privateTopicId: input.publicTopicId === "pub_topic_async" ? "item_async" : null,
  }));
  const deps: ResumeDeps = {
    readPublicRoadmap,
    performSaveRoadmapCopy: performSaveRoadmapCopy as unknown as ResumeDeps["performSaveRoadmapCopy"],
    createSaveCopySession: () => ({ keys: new Map(), workspaces: new Map() }),
    saveReadingPosition: vi.fn(),
    announceLearningCollectionChanged: vi.fn(),
    ...overrides,
  };
  return { deps, readPublicRoadmap, performSaveRoadmapCopy };
}

const SNAPSHOT = {
  templateId: "tmpl-python",
  slug: "python-backend",
  snapshotVersion: "2026-10-15.1",
};

describe("resumePendingIntent (LSI-032)", () => {
  it("opens the generator form without any write", async () => {
    const { deps, performSaveRoadmapCopy } = makeDeps();
    const outcome = await resumePendingIntent(intent({ kind: "generator" }), deps);

    expect(outcome.status).toBe("applied");
    expect(outcome.destination).toBe("/studio-preview");
    expect(performSaveRoadmapCopy).not.toHaveBeenCalled();
  });

  it("opens learner Home for a bare sign-in", async () => {
    const { deps, readPublicRoadmap } = makeDeps();
    const outcome = await resumePendingIntent(intent({ kind: "signin" }), deps);

    expect(outcome.status).toBe("applied");
    expect(outcome.destination).toBe("/");
    expect(readPublicRoadmap).not.toHaveBeenCalled();
  });

  it("revalidates the source, saves the copy, and opens the private workspace", async () => {
    const { deps, readPublicRoadmap, performSaveRoadmapCopy } = makeDeps();
    const outcome = await resumePendingIntent(
      intent({ kind: "save", ...SNAPSHOT, title: "Python Backend Engineering" }),
      deps,
    );

    expect(readPublicRoadmap).toHaveBeenCalledWith("python-backend");
    expect(performSaveRoadmapCopy).toHaveBeenCalledTimes(1);
    const [input] = performSaveRoadmapCopy.mock.calls[0];
    expect(input).toMatchObject({
      templateId: "tmpl-python",
      snapshotVersion: "2026-10-15.1",
      title: "Python Backend Engineering",
      publicTopicId: null,
    });
    expect(outcome.status).toBe("applied");
    expect(outcome.destination).toBe("/w/ws_new");
    expect(outcome.privateTopicId).toBeNull();
    expect(deps.announceLearningCollectionChanged).toHaveBeenCalledTimes(1);
    expect(deps.saveReadingPosition).not.toHaveBeenCalled();
  });

  it("maps the copied topic and restores the guest reading position", async () => {
    const { deps, performSaveRoadmapCopy } = makeDeps();
    const outcome = await resumePendingIntent(
      intent({
        kind: "signin",
        ...SNAPSHOT,
        topicSlug: "async-basics",
        topicId: "pub_topic_async",
        readingRatio: 0.42,
      }),
      deps,
    );

    expect(performSaveRoadmapCopy).toHaveBeenCalledWith(
      expect.objectContaining({ publicTopicId: "pub_topic_async" }),
      expect.anything(),
    );
    expect(outcome.privateTopicId).toBe("item_async");
    expect(outcome.destination).toBe("/w/ws_new");
    expect(deps.saveReadingPosition).toHaveBeenCalledWith("ws_new", "item_async", {
      scrollRatio: 0.42,
      scrollY: 0,
    });
  });

  it("skips a stale snapshot without writing", async () => {
    const { deps, performSaveRoadmapCopy } = makeDeps();
    const outcome = await resumePendingIntent(
      intent({ kind: "signin", ...SNAPSHOT, snapshotVersion: "2026-10-14.0", topicId: "pub_topic_async" }),
      deps,
    );

    expect(outcome.status).toBe("skipped");
    expect(outcome.destination).toBe("/learn/python-backend");
    expect(performSaveRoadmapCopy).not.toHaveBeenCalled();
    expect(deps.announceLearningCollectionChanged).not.toHaveBeenCalled();
  });

  it("rejects a forged template identity instead of trusting the payload", async () => {
    const { deps, performSaveRoadmapCopy } = makeDeps();
    const outcome = await resumePendingIntent(
      intent({ kind: "save", ...SNAPSHOT, templateId: "tmpl-evil" }),
      deps,
    );

    expect(outcome.status).toBe("skipped");
    expect(performSaveRoadmapCopy).not.toHaveBeenCalled();
  });

  it("skips when the published roadmap is unavailable", async () => {
    const readPublicRoadmap = vi.fn().mockRejectedValue(new Error("404"));
    const { deps, performSaveRoadmapCopy } = makeDeps({ readPublicRoadmap });
    const outcome = await resumePendingIntent(intent({ kind: "save", ...SNAPSHOT }), deps);

    expect(outcome.status).toBe("skipped");
    expect(outcome.destination).toBe("/learn");
    expect(performSaveRoadmapCopy).not.toHaveBeenCalled();
  });

  it("skips a topic intent whose topic is no longer published", async () => {
    const { deps, performSaveRoadmapCopy } = makeDeps();
    const outcome = await resumePendingIntent(
      intent({
        kind: "complete",
        ...SNAPSHOT,
        topicSlug: "gone",
        topicId: "pub_topic_gone",
      }),
      deps,
    );

    expect(outcome.status).toBe("skipped");
    expect(outcome.destination).toBe("/learn/python-backend");
    expect(performSaveRoadmapCopy).not.toHaveBeenCalled();
  });

  it("carries a tutor quote through resume without sending it", async () => {
    const { deps, performSaveRoadmapCopy } = makeDeps();
    const outcome = await resumePendingIntent(
      intent({
        kind: "tutor",
        ...SNAPSHOT,
        topicSlug: "async-basics",
        topicId: "pub_topic_async",
        quote: "the event loop never blocks",
      }),
      deps,
    );

    expect(outcome.status).toBe("applied");
    expect(outcome.quote).toBe("the event loop never blocks");
    // Only the idempotent save-copy write happened; nothing auto-sent.
    expect(performSaveRoadmapCopy).toHaveBeenCalledTimes(1);
  });

  it("resumes a practice intent without auto-submitting an answer", async () => {
    const { deps, performSaveRoadmapCopy } = makeDeps();
    const outcome = await resumePendingIntent(
      intent({
        kind: "practice",
        ...SNAPSHOT,
        topicSlug: "async-basics",
        topicId: "pub_topic_async",
      }),
      deps,
    );

    expect(outcome.status).toBe("applied");
    expect(outcome.quote).toBeNull();
    // Exactly one write (save-copy); no attempt/answer call is made.
    expect(performSaveRoadmapCopy).toHaveBeenCalledTimes(1);
  });

  it("fails honestly when the save cannot complete", async () => {
    const performSaveRoadmapCopy = vi.fn().mockRejectedValue(new Error("boom"));
    const { deps } = makeDeps({
      performSaveRoadmapCopy: performSaveRoadmapCopy as unknown as ResumeDeps["performSaveRoadmapCopy"],
    });
    const outcome = await resumePendingIntent(intent({ kind: "save", ...SNAPSHOT }), deps);

    expect(outcome.status).toBe("failed");
    expect(outcome.destination).toBe("/learn/python-backend");
    expect(deps.announceLearningCollectionChanged).not.toHaveBeenCalled();
  });
});
