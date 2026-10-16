import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useSaveRoadmapCopy } from "../useSaveRoadmapCopy";
import {
  subscribeLearningCollectionChanged,
  type EnrollmentDetail,
} from "@/lib/enrollmentApi";

afterEach(() => vi.unstubAllGlobals());

type Init = RequestInit & { headers?: Record<string, string> };

const ok = (status: number, body: unknown) => ({
  ok: status < 400,
  status,
  json: async () => body,
});

const enrollment = (overrides: Partial<EnrollmentDetail> = {}): EnrollmentDetail => ({
  roadmapId: "rm_1",
  workspaceId: "ws_new",
  revisionId: "rev_1",
  sourceSnapshotRef: "tmpl-python:2026-10-15.1",
  title: "Python Backend",
  createdAt: "2026-10-16T00:00:00Z",
  updatedAt: "2026-10-16T00:00:00Z",
  topicProgress: {},
  topicMap: [{ publicTopicId: "pub_topic_async", privateTopicId: "item_async" }],
  ...overrides,
});

const workspace = (id: string, ref?: string) => ({
  id,
  name: "Python Backend",
  viewportX: 0,
  viewportY: 0,
  zoom: 1,
  nodeCount: 0,
  createdAt: "2026-10-16T00:00:00Z",
  updatedAt: "2026-10-16T00:00:00Z",
  curriculum: ref
    ? {
        roadmapId: "rm_1",
        title: "Python Backend",
        status: "active",
        totalTopics: 1,
        completedTopics: 0,
        progressPercent: 0,
        sourceSnapshotRef: ref,
      }
    : null,
});

const input = {
  templateId: "tmpl-python",
  snapshotVersion: "2026-10-15.1",
  title: "Python Backend",
  publicTopicId: "pub_topic_async",
};

