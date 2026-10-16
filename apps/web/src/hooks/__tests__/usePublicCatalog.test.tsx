import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/apiClient";
import {
  listPublicRoadmaps,
  type PublicRoadmapSummary,
} from "@/lib/publicCatalogApi";
import {
  PUBLIC_CATALOG_PAGE_SIZE,
  usePublicCatalog,
} from "@/hooks/usePublicCatalog";

vi.mock("@/lib/publicCatalogApi", () => ({
  listPublicRoadmaps: vi.fn(),
}));

const makeRoadmap = (
  overrides: Partial<PublicRoadmapSummary> = {},
): PublicRoadmapSummary => ({
  id: "tmpl-1",
  slug: "python-backend",
  title: "Python Backend",
  summary: "Build asynchronous backends.",
  category: "backend",
  level: "intermediate",
  estimatedWeeks: 4,
  hoursPerWeek: 6,
  topicCount: 12,
  snapshotVersion: "2026-10-15.1",
  tags: ["python"],
  updatedAt: "2026-10-15T10:00:00Z",
  ...overrides,
});

const emptyList = { items: [], total: 0, limit: PUBLIC_CATALOG_PAGE_SIZE, offset: 0 };

describe("usePublicCatalog (LSI-029)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listPublicRoadmaps).mockResolvedValue(emptyList);
  });

  it("loads the published catalog anonymously on mount", async () => {
    const items = [makeRoadmap()];
    vi.mocked(listPublicRoadmaps).mockResolvedValue({
      items,
      total: 1,
      limit: PUBLIC_CATALOG_PAGE_SIZE,
      offset: 0,
    });

    const { result } = renderHook(() => usePublicCatalog());

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listPublicRoadmaps).toHaveBeenCalledWith(
      { limit: PUBLIC_CATALOG_PAGE_SIZE, offset: 0 },
      expect.any(AbortSignal),
    );
    expect(result.current.items).toEqual(items);
    expect(result.current.page).toBe(1);
    expect(result.current.error).toBeNull();
  });

  it("debounces the search filter and returns to the first page", async () => {
    vi.mocked(listPublicRoadmaps).mockResolvedValue({
      items: [makeRoadmap()],
      total: 40,
      limit: PUBLIC_CATALOG_PAGE_SIZE,
      offset: 0,
    });
    const { result } = renderHook(() => usePublicCatalog());
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    act(() => result.current.setPage(3));
    await waitFor(() =>
      expect(listPublicRoadmaps).toHaveBeenLastCalledWith(
        expect.objectContaining({ offset: 2 * PUBLIC_CATALOG_PAGE_SIZE }),
        expect.any(AbortSignal),
      ),
    );

    const callsBeforeTyping = vi.mocked(listPublicRoadmaps).mock.calls.length;
    act(() => result.current.setQuery("python"));
    // Not yet: the free-text filter is debounced.
    expect(vi.mocked(listPublicRoadmaps).mock.calls.length).toBe(callsBeforeTyping);

    await waitFor(() =>
      expect(listPublicRoadmaps).toHaveBeenLastCalledWith(
        expect.objectContaining({ query: "python", offset: 0 }),
        expect.any(AbortSignal),
      ),
    );
    expect(result.current.page).toBe(1);
  });

  it("applies level and category filters at page 1 and accumulates categories", async () => {
    vi.mocked(listPublicRoadmaps).mockResolvedValue({
      items: [makeRoadmap({ category: "backend" })],
      total: 1,
      limit: PUBLIC_CATALOG_PAGE_SIZE,
      offset: 0,
    });
    const { result } = renderHook(() => usePublicCatalog());
    await waitFor(() => expect(result.current.categories).toEqual(["backend"]));

    vi.mocked(listPublicRoadmaps).mockResolvedValue({
      items: [makeRoadmap({ category: "design" })],
      total: 1,
      limit: PUBLIC_CATALOG_PAGE_SIZE,
      offset: 0,
    });
    act(() => result.current.setLevel("advanced"));
    await waitFor(() =>
      expect(listPublicRoadmaps).toHaveBeenLastCalledWith(
        expect.objectContaining({ level: "advanced", offset: 0 }),
        expect.any(AbortSignal),
      ),
    );

    act(() => result.current.setCategory("design"));
    await waitFor(() =>
      expect(listPublicRoadmaps).toHaveBeenLastCalledWith(
        expect.objectContaining({ level: "advanced", category: "design" }),
        expect.any(AbortSignal),
      ),
    );
    // Categories only ever grow, so a learner can switch back after narrowing.
    await waitFor(() =>
      expect(result.current.categories).toEqual(["backend", "design"]),
    );
  });

  it("reports a typed load failure and recovers on retry", async () => {
    vi.mocked(listPublicRoadmaps).mockRejectedValueOnce(
      new ApiError(503, "catalog down"),
    );

    const { result } = renderHook(() => usePublicCatalog());
    await waitFor(() =>
      expect(result.current.error).toBe(
        "The learning catalog is temporarily unavailable. Please try again.",
      ),
    );
    expect(result.current.items).toEqual([]);

    vi.mocked(listPublicRoadmaps).mockResolvedValue({
      items: [makeRoadmap()],
      total: 1,
      limit: PUBLIC_CATALOG_PAGE_SIZE,
      offset: 0,
    });
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.error).toBeNull();
  });

  it("clears every filter and page through resetFilters", async () => {
    const { result } = renderHook(() => usePublicCatalog({ query: "seeded" }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasFilters).toBe(true);

    act(() => {
      result.current.setLevel("beginner");
      result.current.setCategory("design");
    });
    await waitFor(() => expect(result.current.hasFilters).toBe(true));

    act(() => result.current.resetFilters());
    await waitFor(() => expect(result.current.hasFilters).toBe(false));
    expect(result.current.query).toBe("");
    expect(result.current.level).toBeNull();
    expect(result.current.category).toBeNull();
    expect(result.current.page).toBe(1);
  });
});
