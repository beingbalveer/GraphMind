import { afterEach, expect, it, vi } from "vitest";
import { readPublicLesson, readPublicRoadmap } from "../publicSnapshotApi";

afterEach(() => vi.unstubAllGlobals());

const response = (status: number, body: unknown) => ({
  ok: status < 400,
  status,
  json: async () => body,
});

it("reads a published roadmap by its stable public slug", async () => {
  const fetcher = vi.fn().mockResolvedValue(response(200, { id: "tmpl-1" }));
  vi.stubGlobal("fetch", fetcher);

  await readPublicRoadmap("python backend");

  const [url, init] = fetcher.mock.calls[0];
  expect(url).toBe("/api/v1/public/roadmaps/python%20backend");
  expect(init.credentials).toBe("include");
  // Guests carry no private credential to a public snapshot read.
  expect(init.headers.Authorization).toBeUndefined();
});

it("reads a lesson by slug and topic reference", async () => {
  const fetcher = vi.fn().mockResolvedValue(response(200, { topicId: "pub_topic_1" }));
  vi.stubGlobal("fetch", fetcher);

  await readPublicLesson("python-backend", "async intro");

  expect(fetcher.mock.calls[0][0]).toBe(
    "/api/v1/public/roadmaps/python-backend/topics/async%20intro",
  );
});

it("turns any unavailable content into a neutral typed 404", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      response(404, { error: { code: "NOT_FOUND", message: "This content is not available." } }),
    ),
  );

  await expect(readPublicRoadmap("withdrawn")).rejects.toMatchObject({
    status: 404,
    detail: "This content is not available.",
  });
  await expect(readPublicLesson("withdrawn", "topic")).rejects.toMatchObject({
    status: 404,
  });
});
