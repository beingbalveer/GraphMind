import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Scope 4 Product Surfaces - Master Verification Gate", () => {
  const surfacesDirectory = path.resolve(__dirname, "..");

  const scope4Files = [
    // Task 1: Learning Dashboard & Roadmap
    "workspace/WorkspaceDashboard.tsx",
    "workspace/RoadmapModal.tsx",
    // Task 2: Knowledge Canvas
    "canvas/GraphCanvas.tsx",
    "canvas/ThreadGraphNode.tsx",
    "canvas/FocusDrawer.tsx",
    "canvas/TimelineReplayBar.tsx",
    "canvas/CommandPalette.tsx",
    "canvas/CustomBranchEdge.tsx",
    "canvas/MindMapEdge.tsx",
    // Task 3: File Library & Viewers
    "library/FileLibraryModal.tsx",
    // Task 4: Settings & Workspace Modals
    "settings/SettingsModal.tsx",
    "workspace/WorkspaceModal.tsx",
    // Task 5 & 6: Auxiliary Panels & Learning Signals
    "chat/BranchChatPane.tsx",
    "chat/QuizCard.tsx",
    "chat/SidePeekBranchSheet.tsx",
    "chat/MasteryPanel.tsx",
    "tree/TreeSidebar.tsx",
  ];

  it("ensures 100% of Scope 4 surface components exist and can be read", () => {
    scope4Files.forEach((relPath) => {
      const fullPath = path.join(surfacesDirectory, relPath);
      expect(fs.existsSync(fullPath), `Missing surface component: ${relPath}`).toBe(true);
    });
  });

  it("strictly enforces ZERO raw <button> elements across all Scope 4 surface components", () => {
    const violations: { file: string; line: number; match: string }[] = [];

    scope4Files.forEach((relPath) => {
      const fullPath = path.join(surfacesDirectory, relPath);
      const content = fs.readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");

      lines.forEach((line, idx) => {
        // Matches raw <button followed by space or > (excluding Button component)
        if (/<button[\s>]/.test(line)) {
          violations.push({
            file: relPath,
            line: idx + 1,
            match: line.trim(),
          });
        }
      });
    });

    expect(
      violations,
      `Found raw <button> elements in Scope 4 surfaces:\n${violations
        .map((v) => `${v.file}:${v.line} -> ${v.match}`)
        .join("\n")}`
    ).toEqual([]);
  });

  it("strictly enforces ZERO hardcoded zinc- color classes across all Scope 4 surface components", () => {
    const violations: { file: string; line: number; match: string }[] = [];

    scope4Files.forEach((relPath) => {
      const fullPath = path.join(surfacesDirectory, relPath);
      const content = fs.readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");

      lines.forEach((line, idx) => {
        const matches = line.match(/\bzinc-\d+\b/g);
        if (matches) {
          violations.push({
            file: relPath,
            line: idx + 1,
            match: matches.join(", "),
          });
        }
      });
    });

    expect(
      violations,
      `Found hardcoded zinc- color classes in Scope 4 surfaces:\n${violations
        .map((v) => `${v.file}:${v.line} -> ${v.match}`)
        .join("\n")}`
    ).toEqual([]);
  });

  it("ensures all destructive operations in Scope 4 surfaces consume the shared ConfirmDialog", () => {
    const surfacesWithDestructiveActions = [
      "canvas/ThreadGraphNode.tsx",
      "library/FileLibraryModal.tsx",
      "settings/SettingsModal.tsx",
      "workspace/WorkspaceModal.tsx",
      "chat/BranchChatPane.tsx",
      "chat/SidePeekBranchSheet.tsx",
    ];

    surfacesWithDestructiveActions.forEach((relPath) => {
      const fullPath = path.join(surfacesDirectory, relPath);
      const content = fs.readFileSync(fullPath, "utf-8");
      expect(
        content.includes("ConfirmDialog"),
        `Surface ${relPath} has destructive operations but does not import ConfirmDialog`
      ).toBe(true);
    });
  });

  it("verifies dark mode and theme token usage in Scope 4 surfaces", () => {
    scope4Files.forEach((relPath) => {
      const fullPath = path.join(surfacesDirectory, relPath);
      const content = fs.readFileSync(fullPath, "utf-8");

      // Verify each component utilizes semantic tokens or semantic SVG CSS variables
      const hasSemanticTokens =
        content.includes("bg-surface") ||
        content.includes("bg-background") ||
        content.includes("bg-muted") ||
        content.includes("bg-primary") ||
        content.includes("bg-card") ||
        content.includes("var(--border");

      expect(
        hasSemanticTokens,
        `Surface ${relPath} should utilize semantic tokens for dark-mode support`
      ).toBe(true);
    });
  });
});
