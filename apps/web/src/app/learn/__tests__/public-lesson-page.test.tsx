import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const mockRouter = vi.hoisted(() => ({ push: vi.fn() }));
const mockParams = vi.hoisted(() => ({
  value: { slug: "python-backend", topicSlug: "async-basics" } as Record<string, string>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouter.push }),
  usePathname: () => "/learn/python-backend/lessons/async-basics",
  useParams: () => mockParams.value,
}));

import PublicLessonPage from "../[slug]/lessons/[topicSlug]/page";

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
          id: "pub_topic_intro",
          slug: "intro",
          title: "Intro",
          brief: "",
          order: 1,
          path: "core",
          estimateMinutes: 10,
          prerequisites: [],
        },
        {
          id: "pub_topic_async",
          slug: "async-basics",
          title: "Async basics",
          brief: "Event loops",
          order: 2,
          path: "core",
          estimateMinutes: 30,
          prerequisites: [],
        },
      ],
    },
  ],
  sources: [],
};

const LESSON = {
  templateId: "tmpl-python",
  snapshotVersion: "2026-10-15.1",
  topicId: "pub_topic_async",
  topicSlug: "async-basics",
  title: "Async basics",
  brief: "Cooperative scheduling.",
  objectives: [],
  contentMarkdown: "## Event loop\n\nA loop that schedules coroutines.",
  exercise: null,
  format: "concepts",
  estimateMinutes: 30,
  sources: [],
};

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

function fetcher() {
  return vi.fn().mockImplementation((url: string) =>
    Promise.resolve(ok(url.includes("/topics/") ? LESSON : ROADMAP)),
  );
}

describe("/learn/[slug]/lessons/[topicSlug] guest lesson page (LSI-030)", () => {
  beforeEach(() => {
    mockRouter.push.mockReset();
    mockParams.value = { slug: "python-backend", topicSlug: "async-basics" };
  });
  afterEach(() => vi.unstubAllGlobals());

  it("reads the lesson and roadmap only through the public endpoints", async () => {
    const fetcherMock = fetcher();
    vi.stubGlobal("fetch", fetcherMock);

    render(<PublicLessonPage />);
    expect(await screen.findByRole("heading", { name: "Async basics" })).toBeInTheDocument();

    const urls = fetcherMock.mock.calls.map((call) => String(call[0]));
    expect(urls).toHaveLength(2);
    expect(urls.every((url) => url.startsWith("/api/v1/public/roadmaps/"))).toBe(true);
    expect(urls.some((url) => url.includes("/workspaces/"))).toBe(false);
  });

  it("resolves the phase, position, and neighbours from the public snapshot", async () => {
    vi.stubGlobal("fetch", fetcher());

    render(<PublicLessonPage />);
    await screen.findByRole("heading", { name: "Async basics" });

    expect(screen.getByText("Phase 1: Async")).toBeInTheDocument();
    expect(screen.getByText("Lesson 2 of 2")).toBeInTheDocument();
    // Only a previous lesson exists here.
    expect(screen.getByRole("button", { name: /intro/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("navigates back to the roadmap and to a neighbour lesson by public URL", async () => {
    vi.stubGlobal("fetch", fetcher());

    render(<PublicLessonPage />);
    await screen.findByRole("heading", { name: "Async basics" });

    fireEvent.click(screen.getByRole("button", { name: /python backend engineering/i }));
    expect(mockRouter.push).toHaveBeenCalledWith("/learn/python-backend");

    fireEvent.click(screen.getByRole("button", { name: /intro/i }));
    expect(mockRouter.push).toHaveBeenCalledWith(
      "/learn/python-backend/lessons/intro",
    );
  });

  it("gates progress tracking behind sign-in", async () => {
    vi.stubGlobal("fetch", fetcher());

    render(<PublicLessonPage />);
    await screen.findByRole("heading", { name: "Async basics" });

    fireEvent.click(
      screen.getByRole("button", { name: /sign in to track progress and ask the tutor/i }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith(
      "/login?next=%2Flearn%2Fpython-backend%2Flessons%2Fasync-basics",
    );
  });
});
