import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SettingsPage } from "../SettingsPage";
import type { LLMConfig } from "@/hooks/useModelConfig";

const config: LLMConfig = {
  provider: "gemini", model: "gemini-2.5-flash", temperature: 0.7, maxTokens: 4096,
  systemPrompt: "", geminiApiKey: "", openaiApiKey: "", anthropicApiKey: "", deepseekApiKey: "", ollamaBaseUrl: "http://localhost:11434",
};

describe("SettingsPage", () => {
  it("renders a page surface and saves model configuration", async () => {
    const user = userEvent.setup();
    const onSaveConfig = vi.fn();
    render(<SettingsPage config={config} onSaveConfig={onSaveConfig} onResetDefaults={vi.fn()} onNavigateBack={vi.fn()} />);

    expect(screen.getByRole("main", { name: "Settings" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Settings" })).not.toBeInTheDocument();
    await user.clear(screen.getByRole("spinbutton", { name: "Temperature" }));
    await user.type(screen.getByRole("spinbutton", { name: "Temperature" }), "1.1");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSaveConfig).toHaveBeenCalledWith(expect.objectContaining({ temperature: 1.1 }));
  });
});
