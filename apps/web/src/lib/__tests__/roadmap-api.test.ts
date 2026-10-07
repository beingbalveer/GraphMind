import { afterEach, expect, it, vi } from "vitest";
import { createRoadmapJob, attachRoadmapFile, readRoadmapJob } from "../roadmapApi";
import { ApiError } from "../apiClient";

afterEach(() => vi.unstubAllGlobals());
const response = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });

it("retains the same idempotency key through silent refresh", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(response(401, {}))
    .mockResolvedValueOnce(response(200, {})).mockResolvedValueOnce(response(202, { id: "job" }));
  vi.stubGlobal("fetch", fetcher);
  await createRoadmapJob({ prompt: "Learn drawing" }, "fixed-key");
  expect(fetcher.mock.calls[0][1].headers["Idempotency-Key"]).toBe("fixed-key");
  expect(fetcher.mock.calls[2][1].headers["Idempotency-Key"]).toBe("fixed-key");
});

it("uploads files without forcing a JSON content type", async () => {
  const fetcher = vi.fn().mockResolvedValue(response(201, { id: "ref" }));
  vi.stubGlobal("fetch", fetcher);
  await attachRoadmapFile("job/a", new File(["notes"], "notes.txt"));
  expect(fetcher.mock.calls[0][0]).toBe("/api/v1/roadmap/jobs/job%2Fa/references");
  expect(fetcher.mock.calls[0][1].body).toBeInstanceOf(FormData);
  expect(fetcher.mock.calls[0][1].headers["Content-Type"]).toBeUndefined();
});

it("preserves typed error guidance without empty fallback data", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(409, { error: {
    code: "ACTIVE_JOB_EXISTS", message: "Finish current run", recoverable: true, nextAction: "retry" } })));
  await expect(readRoadmapJob("job")).rejects.toMatchObject({ status: 409,
    detail: "Finish current run", code: "ACTIVE_JOB_EXISTS", recoverable: true, nextAction: "retry" });
});

it("preserves stable errors after authenticated replay", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response(401, {}))
    .mockResolvedValueOnce(response(200, {})).mockResolvedValueOnce(response(404, { error: {
      code: "JOB_NOT_FOUND", message: "Job missing", recoverable: false, nextAction: "new_run" } })));
  try { await readRoadmapJob("missing"); } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: "JOB_NOT_FOUND", nextAction: "new_run" });
    return;
  }
  throw new Error("Expected typed failure");
});
