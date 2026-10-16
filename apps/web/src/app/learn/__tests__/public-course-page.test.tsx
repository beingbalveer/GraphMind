import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PENDING_INTENT_STORAGE_KEY } from "@/lib/authIntent";

const mockRouter = vi.hoisted(() => ({ push: vi.fn() }));
const mockParams = vi.hoisted(() => ({
  value: { slug: "python-backend" } as Record<string, string>,
}));
const mockAuth = vi.hoisted(() => ({ value: { isAuthenticated: false } }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouter.push }),
  usePathname: () => "/learn/python-backend",
  useParams: () => mockParams.value,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => mockAuth.value,
}));

import PublicCoursePage from "../[slug]/page";

const ROADMAP = {
  id: "tmpl-python",
  slug: "python-backend",
  title: "Python Backend Engineering",
  summary: "Asynchronous FastAPI services.",
  category: "backend",
  level: "intermediate",
  snapshotVersion: "2026-10-15.1",
  outcomes: [],
  prerequisites: [],
  phases: [
    {
      id: "pub_phase_1",
      title: "Phase 1: Async",
      order: 1,
      topics: [
        {
          id: "pub_topic_async",
          slug: "async-basics",
          title: "Async basics",
          brief: "Event loops",
          order: 1,
          path: "core",
          estimateMinutes: 30,
          prerequisites: [],
        },
      ],
    },
  ],
  sources: [],
};

const ENROLLMENT = {
  roadmapId: "rm_1",
  workspaceId: "ws_new",
  revisionId: "rev_1",
  sourceSnapshotRef: "tmpl-python:2026-10-15.1",
  title: "Python Backend Engineering",
  createdAt: "2026-10-16T00:00:00Z",
  updatedAt: "2026-10-16T00:00:00Z",
  topicProgress: {},
  topicMap: [{ publicTopicId: "pub_topic_async", privateTopicId: "item_async" }],
};

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

describe("/learn/[slug] guest course page (LSI-030)", () => {
  beforeEach(() => {
    mockRouter.push.mockReset();
    mockParams.value = { slug: "python-backend" };
    mockAuth.value = { isAuthenticated: false };
    window.localStorage.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("reads only the anonymous public snapshot endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue(ok(ROADMAP));
    vi.stubGlobal("fetch", fetcher);

    render(<PublicCoursePage />);
    expect(await screen.findByText("Python Backend Engineering")).toBeInTheDocument();

    expect(fetcher).toHaveBeenCalledTimes(1);
    const url = String(fetcher.mock.calls[0][0]);
    expect(url).toContain("/api/v1/public/roadmaps/python-backend");
    expect(url).not.toContain("/workspaces/");
    expect(url).not.toContain("canvas-layout");
  });

  it("opens a lesson at its canonical public URL", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok(ROADMAP)));

    render(<PublicCoursePage />);
    await screen.findByText("Async basics");

    fireEvent.click(screen.getByTestId("public-topic-async-basics"));
    expect(mockRouter.push).toHaveBeenCalledWith(
      "/learn/python-backend/lessons/async-basics",
    );
  });

  it("routes a guest to sign-in instead of performing any private write", async () => {
    const fetcher = vi.fn().mockResolvedValue(ok(ROADMAP));
    vi.stubGlobal("fetch", fetcher);

    render(<PublicCoursePage />);
    await screen.findByText("Python Backend Engineering");

    fireEvent.click(screen.getByRole("button", { name: /sign in to save this roadmap/i }));
    expect(mockRouter.push).toHaveBeenCalledWith(
      "/login?next=%2Flearn%2Fpython-backend",
    );
    // The gated action issued no mutation request.
    expect(fetcher).toHaveBeenCalledTimes(1);
    // The intent carries public snapshot identity only, for LSI-032 resume.
    const stored = JSON.parse(
      window.localStorage.getItem(PENDING_INTENT_STORAGE_KEY) as string,
    );
    expect(stored).toMatchObject({
      kind: "save",
      templateId: "tmpl-python",
      slug: "python-backend",
      snapshotVersion: "2026-10-15.1",
    });
    expect(JSON.stringify(stored)).not.toContain("workspaceId");
  });

  it("renders an honest not-available state for a withdrawn snapshot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: { code: "NOT_FOUND", message: "This content is not available." } }),
      }),
    );

    render(<PublicCoursePage />);
    await waitFor(() =>
      expect(screen.getByTestId("public-course-not-found")).toBeInTheDocument(),
    );
  });

  it("saves a private copy for a signed-in learner and opens it", async () => {
    mockAuth.value = { isAuthenticated: true };
    const fetcher = vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = (init.method ?? "GET").toUpperCase();
      if (url.includes("/public/roadmaps/")) return ok(ROADMAP);
      if (url.startsWith("/api/v1/workspaces?")) {
        return ok({ workspaces: [], total: 0 });
      }
      if (url === "/api/v1/workspaces" && method === "POST") {
        return {
          ok: true,
          status: 201,
          json: async () => ({
            id: "ws_new",
            name: "Python Backend Engineering",
            viewportX: 0,
            viewportY: 0,
            zoom: 1,
            nodeCount: 0,
            createdAt: "2026-10-16T00:00:00Z",
            updatedAt: "2026-10-16T00:00:00Z",
          }),
        };
      }
      if (url === "/api/v1/workspaces/ws_new/learning-roadmaps") {
        return { ok: true, status: 201, json: async () => ENROLLMENT };
      }
      throw new Error(`unexpected ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetcher);

    render(<PublicCoursePage />);
    await screen.findByText("Python Backend Engineering");

    fireEvent.click(screen.getByRole("button", { name: /add to my learning/i }));
    expect(
      await screen.findByTestId("public-course-save-success"),
    ).toBeInTheDocument();
    expect(screen.getByText("Saved to your learning")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open my copy/i }));
    expect(mockRouter.push).toHaveBeenCalledWith("/w/ws_new");
  });
});
