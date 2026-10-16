import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsPage } from "../SettingsPage";
import type { LLMConfig } from "@/hooks/useModelConfig";
import { DEFAULT_PREFERENCES } from "@/lib/preferencesApi";
import type { WorkspaceItem } from "@/lib/workspaceApi";

/**
 * LSI-045 — Owned data export and destructive-action boundaries.
 *
 * Locks the settings surface: exporting downloads the caller-owned, versioned
 * archive through the injected handler, a failed export keeps the UI consistent
 * and reports an error, and the local settings reset is clearly distinguished
 * from account/workspace deletion.
 */

const config: LLMConfig = {
  provider: "gemini",
  model: "gemini-2.5-flash",
  temperature: 0.7,
  maxTokens: 4096,
  systemPrompt: "",
  geminiApiKey: "",
  openaiApiKey: "",
  anthropicApiKey: "",
  deepseekApiKey: "",
  ollamaBaseUrl: "http://localhost:11434",
};

const workspace: WorkspaceItem = {
  id: "ws-1",
  name: "Systems Design",
  description: "Distributed systems notes",
  viewportX: 0,
  viewportY: 0,
  zoom: 1,
  nodeCount: 12,
  createdAt: "2026-10-16T00:00:00Z",
  updatedAt: "2026-10-16T00:00:00Z",
};

function renderSettings(overrides: {
  onExportWorkspace?: () => Promise<void>;
  currentWorkspace?: WorkspaceItem | null;
} = {}) {
  const onExportWorkspace = overrides.onExportWorkspace ?? vi.fn().mockResolvedValue(undefined);
  render(
    <SettingsPage
      config={config}
      onSaveConfig={vi.fn()}
      onResetDefaults={vi.fn()}
      onNavigateBack={vi.fn()}
      preferences={DEFAULT_PREFERENCES}
      onSavePreferences={vi.fn()}
      currentWorkspace={
        overrides.currentWorkspace === undefined ? workspace : overrides.currentWorkspace
      }
      onExportWorkspace={onExportWorkspace}
    />,
  );
  return onExportWorkspace;
}

describe("LSI-045 owned data export", () => {
  it("exports the current workspace through the injected handler", async () => {
    const onExportWorkspace = renderSettings();

    fireEvent.click(screen.getByRole("tab", { name: "Workspaces" }));
    fireEvent.click(await screen.findByRole("button", { name: /Export data/ }));

    expect(onExportWorkspace).toHaveBeenCalledTimes(1);
  });

  it("reports a failed export without locking the surface", async () => {
    const onExportWorkspace = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(undefined);
    renderSettings({ onExportWorkspace });

    fireEvent.click(screen.getByRole("tab", { name: "Workspaces" }));
    const button = await screen.findByRole("button", { name: /Export data/ });
    fireEvent.click(button);

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not export/i);

    // The control stays usable so the learner can retry without reloading.
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onExportWorkspace).toHaveBeenCalledTimes(2);
  });

  it("disables export when no workspace is in scope", async () => {
    renderSettings({ currentWorkspace: null });
    fireEvent.click(screen.getByRole("tab", { name: "Workspaces" }));
    expect(await screen.findByRole("button", { name: /Export data/ })).toBeDisabled();
  });
});

describe("LSI-045 destructive-action boundaries", () => {
  it("labels the local reset as non-destructive and distinct from deletion", () => {
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: /Reset to defaults/ }));

    expect(screen.getByText("Reset local settings")).toBeInTheDocument();
    expect(
      screen.getByText(/does not delete your account, workspaces, or conversations/i),
    ).toBeInTheDocument();
  });

  it("explains that export never includes credentials or internal storage", async () => {
    renderSettings();
    fireEvent.click(screen.getByRole("tab", { name: "Workspaces" }));

    expect(
      await screen.findByText(/provider keys and internal storage are never included/i),
    ).toBeInTheDocument();
  });
});
