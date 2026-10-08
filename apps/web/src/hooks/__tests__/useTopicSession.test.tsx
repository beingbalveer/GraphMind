import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { readTopicSession } from "@/lib/roadmapApi";
import { useTopicSession } from "../useTopicSession";
import type { TopicSessionData } from "@/lib/roadmapTypes";
vi.mock("@/lib/roadmapApi", () => ({ readTopicSession: vi.fn() }));
const session = (
  id: string,
  state: TopicSessionData["lessonStartState"],
): TopicSessionData => ({
  id,
  chatId: id,
  topicId: "topic",
  revisionId: "rev",
  isNew: false,
  lessonStartState: state,
  archived: false,
});
afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});
it("ignores an old response after switching lessons", async () => {
  let resolve!: (value: TopicSessionData) => void;
  let signal!: AbortSignal;
  vi.mocked(readTopicSession)
    .mockImplementationOnce((_workspace, _id, abort) => {
      signal = abort!;
      return new Promise((done) => {
        resolve = done;
      });
    })
    .mockResolvedValue(session("new", "completed"));
  const hook = renderHook(({ id }) => useTopicSession("ws", id), {
    initialProps: { id: "old" },
  });
  hook.rerender({ id: "new" });
  await waitFor(() => expect(hook.result.current.session?.id).toBe("new"));
  expect(signal.aborted).toBe(true);
  await act(async () => resolve(session("old", "pending")));
  expect(hook.result.current.session?.id).toBe("new");
});
it("polls another tab's initial lesson and stops once it is saved", async () => {
  vi.useFakeTimers();
  vi.mocked(readTopicSession)
    .mockResolvedValueOnce(session("lesson", "started"))
    .mockResolvedValue(session("lesson", "completed"));
  const hook = renderHook(() => useTopicSession("ws", "lesson"));
  await act(async () => {});
  expect(hook.result.current.session?.lessonStartState).toBe("started");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(hook.result.current.session?.lessonStartState).toBe("completed");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(15000);
  });
  expect(readTopicSession).toHaveBeenCalledTimes(2);
  act(() => window.dispatchEvent(new Event("focus")));
  await act(async () => {});
  expect(readTopicSession).toHaveBeenCalledTimes(3);
});
