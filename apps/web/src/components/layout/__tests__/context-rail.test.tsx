import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ContextRail } from "../ContextRail";
import { RightSidebar } from "../../chat/RightSidebar";

describe("ContextRail Contract & Verification (Scope 3, Task 4)", () => {
  it("enforces zero raw <button> tags and strictly semantic tokens", () => {
    const files = ["ContextRail.tsx", "../chat/RightSidebar.tsx"];

    for (const relPath of files) {
      const content = readFileSync(
        path.resolve(process.cwd(), `src/components/layout/${relPath}`),
        "utf8"
      );

      // No raw <button> tags
      expect(content, `${relPath} must not contain raw <button> elements`).not.toMatch(/<button\b/);

      // No hardcoded zinc or white palette colors
      expect(
        content,
        `${relPath} must not contain hardcoded zinc or white utility classes`
      ).not.toMatch(/\b(?:bg|text|border|ring)-(?:white|zinc)-/);
    }
  });

  it("renders desktop rail with 52px header (h-13) and fires toggle on button click or Escape key", async () => {
    const user = userEvent.setup();
    const handleToggle = vi.fn();

    render(
      <ContextRail
        isOpen={true}
        onToggle={handleToggle}
        title="Knowledge Explorer"
      >
        <div>Mastery content here</div>
      </ContextRail>
    );

    // Desktop aside is present
    const aside = screen.getByTestId("context-rail-aside");
    expect(aside).toBeInTheDocument();
    expect(screen.getByText("Knowledge Explorer")).toBeInTheDocument();
    expect(screen.getByText("Mastery content here")).toBeInTheDocument();

    // Standard 52px header check
    const headerEl = aside.querySelector(".h-13");
    expect(headerEl).toBeInTheDocument();

    // Clicking collapse panel button
    const collapseBtn = screen.getByRole("button", { name: /collapse panel/i });
    await user.click(collapseBtn);
    expect(handleToggle).toHaveBeenCalledTimes(1);

    // Pressing Escape closes panel
    handleToggle.mockClear();
    await user.keyboard("{Escape}");
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it("transforms into accessible Drawer at constrained screen widths", async () => {
    const user = userEvent.setup();
    const handleToggle = vi.fn();

    render(
      <ContextRail
        isOpen={true}
        onToggle={handleToggle}
        title="Constrained Rail Title"
        forceDrawer={true}
      >
        <div>Drawer content here</div>
      </ContextRail>
    );

    // Rendered via Drawer primitive
    expect(screen.getByTestId("context-rail-drawer-content")).toBeInTheDocument();
    expect(screen.getByText("Drawer content here")).toBeInTheDocument();

    // Close button inside Drawer fires onToggle
    const closeBtn = screen.getByRole("button", { name: /close drawer/i });
    expect(closeBtn).toBeInTheDocument();
    await user.click(closeBtn);
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it("exports RightSidebar as an alias with backward compatibility", () => {
    expect(RightSidebar).toBe(ContextRail);
  });
});
