import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkspaceShell } from "../WorkspaceShell";
import {
  buildWorkspaceUrl,
  buildChatUrl,
  buildCanvasUrl,
} from "@/lib/urls";

describe("WorkspaceShell (Scope 3, Task 1)", () => {
  it("renders navigation, header, main content, and conditional rail slots", () => {
    const { rerender } = render(
      <WorkspaceShell
        navigation={<nav aria-label="Left nav">Left Navigation</nav>}
        header={<header>Top Header</header>}
      >
        <div>Main Content Viewport</div>
      </WorkspaceShell>
    );

    expect(screen.getByTestId("workspace-shell")).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Left nav" })).toBeVisible();
    expect(screen.getByText("Top Header")).toBeVisible();
    expect(screen.getByTestId("workspace-main-content")).toHaveTextContent(
      "Main Content Viewport"
    );

    // Rail is conditional; not rendered when omitted
    expect(screen.queryByTestId("context-rail")).not.toBeInTheDocument();

    // Rerender with contextual rail
    rerender(
      <WorkspaceShell
        navigation={<nav aria-label="Left nav">Left Navigation</nav>}
        header={<header>Top Header</header>}
        rail={<aside data-testid="context-rail">Contextual Rail</aside>}
      >
        <div>Main Content Viewport</div>
      </WorkspaceShell>
    );

    expect(screen.getByTestId("context-rail")).toBeVisible();
  });

  it("applies semantic design tokens to the shell layout", () => {
    render(
      <WorkspaceShell
        navigation={<nav>Nav</nav>}
        header={<header>Header</header>}
      >
        <div>Content</div>
      </WorkspaceShell>
    );

    const shell = screen.getByTestId("workspace-shell");
    expect(shell).toHaveClass("bg-background", "overflow-hidden");

    const mainContent = screen.getByTestId("workspace-main-content");
    expect(mainContent).toHaveClass("bg-background", "overflow-hidden");
  });

  it("strictly enforces canonical URL hierarchy helpers", () => {
    // Canonical Workspace URL
    expect(buildWorkspaceUrl("ws-123")).toBe("/w/ws-123");

    // Canonical Chat URL
    expect(buildChatUrl("ws-123", "chat-456")).toBe("/w/ws-123/chat/chat-456");

    // Canonical Canvas URL
    expect(buildCanvasUrl("ws-123", "chat-456")).toBe(
      "/w/ws-123/chat/chat-456/canvas"
    );

    // Primary identifiers belong in the path, not query params
    const chatUrl = buildChatUrl("ws-123", "chat-456");
    expect(chatUrl).not.toContain("?workspaceId=");
    expect(chatUrl).not.toContain("?chatId=");
  });
});
