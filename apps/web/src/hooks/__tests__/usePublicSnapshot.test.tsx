import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/apiClient";
import { readPublicLesson, readPublicRoadmap } from "@/lib/publicSnapshotApi";
import { usePublicLesson, usePublicRoadmap } from "@/hooks/usePublicSnapshot";

vi.mock("@/lib/publicSnapshotApi", () => ({
  readPublicRoadmap: vi.fn(),
  readPublicLesson: vi.fn(),
}));

const roadmap = {
  id: "tmpl-1",
  slug: "python-backend",
  title: "Python Backend",
  summary: "…",
  category: "backend",
  level: "intermediate" as const,
  snapshotVersion: "2026-10-15.1",
  outcomes: [],
  prerequisites: [],
  phases: [],
  sources: [],
};

describe("usePublicRoadmap / usePublicLesson (LSI-030)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readPublicRoadmap).mockResolvedValue(roadmap);
  });

  it("loads a published roadmap and exposes it without private state", async () => {
    const { result } = renderHook(() => usePublicRoadmap("python-backend"));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.data).toEqual(roadmap));
    expect(readPublicRoadmap).toHaveBeenCalledWith(
      "python-backend",
      expect.any(AbortSignal),
    );
    expect(result.current.notFound).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("does not fetch without a slug", async () => {
    const { result } = renderHook(() => usePublicRoadmap(""));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(readPublicRoadmap).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });

  it("maps the neutral 404 to an honest not-available state", async () => {
    vi.mocked(readPublicRoadmap).mockRejectedValue(
      new ApiError(404, "This content is not available."),
    );
    const { result } = renderHook(() => usePublicRoadmap("withdrawn"));

    await waitFor(() => expect(result.current.notFound).toBe(true));
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBeNull();
  });

  it("surfaces an actionable error and recovers on retry", async () => {
    vi.mocked(readPublicLesson).mockRejectedValueOnce(new ApiError(500, "boom"));

    const { result } = renderHook(() => usePublicLesson("python-backend", "async"));
    await waitFor(() =>
      expect(result.current.error).toBe(
        "We couldn't load this content. Please try again.",
      ),
    );

    vi.mocked(readPublicLesson).mockResolvedValue({
      templateId: "tmpl-1",
      snapshotVersion: "2026-10-15.1",
      topicId: "pub_topic_1",
      topicSlug: "async",
      title: "Async",
      brief: "",
      objectives: [],
      contentMarkdown: null,
      exercise: null,
      format: null,
      estimateMinutes: null,
      sources: [],
    });
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.data?.topicSlug).toBe("async"));
    expect(result.current.error).toBeNull();
  });
});
