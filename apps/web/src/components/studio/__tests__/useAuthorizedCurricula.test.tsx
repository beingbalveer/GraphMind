import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useAuthorizedCurricula } from "../useAuthorizedCurricula";
import { announceLearningCollectionChanged } from "@/lib/enrollmentApi";

afterEach(() => vi.unstubAllGlobals());

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

describe("useAuthorizedCurricula collection refresh (LSI-031)", () => {
  it("refetches the collection when a save announces a change", async () => {
    const fetcher = vi.fn(async (_url: string) =>
      ok({ workspaces: [], total: 0 }),
    );
    vi.stubGlobal("fetch", fetcher);

    renderHook(() => useAuthorizedCurricula());
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    act(() => announceLearningCollectionChanged());

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(String(fetcher.mock.calls[1][0])).toContain(
      "/api/v1/workspaces?limit=50",
    );
  });
});
