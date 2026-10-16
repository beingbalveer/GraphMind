import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { StudioCatalogView } from "../StudioCatalogView";
import type { PublicRoadmapSummary } from "@/lib/publicCatalogApi";

const roadmaps: PublicRoadmapSummary[] = [
  {
    id: "tmpl-python",
    slug: "python-backend",
    title: "Python Backend Engineering",
    summary: "Asynchronous FastAPI services.",
    category: "backend",
    level: "intermediate",
    estimatedWeeks: 4,
    hoursPerWeek: 6,
    topicCount: 12,
    snapshotVersion: "2026-10-15.1",
    tags: ["python", "fastapi"],
    updatedAt: "2026-10-15T10:00:00Z",
  },
  {
    id: "tmpl-drawing",
    slug: "beginner-drawing",
    title: "Beginner Drawing",
    summary: "Observation and contour line practice.",
    category: "design",
    level: "beginner",
    estimatedWeeks: 6,
    hoursPerWeek: 3,
    topicCount: 10,
    snapshotVersion: "2026-10-14.1",
    tags: [],
    updatedAt: "2026-10-14T10:00:00Z",
  },
];

function renderView(overrides: Partial<React.ComponentProps<typeof StudioCatalogView>> = {}) {
  const props = {
    items: roadmaps,
    total: roadmaps.length,
    page: 1,
    pageCount: 1,
    query: "",
    category: null,
    level: null,
    categories: ["backend", "design"],
    onQueryChange: vi.fn(),
    onCategoryChange: vi.fn(),
    onLevelChange: vi.fn(),
    onPageChange: vi.fn(),
    onRetry: vi.fn(),
    onResetFilters: vi.fn(),
    onOpen: vi.fn(),
    ...overrides,
  };
  render(<StudioCatalogView {...props} />);
  return props;
}

describe("StudioCatalogView (LSI-029)", () => {
  it("renders loading skeletons while the catalog loads", () => {
    renderView({ items: [], isLoading: true });
    expect(screen.getByTestId("studio-catalog-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("public-roadmap-card-python-backend")).not.toBeInTheDocument();
  });

  it("renders an error banner with a working retry", () => {
    const props = renderView({ items: [], error: "Network error" });
    expect(screen.getByTestId("studio-catalog-error")).toBeInTheDocument();
    expect(screen.getByText("Network error")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders a card per published roadmap and opens the public URL", () => {
    const props = renderView();

    const card = screen.getByTestId("public-roadmap-card-python-backend");
    expect(within(card).getByText("Python Backend Engineering")).toBeInTheDocument();
    expect(within(card).getByText("Intermediate")).toBeInTheDocument();
    expect(within(card).getByText("backend")).toBeInTheDocument();
    expect(within(card).getByText("12 lessons")).toBeInTheDocument();
    expect(within(card).getByText("4 weeks")).toBeInTheDocument();
    expect(within(card).getByText("6 h/week")).toBeInTheDocument();
    expect(within(card).getByText("python")).toBeInTheDocument();

    expect(screen.getByText("2 roadmaps published")).toBeInTheDocument();

    fireEvent.click(
      within(card).getByRole("button", { name: /open roadmap/i }),
    );
    expect(props.onOpen).toHaveBeenCalledWith("python-backend");
  });

  it("reports free-text, level, and category filter changes", () => {
    const props = renderView();

    fireEvent.change(screen.getByLabelText("Search public catalog"), {
      target: { value: "async" },
    });
    expect(props.onQueryChange).toHaveBeenCalledWith("async");

    fireEvent.click(screen.getByRole("tab", { name: "Beginner" }));
    expect(props.onLevelChange).toHaveBeenCalledWith("beginner");

    fireEvent.click(screen.getByRole("tab", { name: "design" }));
    expect(props.onCategoryChange).toHaveBeenCalledWith("design");
  });

  it("clears an active level and category filter through the All tabs", () => {
    const props = renderView({ level: "beginner", category: "design" });

    fireEvent.click(screen.getByRole("tab", { name: "All levels" }));
    expect(props.onLevelChange).toHaveBeenLastCalledWith(null);

    fireEvent.click(screen.getByRole("tab", { name: "All topics" }));
    expect(props.onCategoryChange).toHaveBeenLastCalledWith(null);
  });

  it("shows the honest empty state before anything is published", () => {
    renderView({ items: [], total: 0, categories: [] });
    expect(screen.getByTestId("studio-catalog-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("studio-catalog-no-results")).not.toBeInTheDocument();
  });

  it("shows a no-results state with a clear-filters action", () => {
    const props = renderView({ items: [], total: 0, query: "kubernetes" });
    expect(screen.getByTestId("studio-catalog-no-results")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /clear search and filters/i }));
    expect(props.onResetFilters).toHaveBeenCalledTimes(1);
  });

  it("pages through results and disables the ends", () => {
    const props = renderView({ page: 1, pageCount: 3, total: 30 });
    expect(screen.getByTestId("studio-catalog-pagination")).toBeInTheDocument();

    const previous = screen.getByRole("button", { name: /previous/i });
    expect(previous).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(props.onPageChange).toHaveBeenCalledWith(2);
  });
});
