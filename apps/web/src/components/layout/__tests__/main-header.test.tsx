import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MainHeader } from "../MainHeader";
import { Navbar } from "../Navbar";

describe("MainHeader Component & Contract (Scope 3, Task 3)", () => {
  it("enforces zero raw <button> elements and strictly semantic tokens", () => {
    const files = ["MainHeader.tsx", "Navbar.tsx"];

    for (const file of files) {
      const content = readFileSync(
        path.resolve(process.cwd(), `src/components/layout/${file}`),
        "utf8"
      );

      // Zero raw <button> tags
      expect(content, `${file} must not contain raw <button> tags`).not.toMatch(/<button\b/);

      // No hardcoded colors
      expect(
        content,
        `${file} must not contain hardcoded zinc or white utility classes`
      ).not.toMatch(/\b(?:bg|text|border|ring)-(?:white|zinc)-/);
    }
  });

  it("conforms to standard 52px header height (h-13) and semantic styling", () => {
    const { container } = render(
      <MainHeader workspaceName="Test Workspace" />
    );

    const header = container.querySelector("header");
    expect(header).toBeInTheDocument();
    expect(header).toHaveClass("h-13");
    expect(header).toHaveClass("bg-surface");
    expect(header).toHaveClass("border-b");
  });

  it("omits redundant workspace name from header and renders sidebar toggle when collapsed", async () => {
    const user = userEvent.setup();
    const handleToggle = vi.fn();

    render(
      <MainHeader
        workspaceName="Quantum Computing"
        isSidebarOpen={false}
        onToggleSidebar={handleToggle}
      />
    );

    // Workspace name is not rendered in header (handled by sidebar)
    expect(screen.queryByRole("button", { name: /current workspace: quantum computing/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Quantum Computing")).not.toBeInTheDocument();

    // Sidebar toggle is rendered and functional
    const toggleBtn = screen.getByRole("button", { name: "Expand sidebar" });
    expect(toggleBtn).toBeInTheDocument();
    await user.click(toggleBtn);
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it("supports mode switching between Chat and Canvas via SegmentedTabs", async () => {
    const user = userEvent.setup();
    const handleViewModeChange = vi.fn();

    const { rerender } = render(
      <MainHeader
        viewMode="chat"
        onViewModeChange={handleViewModeChange}
      />
    );

    const chatTab = screen.getByRole("tab", { name: /chat/i });
    const canvasTab = screen.getByRole("tab", { name: /canvas/i });

    expect(chatTab).toHaveAttribute("data-state", "active");
    expect(canvasTab).toHaveAttribute("data-state", "inactive");

    await user.click(canvasTab);
    expect(handleViewModeChange).toHaveBeenCalledWith("canvas");

    rerender(
      <MainHeader
        viewMode="canvas"
        onViewModeChange={handleViewModeChange}
      />
    );

    expect(canvasTab).toHaveAttribute("data-state", "active");
    expect(chatTab).toHaveAttribute("data-state", "inactive");
  });

  it("renders contextual rail toggle and fires callback", async () => {
    const user = userEvent.setup();
    const handleToggleRail = vi.fn();

    const { rerender } = render(
      <MainHeader
        isRightSidebarOpen={false}
        onToggleRightSidebar={handleToggleRail}
      />
    );

    const openBtn = screen.getByRole("button", { name: /open right panel/i });
    await user.click(openBtn);
    expect(handleToggleRail).toHaveBeenCalledTimes(1);

    rerender(
      <MainHeader
        isRightSidebarOpen={true}
        onToggleRightSidebar={handleToggleRail}
      />
    );

    const collapseBtn = screen.getByRole("button", { name: /collapse right panel/i });
    expect(collapseBtn).toBeInTheDocument();
  });

  it("renders centered breadcrumbs slot", () => {
    render(
      <MainHeader
        breadcrumbs={<div data-testid="test-breadcrumbs">Path / To / Node</div>}
      />
    );

    expect(screen.getByTestId("test-breadcrumbs")).toBeInTheDocument();
    expect(screen.getByText("Path / To / Node")).toBeInTheDocument();
  });

  it("exports Navbar as an alias with backward compatibility", () => {
    expect(Navbar).toBe(MainHeader);
  });
});
