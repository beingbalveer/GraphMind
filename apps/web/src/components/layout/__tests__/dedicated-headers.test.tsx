import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LibraryHeader } from "../LibraryHeader";
import { SettingsHeader } from "../SettingsHeader";

describe("Dedicated Headers (LibraryHeader & SettingsHeader)", () => {
  it("enforces zero raw <button> elements and semantic tokens", () => {
    const files = ["LibraryHeader.tsx", "SettingsHeader.tsx"];

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

  describe("LibraryHeader", () => {
    it("renders library title directly with total files count badge and no workspace label", () => {
      render(
        <LibraryHeader
          totalFilesCount={42}
        />
      );

      expect(screen.getByText("File Library")).toBeInTheDocument();
      expect(screen.getByText("42 files")).toBeInTheDocument();
      expect(screen.queryByText("Workspace")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /back to chat/i })).not.toBeInTheDocument();
    });

    it("toggles mobile navigation", async () => {
      const handleToggleSidebar = vi.fn();
      render(
        <LibraryHeader
          isSidebarOpen={false}
          onToggleSidebar={handleToggleSidebar}
        />
      );

      const toggleBtn = screen.getByRole("button", { name: /open navigation/i });
      await userEvent.click(toggleBtn);
      expect(handleToggleSidebar).toHaveBeenCalledOnce();
    });
  });

  describe("SettingsHeader", () => {
    it("renders settings title directly and no workspace label", () => {
      render(<SettingsHeader />);

      expect(screen.getByText("Settings")).toBeInTheDocument();
      expect(screen.queryByText("Workspace")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /back to chat/i })).not.toBeInTheDocument();
    });

    it("toggles mobile navigation", async () => {
      const handleToggleSidebar = vi.fn();
      render(
        <SettingsHeader
          isSidebarOpen={false}
          onToggleSidebar={handleToggleSidebar}
        />
      );

      const toggleBtn = screen.getByRole("button", { name: /open navigation/i });
      await userEvent.click(toggleBtn);
      expect(handleToggleSidebar).toHaveBeenCalledOnce();
    });
  });
});
