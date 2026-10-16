import { afterEach, describe, expect, it, vi } from "vitest";
import { exportWorkspaceArchive } from "../exportUtils";

/**
 * LSI-045 — the client download wrapper for the server-owned workspace archive.
 *
 * The server already shapes and scrubs the payload; this locks the browser side:
 * a deterministic filename derived from the workspace title and pretty JSON.
 */

describe("LSI-045 exportWorkspaceArchive", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("downloads the archive as pretty JSON under a title-derived filename", () => {
    const OriginalBlob = globalThis.Blob;
    const captured: string[] = [];
    vi.stubGlobal(
      "Blob",
      function MockBlob(parts: BlobPart[], options?: BlobPropertyBag) {
        captured.push((parts as string[]).join(""));
        return new OriginalBlob(parts, options);
      },
    );
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: () => "blob:mock",
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: () => {},
    });
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const downloads: string[] = [];
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = createElement(tag);
      if (tag === "a") {
        Object.defineProperty(el, "download", {
          configurable: true,
          get: () => downloads[downloads.length - 1],
          set: (value: string) => downloads.push(value),
        });
      }
      return el;
    });

    exportWorkspaceArchive(
      {
        exportVersion: "1",
        exportedAt: "2026-10-16T00:00:00Z",
        workspace: { id: "ws-1", name: "Systems Design" },
        counts: { nodes: 1, edges: 0, concepts: 0, flashcards: 0, files: 0 },
        nodes: [{ id: "n1", content: "Explain event loops" }],
      },
      "Systems Design",
    );

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(downloads[downloads.length - 1]).toBe(
      "systems_design_workspace_export.json",
    );
    const text = captured.join("");
    expect(text).toContain('"exportVersion": "1"');
    expect(text).toContain('"content": "Explain event loops"');
  });

  it("uses the default filename when no title is supplied", () => {
    vi.stubGlobal("Blob", globalThis.Blob);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: () => "blob:mock",
    });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: () => {} });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const downloads: string[] = [];
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = createElement(tag);
      if (tag === "a") {
        Object.defineProperty(el, "download", {
          configurable: true,
          get: () => downloads[downloads.length - 1],
          set: (value: string) => downloads.push(value),
        });
      }
      return el;
    });

    exportWorkspaceArchive({ exportVersion: "1" });

    expect(downloads[downloads.length - 1]).toBe(
      "graphmind_workspace_workspace_export.json",
    );
  });
});
