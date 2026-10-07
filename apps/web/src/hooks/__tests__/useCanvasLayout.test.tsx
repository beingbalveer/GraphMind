import { act, renderHook, waitFor } from "@testing-library/react";
import { vi, it, expect, beforeEach } from "vitest";
import { readCanvasLayout, writeCanvasLayout } from "@/lib/canvasApi";
import { ApiError } from "@/lib/apiClient";
import { useCanvasLayout } from "@/hooks/useCanvasLayout";
import type { CanvasLayout } from "@/lib/canvas/types";

vi.mock("@/lib/canvasApi", () => ({ readCanvasLayout: vi.fn(), writeCanvasLayout: vi.fn() }));
const next: CanvasLayout = { version: "spine-v1", topologyKey: "a",
  viewport: null, positions: { a: { x: 20, y: 30 } } };
beforeEach(() => {
  vi.mocked(readCanvasLayout).mockReset().mockResolvedValue({ layout: null, revision: 0 });
  vi.mocked(writeCanvasLayout).mockReset();
});

it("keeps the new draft when save fails and retries the same revision", async () => {
  const { result } = renderHook(() => useCanvasLayout("w", "c", "conversation"));
  await waitFor(() => expect(result.current.ready).toBe(true));
  vi.mocked(writeCanvasLayout).mockRejectedValueOnce(new Error("offline"));
  act(() => result.current.setLayout(next));
  await waitFor(() => expect(result.current.saveState).toBe("error"));
  expect(result.current.layout).toEqual(next);
  expect(writeCanvasLayout).toHaveBeenCalledWith("w", "c", "conversation", 0, next);
  vi.mocked(writeCanvasLayout).mockResolvedValueOnce({ layout: next, revision: 1 });
  act(() => result.current.retrySave());
  await waitFor(() => expect(result.current.saveState).toBe("saved"));
});

it("does not save before hydration or after a failed read", async () => {
  vi.mocked(readCanvasLayout).mockRejectedValueOnce(new Error("offline"));
  const { result } = renderHook(() => useCanvasLayout("w", "c", "conversation"));
  act(() => result.current.setLayout(next));
  await waitFor(() => expect(result.current.loadError).toBeTruthy());
  expect(writeCanvasLayout).not.toHaveBeenCalled();
  expect(result.current.ready).toBe(false);
  await act(async () => { await result.current.reload(); });
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.layout).toBeNull();
});

it("keeps a conflicting draft until explicitly reloading the latest layout", async () => {
  const latest = { ...next, positions: { a: { x: 90, y: 80 } } };
  const { result } = renderHook(() => useCanvasLayout("w", "c", "conversation"));
  await waitFor(() => expect(result.current.ready).toBe(true));
  vi.mocked(writeCanvasLayout).mockRejectedValueOnce(new ApiError(409, "changed"));
  vi.mocked(readCanvasLayout).mockResolvedValue({ layout: latest, revision: 2 });
  act(() => result.current.setLayout(next));
  await waitFor(() => expect(result.current.conflict).toBe(true));
  expect(result.current.layout).toEqual(next);
  act(() => result.current.retrySave());
  expect(writeCanvasLayout).toHaveBeenCalledTimes(1);
  await act(async () => { await result.current.reload(); });
  await waitFor(() => expect(result.current.layout).toEqual(latest));
  expect(writeCanvasLayout).toHaveBeenCalledTimes(1);
});

it("serializes saves and uses the acknowledged revision for newer moves", async () => {
  let resolve!: (value: { layout: CanvasLayout; revision: number }) => void;
  vi.mocked(writeCanvasLayout).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  const { result } = renderHook(() => useCanvasLayout("w", "c", "conversation"));
  await waitFor(() => expect(result.current.ready).toBe(true));
  act(() => result.current.setLayout(next));
  await waitFor(() => expect(writeCanvasLayout).toHaveBeenCalledTimes(1));
  const newer = { ...next, viewport: { x: 4, y: 5, zoom: 1 } };
  act(() => result.current.setLayout(newer));
  vi.mocked(writeCanvasLayout).mockResolvedValueOnce({ layout: newer, revision: 2 });
  act(() => resolve({ layout: next, revision: 1 }));
  await waitFor(() => expect(result.current.saveState).toBe("saved"));
  expect(writeCanvasLayout).toHaveBeenLastCalledWith("w", "c", "conversation", 1, newer);
});

it("ignores an older layout format while retaining its write revision", async () => {
  vi.mocked(readCanvasLayout).mockResolvedValueOnce({ layout: { ...next, version: "old" } as unknown as CanvasLayout, revision: 3 });
  vi.mocked(writeCanvasLayout).mockResolvedValueOnce({ layout: next, revision: 4 });
  const { result } = renderHook(() => useCanvasLayout("w", "c", "conversation"));
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.layout).toBeNull();
  act(() => result.current.setLayout(next));
  await waitFor(() => expect(result.current.saveState).toBe("saved"));
  expect(writeCanvasLayout).toHaveBeenCalledWith("w", "c", "conversation", 3, next);
});
