import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const mockRouter = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouter.push }),
}));

import PublicCatalogPage from "../page";

const PUBLISHED = {
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
  tags: ["python"],
  updatedAt: "2026-10-15T10:00:00Z",
};

const catalogResponse = (status = 200, body?: unknown) => ({
  ok: status < 400,
  status,
  json: async () => body ?? { items: [PUBLISHED], total: 1, limit: 12, offset: 0 },
});

describe("/learn public catalog page (LSI-029)", () => {
  beforeEach(() => mockRouter.push.mockReset());
  afterEach(() => vi.unstubAllGlobals());

  it("renders the published catalog from the public endpoint only", async () => {
    const fetcher = vi.fn().mockResolvedValue(catalogResponse());
    vi.stubGlobal("fetch", fetcher);

    render(<PublicCatalogPage />);

    expect(await screen.findByText("Python Backend Engineering")).toBeInTheDocument();

    // Exactly one request, and it is the anonymous public catalog: a guest page
    // must never issue a private workspace/curriculum fetch.
    expect(fetcher).toHaveBeenCalledTimes(1);
    const url = String(fetcher.mock.calls[0][0]);
    expect(url).toContain("/api/v1/public/roadmaps");
    expect(url).not.toContain("/workspaces/");
  });

  it("navigates to the canonical public roadmap URL when a card is opened", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(catalogResponse()));

    render(<PublicCatalogPage />);
    const card = await screen.findByTestId("public-roadmap-card-python-backend");

    fireEvent.click(within(card).getByRole("button", { name: /open roadmap/i }));

    expect(mockRouter.push).toHaveBeenCalledWith("/learn/python-backend");
  });

  it("shows a brand-only public header without private studio navigation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(catalogResponse()));

    render(<PublicCatalogPage />);
    await screen.findByText("Python Backend Engineering");

    expect(screen.getByText("GraphMind")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "My Learning" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create" })).not.toBeInTheDocument();
  });

  it("recovers from a transient catalog failure through retry", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(catalogResponse(503))
      .mockResolvedValueOnce(catalogResponse());
    vi.stubGlobal("fetch", fetcher);

    render(<PublicCatalogPage />);
    const errorBanner = await screen.findByTestId("studio-catalog-error");

    fireEvent.click(within(errorBanner).getByRole("button", { name: /retry/i }));

    await waitFor(() =>
      expect(screen.getByText("Python Backend Engineering")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("studio-catalog-error")).not.toBeInTheDocument();
  });
});
