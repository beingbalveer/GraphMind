import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { shouldOpenCompletedRoadmap, useRoadmapJob } from "../useRoadmapJob";
import * as api from "@/lib/roadmapApi";
vi.mock("@/lib/roadmapApi", () => ({
  readRoadmapJob: vi.fn(),
  answerRoadmapQuestion: vi.fn(),
  cancelRoadmapJob: vi.fn(),
  retryRoadmapJob: vi.fn(),
}));
class Source {
  static instances: Source[] = [];
  listeners: Record<string, EventListener> = {};
  close = vi.fn();
  onerror?: () => void;
  onopen?: () => void;
  constructor(public url: string) {
    Source.instances.push(this);
  }
  addEventListener(name: string, callback: EventListener) {
    this.listeners[name] = callback;
  }
  emit(sequence: number) {
    this.listeners.activity(
      new MessageEvent("activity", {
        data: JSON.stringify({
          sequence,
          stage: "research",
          type: "tool_completed",
          summary: "Inspected source",
          metadata: {},
          createdAt: "now",
        }),
      }),
    );
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  Source.instances = [];
});
it("navigates only while watching the same job in the original route", () => {
  const input = {
    watchingJobId: "j",
    completedJobId: "j",
    isProgressOpen: true,
    currentPath: "/",
    startPath: "/",
  };
  expect(shouldOpenCompletedRoadmap(input)).toBe(true);
  expect(shouldOpenCompletedRoadmap({ ...input, isProgressOpen: false })).toBe(
    false,
  );
  expect(
    shouldOpenCompletedRoadmap({ ...input, currentPath: "/w/other" }),
  ).toBe(false);
});
it("deduplicates reordered events and closes without canceling on unmount", async () => {
  vi.stubGlobal("EventSource", Source);
  vi.mocked(api.readRoadmapJob).mockResolvedValue({
    id: "j",
    status: "running",
    lastSequence: 3,
  } as never);
  const { result, unmount } = renderHook(() => useRoadmapJob("j"));
  await waitFor(() => expect(result.current.job?.id).toBe("j"));
  act(() => {
    Source.instances[0].emit(3);
    Source.instances[0].emit(1);
    Source.instances[0].emit(3);
  });
  expect(result.current.events.map((e) => e.sequence)).toEqual([1, 3]);
  unmount();
  expect(Source.instances[0].close).toHaveBeenCalled();
  expect(api.cancelRoadmapJob).not.toHaveBeenCalled();
});

it("reconnects after the contiguous cursor so reordered gaps are replayed", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("EventSource", Source);
  vi.mocked(api.readRoadmapJob).mockResolvedValue({
    id: "j",
    status: "running",
    lastSequence: 3,
  } as never);
  const { unmount } = renderHook(() => useRoadmapJob("j"));
  await act(async () => {
    await Promise.resolve();
  });
  act(() => {
    Source.instances[0].emit(3);
    Source.instances[0].emit(1);
    Source.instances[0].onerror?.();
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });
  expect(Source.instances.at(-1)?.url).toContain("after=1");
  unmount();
  vi.useRealTimers();
});

it("reopens the stream after retrying a terminal job", async () => {
  vi.stubGlobal("EventSource", Source);
  vi.mocked(api.readRoadmapJob).mockResolvedValue({
    id: "j",
    status: "failed",
    lastSequence: 2,
  } as never);
  vi.mocked(api.retryRoadmapJob).mockResolvedValue({
    id: "j",
    status: "queued",
    lastSequence: 3,
  } as never);
  const { result, unmount } = renderHook(() => useRoadmapJob("j"));
  await waitFor(() => expect(result.current.job?.status).toBe("failed"));
  vi.mocked(api.readRoadmapJob).mockResolvedValue({
    id: "j",
    status: "queued",
    lastSequence: 3,
  } as never);
  await act(async () => {
    await result.current.retry();
  });
  expect(Source.instances.length).toBe(2);
  unmount();
});

it("does not let a stale terminal read close a resumed stream", async () => {
  vi.stubGlobal("EventSource", Source);
  vi.mocked(api.readRoadmapJob).mockResolvedValue({
    id: "j",
    status: "failed",
    lastSequence: 2,
  } as never);
  vi.mocked(api.retryRoadmapJob).mockResolvedValue({
    id: "j",
    status: "queued",
    lastSequence: 3,
  } as never);
  const { result, unmount } = renderHook(() => useRoadmapJob("j"));
  await waitFor(() => expect(result.current.job?.status).toBe("failed"));
  await act(async () => {
    await result.current.retry();
  });
  expect(result.current.job?.status).toBe("queued");
  expect(Source.instances.at(-1)?.close).not.toHaveBeenCalled();
  unmount();
});

it("backs off to ten seconds when status polling is offline", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("EventSource", Source);
  vi.mocked(api.readRoadmapJob).mockRejectedValue(
    new Error("Network unavailable"),
  );
  const { unmount } = renderHook(() => useRoadmapJob("j"));
  await act(async () => {
    await Promise.resolve();
  });
  act(() => Source.instances[0].onerror?.());
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });
  expect(api.readRoadmapJob).toHaveBeenCalledTimes(1);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(7000);
  });
  expect(api.readRoadmapJob).toHaveBeenCalledTimes(2);
  unmount();
  vi.useRealTimers();
});
