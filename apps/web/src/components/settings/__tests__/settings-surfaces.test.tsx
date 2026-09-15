import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { SettingsModal } from "../SettingsModal";
import { WorkspaceModal } from "../../workspace/WorkspaceModal";
import * as workspaceApi from "@/lib/workspaceApi";
import { DEFAULT_LLM_CONFIG } from "@/hooks/useModelConfig";

describe("Settings and Account Surfaces - Primitives Compliance", () => {
  const surfaces = [
    { name: "SettingsModal", file: path.resolve(__dirname, "..", "SettingsModal.tsx") },
    { name: "WorkspaceModal", file: path.resolve(__dirname, "../../workspace", "WorkspaceModal.tsx") },
  ];

  it("ensures zero raw <button> elements across settings and workspace modals", () => {
    surfaces.forEach(({ name, file }) => {
      const content = fs.readFileSync(file, "utf-8");
      const rawButtonMatches = content.match(/<button[\s>]/g);
      expect(rawButtonMatches, `Found raw <button> in ${name}`).toBeNull();
    });
  });

  it("ensures zero hardcoded zinc- color classes in settings and workspace modals", () => {
    surfaces.forEach(({ name, file }) => {
      const content = fs.readFileSync(file, "utf-8");
      const zincMatches = content.match(/\bzinc-\d+\b/g);
      expect(zincMatches, `Found zinc classes in ${name}`).toBeNull();
    });
  });
});

describe("SettingsModal Component", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    config: DEFAULT_LLM_CONFIG,
    onSaveConfig: vi.fn(),
    onResetDefaults: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders settings modal and allows navigating between sections", () => {
    render(<SettingsModal {...defaultProps} />);

    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getAllByText("Models & AI").length).toBeGreaterThan(0);

    const shortcutsTab = screen.getByRole("button", { name: /Shortcuts/i });
    fireEvent.click(shortcutsTab);

    expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument();
    expect(screen.getByText("Toggle Left Sidebar")).toBeInTheDocument();
  });

  it("shows unsaved changes badge when configuration is modified", () => {
    render(<SettingsModal {...defaultProps} />);

    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();

    const tempInput = screen.getByDisplayValue(String(DEFAULT_LLM_CONFIG.temperature));
    fireEvent.change(tempInput, { target: { value: "0.2" } });

    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("validates Ollama server URL and shows error if invalid", async () => {
    render(<SettingsModal {...defaultProps} />);

    // Switch to Ollama provider
    const ollamaCard = screen.getByText("Ollama");
    fireEvent.click(ollamaCard);

    // Enter invalid URL
    const urlInput = screen.getByPlaceholderText("http://localhost:11434/v1");
    fireEvent.change(urlInput, { target: { value: "not-a-valid-url" } });

    const saveBtn = screen.getByRole("button", { name: /Save changes/i });
    fireEvent.click(saveBtn);

    expect(
      screen.getByText("Invalid Ollama Server URL. Please enter a valid http:// or https:// URL.")
    ).toBeInTheDocument();
    expect(defaultProps.onSaveConfig).not.toHaveBeenCalled();
  });

  it("opens ConfirmDialog on reset to defaults and invokes reset when confirmed", () => {
    render(<SettingsModal {...defaultProps} />);

    const resetBtn = screen.getByTitle("Reset to default settings");
    fireEvent.click(resetBtn);

    expect(screen.getByText("Reset settings to defaults")).toBeInTheDocument();
    expect(
      screen.getByText("Are you sure you want to reset all model settings and preferences? Custom API keys and endpoints will be removed.")
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Reset Defaults" });
    fireEvent.click(confirmBtn);

    expect(defaultProps.onResetDefaults).toHaveBeenCalled();
  });
});

describe("WorkspaceModal Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders workspaces and opens confirmation before deleting", async () => {
    vi.spyOn(workspaceApi, "fetchWorkspaces").mockResolvedValue([
      {
        id: "ws-1",
        name: "Algorithms & DS",
        description: "Graphs and trees",
        nodeCount: 10,
        viewportX: 0,
        viewportY: 0,
        zoom: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    const deleteSpy = vi.spyOn(workspaceApi, "deleteWorkspace").mockResolvedValue(true);

    render(
      <WorkspaceModal
        isOpen={true}
        onClose={vi.fn()}
        currentWorkspace={null}
        onSelectWorkspace={vi.fn()}
        activeTree={null}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Algorithms & DS")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Select Algorithms & DS" })).toBeVisible();

    const deleteBtn = screen.getByLabelText("Delete Workspace");
    fireEvent.click(deleteBtn);

    expect(screen.getByText("Delete workspace")).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete this workspace/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith("ws-1");
    });
  });
});
