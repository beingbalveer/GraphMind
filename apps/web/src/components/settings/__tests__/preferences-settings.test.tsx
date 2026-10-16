import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SettingsPage } from "../SettingsPage";
import type { LLMConfig } from "@/hooks/useModelConfig";
import { DEFAULT_PREFERENCES } from "@/lib/preferencesApi";

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

function renderSettings(onSavePreferences = vi.fn()) {
  render(
    <SettingsPage
      config={config}
      onSaveConfig={vi.fn()}
      onResetDefaults={vi.fn()}
      onNavigateBack={vi.fn()}
      preferences={DEFAULT_PREFERENCES}
      onSavePreferences={onSavePreferences}
    />,
  );
  return onSavePreferences;
}

describe("LSI-044 authenticated preferences settings", () => {
  it("removes the demo-only placeholder settings", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("tab", { name: "General" }));
    fireEvent.click(screen.getByRole("tab", { name: "Appearance" }));

    expect(screen.queryByText(/planned for a future release/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Auto-scroll")).not.toBeInTheDocument();
    expect(screen.queryByText("Math rendering")).not.toBeInTheDocument();
    expect(screen.queryByText("Compact density")).not.toBeInTheDocument();
  });

  it("persists theme, reading, motion, study-hours, and tutor-style changes", async () => {
    const user = userEvent.setup();
    const onSavePreferences = renderSettings();

    // Appearance — theme, reading size, reduced motion.
    fireEvent.click(screen.getByRole("tab", { name: "Appearance" }));
    await user.click(screen.getByRole("combobox", { name: "Theme" }));
    await user.click(await screen.findByRole("option", { name: "Dark" }));
    fireEvent.click(screen.getByRole("tab", { name: "Large" }));
    fireEvent.click(screen.getByRole("switch", { name: "Reduced motion" }));

    // General — study hours and tutor style.
    fireEvent.click(screen.getByRole("tab", { name: "General" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Weekly study time" }), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("tab", { name: "Detailed" }));

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSavePreferences).toHaveBeenCalledTimes(1);
    expect(onSavePreferences).toHaveBeenCalledWith({
      theme: "dark",
      readingFontSize: "lg",
      reducedMotion: true,
      defaultStudyHours: 10,
      tutorStyle: "detailed",
    });
  });

  it("does not call the preferences save when nothing changed", () => {
    const onSavePreferences = renderSettings();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(onSavePreferences).not.toHaveBeenCalled();
  });
});
