import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { FileLibraryView } from "../FileLibraryView";
import * as workspaceApi from "@/lib/workspaceApi";
import { FileAttachment } from "@graphmind/shared";

const files: FileAttachment[] = [
  {
    id: "f-1",
    name: "architecture-diagram.png",
    sizeBytes: 2048,
    mimeType: "image/png",
    fileCategory: "image",
    url: "/files/arch.png",
    metadata: { status: "ready" },
  },
  {
    id: "f-2",
    name: "raft-consensus.pdf",
    sizeBytes: 512000,
    mimeType: "application/pdf",
    fileCategory: "document",
    url: "/files/raft.pdf",
    metadata: { status: "ready" },
  },
];

describe("FileLibraryView ?file= focus (LSI-041)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(workspaceApi, "fetchWorkspaceFiles").mockResolvedValue(files);
  });

  it("highlights and scrolls to a deep-linked file result", async () => {
    const scrollSpy = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: scrollSpy,
    });

    render(<FileLibraryView workspaceId="ws-1" focusFileId="f-2" />);

    await screen.findByText("raft-consensus.pdf");
    const card = screen.getByTestId("file-library-card-f-2");
    expect(card.className).toContain("ring-2");

    await waitFor(() => expect(scrollSpy).toHaveBeenCalled());

    // Non-focused cards keep the default border treatment.
    expect(screen.getByTestId("file-library-card-f-1").className).not.toContain("ring-2");
  });
});
