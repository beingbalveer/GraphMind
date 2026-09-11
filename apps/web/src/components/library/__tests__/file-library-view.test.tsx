import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { FileLibraryView } from "../FileLibraryView";
import * as workspaceApi from "@/lib/workspaceApi";
import { FileAttachment } from "@graphmind/shared";

describe("FileLibraryView Full-Page Component", () => {
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

  it("ensures zero raw <button> and zero hardcoded zinc classes in FileLibraryView.tsx", () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, "..", "FileLibraryView.tsx"),
      "utf-8"
    );
    expect(content.match(/<button[\s>]/g)).toBeNull();
    expect(content.match(/\bzinc-\d+\b/g)).toBeNull();
  });

  it("renders full-page view with title, files, and distinct status badges", async () => {
    vi.spyOn(workspaceApi, "fetchWorkspaceFiles").mockResolvedValue(mockFiles);

    render(<FileLibraryView workspaceId="ws-1" />);

    await waitFor(() => {
      expect(screen.getByText("File Library & Knowledge Assets")).toBeInTheDocument();
      expect(screen.getByText("architecture-diagram.png")).toBeInTheDocument();
    });

    expect(screen.getByText("data-analysis.csv")).toBeInTheDocument();
    expect(screen.getByText("broken-spec.pdf")).toBeInTheDocument();
    expect(screen.getByText("archived-notes.txt")).toBeInTheDocument();

    // Verify status badges
    expect(screen.getByText("Processing")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
  });

  it("triggers onBack when back button is rendered and clicked", async () => {
    vi.spyOn(workspaceApi, "fetchWorkspaceFiles").mockResolvedValue([]);
    const handleBack = vi.fn();

    render(<FileLibraryView workspaceId="ws-1" onBack={handleBack} />);

    const backBtn = screen.getByRole("button", { name: "Back to chat" });
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(handleBack).toHaveBeenCalledTimes(1);
  });

  it("filters files when typing in the search input", async () => {
    vi.spyOn(workspaceApi, "fetchWorkspaceFiles").mockResolvedValue(mockFiles);

    render(<FileLibraryView workspaceId="ws-1" />);

    await waitFor(() => {
      expect(screen.getByText("architecture-diagram.png")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Filter by name...");
    fireEvent.change(searchInput, { target: { value: "data-analysis" } });

    expect(screen.getByText("data-analysis.csv")).toBeInTheDocument();
    expect(screen.queryByText("architecture-diagram.png")).not.toBeInTheDocument();
  });

  it("triggers ConfirmDialog when clicking delete on a file card", async () => {
    vi.spyOn(workspaceApi, "fetchWorkspaceFiles").mockResolvedValue([mockFiles[0]]);
    const deleteSpy = vi.spyOn(workspaceApi, "deleteWorkspaceFile").mockResolvedValue(true);

    render(<FileLibraryView workspaceId="ws-1" />);

    await waitFor(() => {
      expect(screen.getByText("architecture-diagram.png")).toBeInTheDocument();
    });

    const deleteBtn = screen.getByRole("button", { name: "Delete architecture-diagram.png" });
    fireEvent.click(deleteBtn);

    // Confirm dialog should appear
    expect(screen.getByText("Delete file permanently?")).toBeInTheDocument();

    // Confirm deletion
    const confirmBtn = screen.getByRole("button", { name: "Delete File" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith("ws-1", "f-1");
    });
  });
});
