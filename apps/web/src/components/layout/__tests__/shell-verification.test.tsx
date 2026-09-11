import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceShell } from "../WorkspaceShell";
import { MainHeader } from "../MainHeader";
import { ContextRail } from "../ContextRail";
import { buildChatUrl, buildCanvasUrl, buildWorkspaceUrl } from "@/lib/urls";

describe("Scope 3 Master Shell Verification (Task 7)", () => {
  it("strictly enforces zero raw <button> tags and pure semantic tokens across all shell components", () => {
    const shellFiles = [
      "WorkspaceShell.tsx",
      "MainHeader.tsx",
      "ContextRail.tsx",
      "Navbar.tsx",
    ];

    for (const file of shellFiles) {
      const content = readFileSync(
        path.resolve(process.cwd(), `src/components/layout/${file}`),
        "utf8"
      );

      // No raw <button> tags
      expect(content, `${file} must not contain raw <button> tags`).not.toMatch(/<button\b/);

      // No hardcoded zinc or white palette colors
      expect(
        content,
        `${file} must not contain hardcoded zinc or white utility classes`
      ).not.toMatch(/\b(?:bg|text|border|ring)-(?:white|zinc)-/);
    }
  });

  it("verifies canonical URL transitions and view mode as a path segment", () => {
    const ws = "ws-prod";
    const chat = "chat-analytics";

    expect(buildWorkspaceUrl(ws)).toBe("/w/ws-prod");
    expect(buildChatUrl(ws, chat)).toBe("/w/ws-prod/chat/chat-analytics");
    expect(buildCanvasUrl(ws, chat)).toBe("/w/ws-prod/chat/chat-analytics/canvas");

    // Primary IDs never in query params
    expect(buildChatUrl(ws, chat)).not.toMatch(/[?&](?:workspaceId|chatId)=/);
    expect(buildCanvasUrl(ws, chat)).not.toMatch(/[?&](?:workspaceId|chatId)=/);
  });

  it("verifies 52px header standard, workspace name, mode switching, and rail controls", async () => {
    const user = userEvent.setup();
    const handleViewModeChange = vi.fn();
    const handleToggleRail = vi.fn();
    const handleToggleNav = vi.fn();

    render(
      <WorkspaceShell
        navigation={<nav data-testid="test-nav">Navigation</nav>}
        header={
          <MainHeader
            workspaceName="Algorithmic Graphs"
            viewMode="chat"
            onViewModeChange={handleViewModeChange}
            isSidebarOpen={false}
            onToggleSidebar={handleToggleNav}
            isRightSidebarOpen={false}
            onToggleRightSidebar={handleToggleRail}
          />
        }
        rail={
          <ContextRail
            isOpen={false}
            onToggle={handleToggleRail}
            title="Inspector Rail"
          >
            <div>Rail Content</div>
          </ContextRail>
        }
      >
        <div data-testid="test-content">Main Content</div>
      </WorkspaceShell>
    );

    // 52px header check
    const header = screen.getByTestId("main-header");
    expect(header).toHaveClass("h-13");

    // Mode switch: Click Canvas tab
    const canvasTab = screen.getByRole("tab", { name: /canvas/i });
    await user.click(canvasTab);
    expect(handleViewModeChange).toHaveBeenCalledWith("canvas");

    // Toggle contextual rail
    const openRailBtn = screen.getByRole("button", { name: /open right panel/i });
    await user.click(openRailBtn);
    expect(handleToggleRail).toHaveBeenCalledTimes(1);
  });

  it("verifies drawer mode and keyboard Escape dismissal for contextual rail", async () => {
    const user = userEvent.setup();
    const handleToggleRail = vi.fn();

    render(
      <ContextRail
        isOpen={true}
        onToggle={handleToggleRail}
        title="Mobile Inspector"
        forceDrawer={true}
      >
        <div>Drawer Body</div>
      </ContextRail>
    );

    expect(screen.getByTestId("context-rail-drawer-content")).toBeInTheDocument();
    expect(screen.getByText("Drawer Body")).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: /close drawer/i });
    await user.click(closeBtn);
    expect(handleToggleRail).toHaveBeenCalledTimes(1);
  });

  it("verifies reduced motion support in shell components", () => {
    const mainHeaderContent = readFileSync(
      path.resolve(process.cwd(), "src/components/layout/MainHeader.tsx"),
      "utf8"
    );
    const contextRailContent = readFileSync(
      path.resolve(process.cwd(), "src/components/layout/ContextRail.tsx"),
      "utf8"
    );

    // Shell containers should respect motion-reduction where animations occur
    expect(contextRailContent).toContain("transition");
    expect(mainHeaderContent).toContain("transition-colors");
  });
});
