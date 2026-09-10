import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { WorkspaceDashboard } from "../WorkspaceDashboard";
import * as workspaceApi from "@/lib/workspaceApi";

// Mock router
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock AuthContext
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u-1", email: "test@graphmind.app", fullName: "Test User", provider: "google" },
    logout: vi.fn(),
  }),
}));

describe("WorkspaceDashboard & Learning Dashboard Contract (Scope 4, Task 1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("strictly enforces zero raw <button> tags and semantic tokens in dashboard and modal", () => {
    const files = ["WorkspaceDashboard.tsx", "RoadmapModal.tsx"];

    for (const file of files) {
      const content = readFileSync(
        path.resolve(process.cwd(), `src/components/workspace/${file}`),
        "utf8"
      );

      // No raw <button> elements
      expect(content, `${file} must not contain raw <button> elements`).not.toMatch(/<button\b/);

      // No hardcoded zinc or white palette colors
      expect(
        content,
        `${file} must not contain hardcoded zinc or white utility classes`
      ).not.toMatch(/\b(?:bg|text|border|ring)-(?:white|zinc)-/);
    }
  });

  it("renders workspace list and navigates on card click or Enter key", async () => {
    const user = userEvent.setup();
    vi.spyOn(workspaceApi, "fetchWorkspaces").mockResolvedValue([
      {
        id: "ws-100",
        name: "Distributed Systems",
        description: "Raft consensus, sharding, and vector clocks",
        nodeCount: 14,
        viewportX: 0,
        viewportY: 0,
        zoom: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    render(<WorkspaceDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Distributed Systems")).toBeInTheDocument();
    });

    expect(screen.getByText(/14 nodes/i)).toBeInTheDocument();

    const wsCard = screen.getByRole("button", { name: /open workspace distributed systems/i });
    expect(wsCard).toBeInTheDocument();

    await user.click(wsCard);
    expect(mockPush).toHaveBeenCalledWith("/w/ws-100");

    // Keyboard navigation with Enter
    mockPush.mockClear();
    wsCard.focus();
    await user.keyboard("{Enter}");
    expect(mockPush).toHaveBeenCalledWith("/w/ws-100");
  });

  it("renders empty state with actionable roadmap trigger when no workspaces exist", async () => {
    vi.spyOn(workspaceApi, "fetchWorkspaces").mockResolvedValue([]);

    render(<WorkspaceDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/start your learning journey/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /generate ai roadmap/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /blank workspace/i })).toBeInTheDocument();
  });

  it("renders explicit error feedback and supports retry action on failure", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(workspaceApi, "fetchWorkspaces")
      .mockRejectedValueOnce(new Error("Network connection dropped"))
      .mockResolvedValueOnce([]);

    render(<WorkspaceDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/network connection dropped/i)).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole("button", { name: /retry/i });
    await user.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText(/start your learning journey/i)).toBeInTheDocument();
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });
});
