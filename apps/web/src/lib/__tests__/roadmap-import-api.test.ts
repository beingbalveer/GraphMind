import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createRoadmapImports,
  listRoadmapImportFields,
} from "../roadmapImportApi";

afterEach(() => vi.unstubAllGlobals());

const response = (status: number, body: unknown) => ({
  ok: status < 400,
  status,
  json: async () => body,
});

describe("listRoadmapImportFields", () => {
  it("requests the fields endpoint and returns the curated list", async () => {
    const body = [
      { slug: "devops", title: "DevOps Roadmap", url: "https://roadmap.sh/devops", topicCount: 140 },
    ];
    const fetcher = vi.fn().mockResolvedValue(response(200, body));
    vi.stubGlobal("fetch", fetcher);

    const fields = await listRoadmapImportFields();

    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/roadmap/imports/fields",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(fields).toEqual(body);
  });

  it("propagates an ApiError with typed guidance on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response(404, {
          error: { code: "ROADMAP_NOT_FOUND", message: "Missing", recoverable: false },
        }),
      ),
    );
    await expect(listRoadmapImportFields()).rejects.toMatchObject({
      status: 404,
      code: "ROADMAP_NOT_FOUND",
    });
  });
});

describe("createRoadmapImports", () => {
  it("POSTs the selected slugs and returns results", async () => {
    const body = {
      results: [
        {
          slug: "devops",
          title: "DevOps Roadmap",
          status: "created",
          workspaceId: "ws_1",
          roadmapId: "roadmap_1",
          revisionId: "rev_1",
          topicCount: 139,
        },
      ],
      errors: [],
    };
    const fetcher = vi.fn().mockResolvedValue(response(201, body));
    vi.stubGlobal("fetch", fetcher);

    const result = await createRoadmapImports(["devops"]);

    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/roadmap/imports",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
    const init = fetcher.mock.calls[0][1];
    expect(JSON.parse(init.body)).toEqual({ slugs: ["devops"] });
    expect(result.results[0].status).toBe("created");
  });

  it("reports per-slug errors as returned", async () => {
    const body = {
      results: [],
      errors: [{ slug: "nope", error: "UNKNOWN_FIELD" }],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(201, body)));
    const result = await createRoadmapImports(["nope"]);
    expect(result.errors[0]).toEqual({ slug: "nope", error: "UNKNOWN_FIELD" });
  });
});