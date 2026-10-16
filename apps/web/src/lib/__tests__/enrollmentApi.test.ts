import { afterEach, describe, expect, it, vi } from "vitest";
import {
  announceLearningCollectionChanged,
  findSavedWorkspace,
  mapPublicTopicToPrivate,
  saveRoadmapCopy,
  sourceSnapshotRef,
  subscribeLearningCollectionChanged,
  type EnrollmentDetail,
} from "../enrollmentApi";
import type { WorkspaceItem } from "../workspaceApi";

afterEach(() => vi.unstubAllGlobals());

const response = (status: number, body: unknown) => ({
  ok: status < 400,
  status,
  json: async () => body,
});

const workspace = (overrides: Partial<WorkspaceItem>): WorkspaceItem => ({
  id: "ws_1",
  name: "Workspace",
  viewportX: 0,
  viewportY: 0,
  zoom: 1,
  nodeCount: 0,
  createdAt: "2026-10-16T00:00:00Z",
  updatedAt: "2026-10-16T00:00:00Z",
  ...overrides,
});

const enrollment: EnrollmentDetail = {
  roadmapId: "rm_1",
  workspaceId: "ws_1",
  revisionId: "rev_1",
  sourceSnapshotRef: "tmpl-python:2026-10-15.1",
  title: "Python Backend",
  createdAt: "2026-10-16T00:00:00Z",
  updatedAt: "2026-10-16T00:00:00Z",
  topicProgress: {},
  topicMap: [{ publicTopicId: "pub_topic_async", privateTopicId: "item_async" }],
};

describe("enrollmentApi (LSI-031)", () => {
  it("formats the frozen snapshot reference", () => {
    expect(sourceSnapshotRef("tmpl-python", "2026-10-15.1")).toBe(
      "tmpl-python:2026-10-15.1",
    );
  });

  it("finds the workspace already hosting a snapshot, and nothing otherwise", () => {
    const hosting = workspace({
      id: "ws_host",
      curriculum: {
        roadmapId: "rm_1",
        title: "Python",
        status: "active",
        totalTopics: 1,
        completedTopics: 0,
        progressPercent: 0,
        sourceSnapshotRef: "tmpl-python:2026-10-15.1",
      },
    });
    const other = workspace({
      id: "ws_other",
      curriculum: {
        roadmapId: "rm_2",
        title: "Drawing",
        status: "active",
        totalTopics: 1,
        completedTopics: 0,
        progressPercent: 0,
        sourceSnapshotRef: "tmpl-drawing:2026-10-14.1",
      },
    });

    expect(
      findSavedWorkspace([other, hosting], "tmpl-python", "2026-10-15.1")?.id,
    ).toBe("ws_host");
    expect(findSavedWorkspace([other], "tmpl-python", "2026-10-15.1")).toBeNull();
    expect(findSavedWorkspace([other, hosting], "tmpl-python", "2026-10-15.2")).toBeNull();
  });

  it("maps a public topic to its private copy topic", () => {
    expect(mapPublicTopicToPrivate(enrollment, "pub_topic_async")).toBe(
      "item_async",
    );
    expect(mapPublicTopicToPrivate(enrollment, "pub_topic_missing")).toBeNull();
  });

  it("posts an idempotent save with the frozen request contract", async () => {
    const fetcher = vi.fn().mockResolvedValue(response(201, enrollment));
    vi.stubGlobal("fetch", fetcher);

    const detail = await saveRoadmapCopy(
      "ws 1",
      {
        templateId: "tmpl-python",
        snapshotVersion: "2026-10-15.1",
        customTitle: "Python Backend",
      },
      "11111111-1111-4111-8111-111111111111",
    );

    expect(detail.roadmapId).toBe("rm_1");
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("/api/v1/workspaces/ws%201/learning-roadmaps");
    expect(init.method).toBe("POST");
    expect(init.headers["Idempotency-Key"]).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(init.credentials).toBe("include");
    expect(JSON.parse(init.body)).toEqual({
      templateId: "tmpl-python",
      snapshotVersion: "2026-10-15.1",
      customTitle: "Python Backend",
    });
  });

  it("notifies subscribers of a learning-collection change", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLearningCollectionChanged(listener);

    announceLearningCollectionChanged();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    announceLearningCollectionChanged();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
