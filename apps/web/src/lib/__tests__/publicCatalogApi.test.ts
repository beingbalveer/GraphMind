import { afterEach, expect, it, vi } from "vitest";
import {
  buildPublicCatalogQuery,
  isPublicRoadmapLevel,
  listPublicRoadmaps,
} from "../publicCatalogApi";
import { ApiError } from "../apiClient";

afterEach(() => vi.unstubAllGlobals());

const response = (status: number, body: unknown) => ({
  ok: status < 400,
  status,
  json: async () => body,
});

it("omits blank filters and keeps the query deterministic", () => {
  expect(buildPublicCatalogQuery()).toBe("");
  expect(buildPublicCatalogQuery({ query: "   ", category: "" })).toBe("");
  expect(buildPublicCatalogQuery({ level: "beginner", limit: 12, offset: 0 })).toBe(
    "?level=beginner&limit=12&offset=0",
  );
});

it("url-encodes search and category values", () => {
  expect(
    buildPublicCatalogQuery({ query: "async & await", category: "back end" }),
  ).toBe("?query=async+%26+await&category=back+end");
});

it("requires anonymous access to the public catalog endpoint", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    response(200, { items: [], total: 0, limit: 20, offset: 0 }),
  );
  vi.stubGlobal("fetch", fetcher);

  await listPublicRoadmaps({ query: "drawing", level: "beginner", limit: 20, offset: 20 });

  const [url, init] = fetcher.mock.calls[0];
  expect(url).toBe(
    "/api/v1/public/roadmaps?query=drawing&level=beginner&limit=20&offset=20",
  );
  expect(init.method ?? "GET").toBe("GET");
  expect(init.credentials).toBe("include");
  // No private identity may travel with a public catalog read.
  expect(init.headers.Authorization).toBeUndefined();
});

it("surfaces typed catalog errors instead of empty data", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      response(503, {
        error: { code: "CATALOG_UNAVAILABLE", message: "Try later", recoverable: true },
      }),
    ),
  );

  await expect(listPublicRoadmaps()).rejects.toMatchObject({
    status: 503,
    detail: "Try later",
    code: "CATALOG_UNAVAILABLE",
  });
  await expect(listPublicRoadmaps()).rejects.toBeInstanceOf(ApiError);
});

it("validates catalog level values", () => {
  expect(isPublicRoadmapLevel("beginner")).toBe(true);
  expect(isPublicRoadmapLevel("advanced")).toBe(true);
  expect(isPublicRoadmapLevel("expert")).toBe(false);
  expect(isPublicRoadmapLevel(null)).toBe(false);
});
