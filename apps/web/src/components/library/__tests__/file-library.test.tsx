import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { FileLibraryModal } from "../FileLibraryModal";
import * as workspaceApi from "@/lib/workspaceApi";
import { FileAttachment } from "@graphmind/shared";

describe("File Library & Source Surfaces - Primitives & Compliance", () => {
  const surfaces = [
    { name: "FileLibraryModal", dir: "..", file: "FileLibraryModal.tsx" },
    { name: "CodeViewerModal", dir: "../../chat", file: "CodeViewerModal.tsx" },
    { name: "PdfViewerModal", dir: "../../chat", file: "PdfViewerModal.tsx" },
    { name: "TableViewerModal", dir: "../../chat", file: "TableViewerModal.tsx" },
  ];

  it("ensures zero raw <button> tags across all file library and viewer surfaces", () => {
    surfaces.forEach(({ name, dir, file }) => {
      const content = fs.readFileSync(path.resolve(__dirname, dir, file), "utf-8");
      const rawButtonMatches = content.match(/<button[\s>]/g);
      expect(rawButtonMatches, `Found raw <button> in ${name} (${file})`).toBeNull();
    });
  });

  it("ensures zero hardcoded zinc- color classes in library components", () => {
    const content = fs.readFileSync(path.resolve(__dirname, "..", "FileLibraryModal.tsx"), "utf-8");
    const zincMatches = content.match(/\bzinc-\d+\b/g);
    expect(zincMatches, "Found zinc classes in FileLibraryModal.tsx").toBeNull();
  });
});

describe("FileLibraryModal Component", () => {
  const mockFiles: FileAttachment[] = [
    {
      id: "f-1",
      name: "architecture-diagram.png",
      sizeBytes: 204800,
      mimeType: "image/png",
      fileCategory: "image",
      url: "/files/arch.png",
      metadata: { status: "ready" },
    },
    {
      id: "f-2",
      name: "data-analysis.csv",
      sizeBytes: 10240,
      mimeType: "text/csv",
      fileCategory: "tabular",
      url: "/files/data.csv",
      metadata: { status: "processing", row_count: 50 },
    },
    {
      id: "f-3",
      name: "broken-spec.pdf",
      sizeBytes: 512000,
      mimeType: "application/pdf",
      fileCategory: "document",
      url: "/files/broken.pdf",
      metadata: { status: "failed" },
    },
    {
      id: "f-4",
      name: "archived-notes.txt",
      sizeBytes: 4096,
      mimeType: "text/plain",
      fileCategory: "code",
      extractedText: "Some notes...",
      metadata: { status: "unavailable" },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders file list with distinct status badges (ready, processing, failed, unavailable)", async () => {
    vi.spyOn(workspaceApi, "fetchWorkspaceFiles").mockResolvedValue(mockFiles);

    render(
      <FileLibraryModal
        isOpen={true}
        onClose={vi.fn()}
        workspaceId="ws-1"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("architecture-diagram.png")).toBeInTheDocument();
    });

    expect(screen.getByText("data-analysis.csv")).toBeInTheDocument();
    expect(screen.getByText("broken-spec.pdf")).toBeInTheDocument();
    expect(screen.getByText("archived-notes.txt")).toBeInTheDocument();

    // Verify status indicators
    expect(screen.getByText("processing")).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
    expect(screen.getByText("unavailable")).toBeInTheDocument();
  });

  it("filters files by search query", async () => {
    vi.spyOn(workspaceApi, "fetchWorkspaceFiles").mockResolvedValue(mockFiles);

    render(
      <FileLibraryModal
        isOpen={true}
        onClose={vi.fn()}
        workspaceId="ws-1"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("architecture-diagram.png")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search files...");
    fireEvent.change(searchInput, { target: { value: "data-analysis" } });

    expect(screen.getByText("data-analysis.csv")).toBeInTheDocument();
    expect(screen.queryByText("architecture-diagram.png")).not.toBeInTheDocument();
  });

  it("triggers ConfirmDialog on delete and deletes file when confirmed", async () => {
    vi.spyOn(workspaceApi, "fetchWorkspaceFiles").mockResolvedValue(mockFiles);
    const deleteSpy = vi.spyOn(workspaceApi, "deleteWorkspaceFile").mockResolvedValue(true);

    render(
      <FileLibraryModal
        isOpen={true}
        onClose={vi.fn()}
        workspaceId="ws-1"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("architecture-diagram.png")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByLabelText("Delete file");
    expect(deleteButtons.length).toBeGreaterThan(0);

    fireEvent.click(deleteButtons[0]);

    // Confirm dialog must appear
    expect(screen.getByText("Delete file from library")).toBeInTheDocument();
    expect(
      screen.getByText('Are you sure you want to delete "architecture-diagram.png" from this workspace library? This action cannot be undone.')
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Delete File" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith("ws-1", "f-1");
    });
  });

  it("renders EmptyState when no files match", async () => {
    vi.spyOn(workspaceApi, "fetchWorkspaceFiles").mockResolvedValue([]);

    render(
      <FileLibraryModal
        isOpen={true}
        onClose={vi.fn()}
        workspaceId="ws-1"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("No files in this category")).toBeInTheDocument();
    });

    expect(screen.getByText("Upload files")).toBeInTheDocument();
  });
});
