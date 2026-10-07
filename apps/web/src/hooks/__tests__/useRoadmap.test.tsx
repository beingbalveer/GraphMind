import { renderHook, waitFor, act } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/apiClient";
import { curriculumFixture } from "@/components/roadmap/__tests__/fixtures";
import { useRoadmap } from "../useRoadmap";
import { readRoadmap } from "@/lib/roadmapApi";
vi.mock("@/lib/roadmapApi", () => ({ readRoadmap: vi.fn() }));
beforeEach(() => vi.mocked(readRoadmap).mockReset());
it("ordinary workspace absence is distinct from authorization or connection failures", async () => {
  vi.mocked(readRoadmap).mockRejectedValueOnce(
    new ApiError(404, "Absent", { code: "ROADMAP_NOT_FOUND" }),
  );
  const hook = renderHook(() => useRoadmap("ordinary"));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.error).toBeNull();
  expect(hook.result.current.view).toBeNull();
  vi.mocked(readRoadmap).mockRejectedValueOnce(
    new ApiError(401, "Please log in"),
  );
  await act(async () => hook.result.current.refresh());
  expect(hook.result.current.error?.status).toBe(401);
});
it("aborts the previous workspace read and never exposes its late curriculum", async () => {
  let finish!: (view: ReturnType<typeof curriculumFixture>) => void;
  vi.mocked(readRoadmap)
    .mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)))
    .mockResolvedValueOnce({ ...curriculumFixture(), workspaceId: "other" });
  const hook = renderHook(({ id }) => useRoadmap(id), {
    initialProps: { id: "ws" },
  });
  const signal = vi.mocked(readRoadmap).mock.calls[0][1];
  hook.rerender({ id: "other" });
  await waitFor(() =>
    expect(hook.result.current.view?.workspaceId).toBe("other"),
  );
  await act(async () => finish(curriculumFixture()));
  expect(hook.result.current.view?.workspaceId).toBe("other");
  expect(signal?.aborted).toBe(true);
});
it("does no request when the operator flag passes no workspace", () => {
  const hook = renderHook(() => useRoadmap(null));
  expect(readRoadmap).not.toHaveBeenCalled();
  expect(hook.result.current.loading).toBe(false);
});
