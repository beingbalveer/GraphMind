import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildWorkspaceUrl,
  buildChatUrl,
  buildCanvasUrl,
  buildNodeUrl,
  buildBranchUrl,
  buildSettingsUrl,
} from "@/lib/urls";

describe("Routing & State Preservation Contract (Scope 3, Task 6)", () => {
  it("enforces canonical path hierarchy and zero primary IDs in query parameters", () => {
    const wsId = "ws-123";
    const chatId = "chat-456";

    // Workspace landing
    expect(buildWorkspaceUrl(wsId)).toBe("/w/ws-123");

    // Chat view
    expect(buildChatUrl(wsId, chatId)).toBe("/w/ws-123/chat/chat-456");

    // Canvas view — viewMode is strictly a path segment
    expect(buildCanvasUrl(wsId, chatId)).toBe("/w/ws-123/chat/chat-456/canvas");
    expect(buildSettingsUrl(wsId)).toBe("/w/ws-123/settings");

    // Deep link parameters are query params, but primary IDs stay in the path
    const nodeUrl = buildNodeUrl(wsId, chatId, "node-789");
    expect(nodeUrl).toBe("/w/ws-123/chat/chat-456?node=node-789");

    const branchUrl = buildBranchUrl(wsId, chatId, "leaf-abc");
    expect(branchUrl).toBe("/w/ws-123/chat/chat-456?branch=leaf-abc");

    // Never put workspaceId or chatId in query params
    for (const url of [buildWorkspaceUrl(wsId), buildChatUrl(wsId, chatId), buildCanvasUrl(wsId, chatId)]) {
      expect(url).not.toContain("?workspaceId=");
      expect(url).not.toContain("&workspaceId=");
      expect(url).not.toContain("?chatId=");
      expect(url).not.toContain("&chatId=");
    }
  });

  it("verifies zero usage of window.history.pushState or replaceState across all source files", () => {
    const srcDir = path.resolve(process.cwd(), "src");

    // Helper to scan production source files recursively (excluding tests)
    function scanFiles(dir: string, fileList: string[] = []): string[] {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== "__tests__") {
          scanFiles(fullPath, fileList);
        } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
          fileList.push(fullPath);
        }
      }
      return fileList;
    }

    const files = scanFiles(srcDir);
    expect(files.length).toBeGreaterThan(10);

    for (const filePath of files) {
      const content = readFileSync(filePath, "utf8");
      expect(
        content,
        `${path.relative(process.cwd(), filePath)} must never call history.pushState directly`
      ).not.toMatch(/\bhistory\.pushState\b/);

      expect(
        content,
        `${path.relative(process.cwd(), filePath)} must never call history.replaceState directly`
      ).not.toMatch(/\bhistory\.replaceState\b/);
    }
  });

  it("verifies legacy redirects are configured in next.config.ts", () => {
    const nextConfigContent = readFileSync(
      path.resolve(process.cwd(), "next.config.ts"),
      "utf8"
    );

    // /graph/:workspaceId -> /w/:workspaceId
    expect(nextConfigContent).toContain('source: "/graph/:workspaceId"');
    expect(nextConfigContent).toContain('destination: "/w/:workspaceId"');

    // /workspace/:workspaceId -> /w/:workspaceId
    expect(nextConfigContent).toContain('source: "/workspace/:workspaceId"');
  });

  it("verifies workspace layout preserves ChatContainer instance across sub-routes", () => {
    const layoutContent = readFileSync(
      path.resolve(process.cwd(), "src/app/w/[workspaceId]/layout.tsx"),
      "utf8"
    );

    // ChatContainer must be rendered in the layout, not unmounted on page transitions
    expect(layoutContent).toContain("<ChatContainer");
    expect(layoutContent).toContain("initialViewMode={viewMode}");
  });
});
