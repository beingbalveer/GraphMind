import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";
import { useTopicProgress } from "../useTopicProgress";
import { StudioLessonReader } from "../StudioLessonReader";
import * as roadmapApi from "@/lib/roadmapApi";
import type { CurriculumItemData, TopicProgressData } from "@/lib/roadmapTypes";

describe("useTopicProgress hook", () => {
  const initialProgress: Record<string, TopicProgressData> = {
    t1: { topicId: "t1", status: "completed", completedAt: "2026-10-15T08:00:00Z" },
    t2: { topicId: "t2", status: "in_progress", completedAt: null },
    t3: { topicId: "t3", status: "not_started", completedAt: null },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calculates authoritative completed counts and percentages", () => {
    const { result } = renderHook(() =>
      useTopicProgress({
        workspaceId: "ws_1",
        initialProgress,
      })
    );

    expect(result.current.completedCount).toBe(1);
    expect(result.current.completedTopicIds).toEqual(["t1"]);
    expect(result.current.isCompleted("t1")).toBe(true);
    expect(result.current.isCompleted("t2")).toBe(false);
    expect(result.current.calculateProgressPercent(4)).toBe(25);
  });

  it("optimistically completes topic and saves authoritative server response", async () => {
    const mockServerResponse: TopicProgressData = {
      topicId: "t2",
      status: "completed",
      completedAt: "2026-10-15T10:00:00Z",
    };
    vi.spyOn(roadmapApi, "setTopicProgress").mockResolvedValueOnce(mockServerResponse);

    const onProgressChange = vi.fn();
    const { result } = renderHook(() =>
      useTopicProgress({
        workspaceId: "ws_1",
        initialProgress,
        onProgressChange,
      })
    );

    let promise: Promise<TopicProgressData | null>;
    act(() => {
      promise = result.current.toggleTopicProgress("t2");
    });

    // Optimistic completion in state
    expect(result.current.isCompleted("t2")).toBe(true);

    await act(async () => {
      await promise;
    });

    expect(roadmapApi.setTopicProgress).toHaveBeenCalledWith("ws_1", "t2", "completed");
    expect(result.current.isCompleted("t2")).toBe(true);
    expect(result.current.completedCount).toBe(2);
    expect(onProgressChange).toHaveBeenCalledWith("t2", mockServerResponse);
  });

  it("discards stale responses when rapid clicks fire multiple intents for the same topic", async () => {
    let resolveFirst: (val: TopicProgressData) => void = () => {};
    let resolveSecond: (val: TopicProgressData) => void = () => {};

    const firstPromise = new Promise<TopicProgressData>((res) => {
      resolveFirst = res;
    });
    const secondPromise = new Promise<TopicProgressData>((res) => {
      resolveSecond = res;
    });

    vi.spyOn(roadmapApi, "setTopicProgress")
      .mockReturnValueOnce(firstPromise)
      .mockReturnValueOnce(secondPromise);

    const { result } = renderHook(() =>
      useTopicProgress({
        workspaceId: "ws_1",
        initialProgress,
      })
    );

    // User marks t2 completed
    act(() => {
      result.current.toggleTopicProgress("t2");
    });
    expect(result.current.isCompleted("t2")).toBe(true);

    // User rapidly clicks again to revert t2 to in_progress
    act(() => {
      result.current.toggleTopicProgress("t2");
    });
    expect(result.current.isCompleted("t2")).toBe(false);

    // First request finishes late with status="completed"
    await act(async () => {
      resolveFirst({
        topicId: "t2",
        status: "completed",
        completedAt: "2026-10-15T10:00:00Z",
      });
    });

    // The stale completed response must NOT overwrite the newer in_progress intent!
    expect(result.current.isCompleted("t2")).toBe(false);

    // Second request finishes with status="in_progress"
    await act(async () => {
      resolveSecond({
        topicId: "t2",
        status: "in_progress",
        completedAt: null,
      });
    });

    expect(result.current.isCompleted("t2")).toBe(false);
  });

  it("handles failure with error state and optimistic revert", async () => {
    vi.spyOn(roadmapApi, "setTopicProgress").mockRejectedValueOnce(
      new Error("Network connection dropped")
    );

    const { result } = renderHook(() =>
      useTopicProgress({
        workspaceId: "ws_1",
        initialProgress,
      })
    );

    await act(async () => {
      await result.current.toggleTopicProgress("t2");
    });

    // Reverted back to not completed
    expect(result.current.isCompleted("t2")).toBe(false);
    expect(result.current.error).toEqual({
      topicId: "t2",
      message: "Network connection dropped",
      targetStatus: "completed",
    });

    // Retry invokes API again
    vi.spyOn(roadmapApi, "setTopicProgress").mockResolvedValueOnce({
      topicId: "t2",
      status: "completed",
      completedAt: "2026-10-15T10:01:00Z",
    });

    await act(async () => {
      await result.current.retry("t2");
    });

    expect(result.current.isCompleted("t2")).toBe(true);
    expect(result.current.error).toBeNull();
  });
});

describe("StudioLessonReader completion UI", () => {
  const mockTopic: CurriculumItemData = {
    id: "topic_1",
    kind: "topic",
    title: "Understanding Python Event Loops",
    brief: "Detailed guide to asynchronous I/O and task cooperative scheduling.",
    objectives: ["Explain non-blocking event loops"],
    exercise: "Write a test routine.",
    format: "concepts",
    order: 1,
    path: "core",
    estimateMinutes: 30,
    participation: "active",
  };

  it("displays pending saving state on completion action and never calls it mastery", () => {
    render(
      <StudioLessonReader
        workspaceId="ws_1"
        topic={mockTopic}
        isCompleted={false}
        isPending={true}
      />
    );

    const btn = screen.getByRole("button", { name: "Updating..." });
    expect(btn).toBeDisabled();

    // Verify "mastery" is nowhere in the document
    expect(screen.queryByText(/master/i)).not.toBeInTheDocument();
  });

  it("displays error alert and triggers retry handler", () => {
    const onRetry = vi.fn();
    render(
      <StudioLessonReader
        workspaceId="ws_1"
        topic={mockTopic}
        isCompleted={false}
        error="Server connection timeout while saving progress"
        onRetry={onRetry}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Server connection timeout while saving progress"
    );

    const retryBtn = screen.getByRole("button", { name: "Retry" });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("renders completion checkmark when isCompleted is true and allows toggling", () => {
    const onToggleComplete = vi.fn();
    render(
      <StudioLessonReader
        workspaceId="ws_1"
        topic={mockTopic}
        isCompleted={true}
        onToggleComplete={onToggleComplete}
      />
    );

    const completeBtn = screen.getByRole("button", { name: /Completed/ });
    expect(completeBtn).toBeInTheDocument();
    fireEvent.click(completeBtn);
    expect(onToggleComplete).toHaveBeenCalledOnce();
  });
});
