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

  it("conforms to the 47px workspace header height and semantic styling", () => {
    const { container } = render(
      <MainHeader workspaceName="Test Workspace" />
    );

    const header = container.querySelector("header");
    expect(header).toBeInTheDocument();
    expect(header).toHaveClass("h-[47px]");
    expect(header).toHaveClass("bg-surface");
    expect(header).toHaveClass("border-b");
  });

  it("omits redundant workspace name and duplicate sidebar toggle from the header", () => {

    render(
      <MainHeader
        workspaceName="Quantum Computing"
        isSidebarOpen={false}
        onToggleSidebar={vi.fn()}
      />
    );

    // Workspace name is not rendered in header (handled by sidebar)
    expect(screen.queryByRole("button", { name: /current workspace: quantum computing/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Quantum Computing")).not.toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "Expand sidebar" })).not.toBeInTheDocument();
  });

  it("supports mode switching between Chat and Canvas via separate buttons", async () => {
    const user = userEvent.setup();
    const handleViewModeChange = vi.fn();

    const { rerender } = render(
      <MainHeader
        viewMode="chat"
        onViewModeChange={handleViewModeChange}
      />
    );

    const chatTab = screen.getByRole("button", { name: /chat/i });
    const canvasTab = screen.getByRole("button", { name: /canvas/i });

    expect(chatTab).toHaveAttribute("aria-pressed", "true");
    expect(canvasTab).toHaveAttribute("aria-pressed", "false");

    await user.click(canvasTab);
    expect(handleViewModeChange).toHaveBeenCalledWith("canvas");

    rerender(
      <MainHeader
        viewMode="canvas"
        onViewModeChange={handleViewModeChange}
      />
    );

    expect(canvasTab).toHaveAttribute("aria-pressed", "true");
    expect(chatTab).toHaveAttribute("aria-pressed", "false");
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
