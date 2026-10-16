import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

const mockRouter = vi.hoisted(() => ({ push: vi.fn() }));
const mockAuth = vi.hoisted(() => ({
  value: { isAuthenticated: false, isLoading: false },
}));
const mockResume = vi.hoisted(() => ({ fn: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouter.push }),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => mockAuth.value,
}));

vi.mock("@/lib/intentResume", () => ({
  resumePendingIntent: mockResume.fn,
}));

import { AuthIntentResumer } from "../AuthIntentResumer";
import { PENDING_INTENT_STORAGE_KEY, storePendingIntent } from "@/lib/authIntent";

beforeEach(() => {
  window.localStorage.clear();
  mockRouter.push.mockReset();
  mockResume.fn.mockReset().mockResolvedValue({ destination: "/w/ws_new" });
  mockAuth.value = { isAuthenticated: false, isLoading: false };
});

describe("AuthIntentResumer (LSI-032)", () => {
  it("resumes a stored intent once a signed-in learner is present", async () => {
    storePendingIntent({
      kind: "save",
      templateId: "tmpl-python",
      slug: "python-backend",
      snapshotVersion: "2026-10-15.1",
      title: "Python Backend",
    });
    mockAuth.value = { isAuthenticated: true, isLoading: false };

    render(<AuthIntentResumer />);

    await waitFor(() => expect(mockResume.fn).toHaveBeenCalledTimes(1));
    expect(mockResume.fn.mock.calls[0][0]).toMatchObject({
      kind: "save",
      slug: "python-backend",
    });
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith("/w/ws_new"));
    // Consumed exactly once: nothing is left to replay.
    expect(window.localStorage.getItem(PENDING_INTENT_STORAGE_KEY)).toBeNull();
  });

  it("does nothing while the visitor is not authenticated", async () => {
    storePendingIntent({
      kind: "signin",
      templateId: "tmpl-python",
      slug: "python-backend",
      snapshotVersion: "2026-10-15.1",
      topicId: "pub_topic_async",
      topicSlug: "async-basics",
    });

    render(<AuthIntentResumer />);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockResume.fn).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(PENDING_INTENT_STORAGE_KEY)).not.toBeNull();
  });

  it("is safe against a duplicate auth callback", async () => {
    storePendingIntent({
      kind: "save",
      templateId: "tmpl-python",
      slug: "python-backend",
      snapshotVersion: "2026-10-15.1",
    });
    mockAuth.value = { isAuthenticated: true, isLoading: false };

    const { rerender } = render(<AuthIntentResumer />);
    await waitFor(() => expect(mockResume.fn).toHaveBeenCalledTimes(1));
    rerender(<AuthIntentResumer />);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockResume.fn).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
  });
});