describe("useSaveRoadmapCopy (LSI-031)", () => {
  it("creates a workspace, saves the copy, and maps the topic", async () => {
    const keys: string[] = [];
    const creates: string[] = [];
    const fetcher = vi.fn(async (url: string, init: Init = {}) => {
      const method = (init.method ?? "GET").toUpperCase();
      if (url.startsWith("/api/v1/workspaces?")) {
        return ok(200, { workspaces: [], total: 0 });
      }
      if (url === "/api/v1/workspaces" && method === "POST") {
        creates.push(url);
        return ok(201, workspace("ws_new"));
      }
      if (url === "/api/v1/workspaces/ws_new/learning-roadmaps") {
        keys.push(init.headers?.["Idempotency-Key"] as string);
        return ok(201, enrollment());
      }
      throw new Error(`unexpected ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetcher);

    const listener = vi.fn();
    subscribeLearningCollectionChanged(listener);
    const { result } = renderHook(() => useSaveRoadmapCopy());

    await act(async () => {
      await result.current.save(input);
    });

    expect(result.current.enrollment?.roadmapId).toBe("rm_1");
    expect(result.current.status).toBe("saved");
    expect(result.current.created).toBe(true);
    expect(result.current.privateTopicId).toBe("item_async");
    expect(creates).toHaveLength(1);
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("reuses the workspace that already hosts the snapshot", async () => {
    const saves: string[] = [];
    const createCalls: number[] = [];
    const fetcher = vi.fn(async (url: string, init: Init = {}) => {
      const method = (init.method ?? "GET").toUpperCase();
      if (url.startsWith("/api/v1/workspaces?")) {
        return ok(200, {
          workspaces: [workspace("ws_host", "tmpl-python:2026-10-15.1")],
          total: 1,
        });
      }
      if (url === "/api/v1/workspaces" && method === "POST") {
        createCalls.push(1);
        return ok(201, workspace("ws_should_not_be_used"));
      }
      if (url === "/api/v1/workspaces/ws_host/learning-roadmaps") {
        saves.push(url);
        return ok(200, enrollment({ workspaceId: "ws_host" }));
      }
      throw new Error(`unexpected ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetcher);

    const { result } = renderHook(() => useSaveRoadmapCopy());
    await act(async () => {
      await result.current.save(input);
    });

    expect(result.current.status).toBe("saved");
    expect(result.current.created).toBe(false);
    expect(result.current.enrollment?.workspaceId).toBe("ws_host");
    expect(createCalls).toHaveLength(0);
    expect(saves).toHaveLength(1);
  });

  it("collapses a duplicate click into one in-flight save", async () => {
    let saveCalls = 0;
    let releaseSave!: (value: unknown) => void;
    const saveResponse = new Promise((resolve) => {
      releaseSave = resolve;
    });
    const fetcher = vi.fn(async (url: string, init: Init = {}) => {
      const method = (init.method ?? "GET").toUpperCase();
      if (url.startsWith("/api/v1/workspaces?")) {
        return ok(200, { workspaces: [], total: 0 });
      }
      if (url === "/api/v1/workspaces" && method === "POST") {
        return ok(201, workspace("ws_new"));
      }
      if (url === "/api/v1/workspaces/ws_new/learning-roadmaps") {
        saveCalls += 1;
        return saveResponse;
      }
      throw new Error(`unexpected ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetcher);

    const { result } = renderHook(() => useSaveRoadmapCopy());
    let first!: Promise<EnrollmentDetail | null>;
    let second!: Promise<EnrollmentDetail | null>;
    await act(async () => {
      first = result.current.save(input);
      second = result.current.save(input);
    });

    expect(second).toBe(first);
    // Only one POST reached the server while the save was pending.
    await waitFor(() => expect(saveCalls).toBe(1));

    await act(async () => {
      releaseSave(ok(201, enrollment()));
      await first;
    });
    expect(result.current.status).toBe("saved");
    expect(saveCalls).toBe(1);
  });

  it("retries with the same idempotency key and no extra workspace", async () => {
    const keys: string[] = [];
    const createCalls: number[] = [];
    let attempt = 0;
    const fetcher = vi.fn(async (url: string, init: Init = {}) => {
      const method = (init.method ?? "GET").toUpperCase();
      if (url.startsWith("/api/v1/workspaces?")) {
        return ok(200, { workspaces: [], total: 0 });
      }
      if (url === "/api/v1/workspaces" && method === "POST") {
        createCalls.push(1);
        return ok(201, workspace("ws_new"));
      }
      if (url === "/api/v1/workspaces/ws_new/learning-roadmaps") {
        keys.push(init.headers?.["Idempotency-Key"] as string);
        attempt += 1;
        return attempt === 1
          ? ok(500, { detail: "Save failed" })
          : ok(201, enrollment());
      }
      throw new Error(`unexpected ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetcher);

    const { result } = renderHook(() => useSaveRoadmapCopy());
    await act(async () => {
      await result.current.save(input);
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("Save failed");

    await act(async () => {
      await result.current.retry();
    });

    expect(result.current.status).toBe("saved");
    expect(result.current.created).toBe(true);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(createCalls).toHaveLength(1);
  });

  it("fails safely when the collection cannot be listed", async () => {
    const posts: string[] = [];
    const fetcher = vi.fn(async (url: string, init: Init = {}) => {
      const method = (init.method ?? "GET").toUpperCase();
      if (url.startsWith("/api/v1/workspaces?")) {
        return ok(500, { detail: "Collection unavailable" });
      }
      posts.push(`${method} ${url}`);
      return ok(201, workspace("ws_new"));
    });
    vi.stubGlobal("fetch", fetcher);

    const { result } = renderHook(() => useSaveRoadmapCopy());
    await act(async () => {
      await result.current.save(input);
    });

    expect(result.current.status).toBe("error");
    // No workspace was created and no copy was written on an unreadable list.
    expect(posts).toHaveLength(0);
  });
});
