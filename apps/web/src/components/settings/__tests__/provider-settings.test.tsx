import { act, render, renderHook, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { SettingsModal } from "../SettingsModal";
import { useModelConfig } from "@/hooks/useModelConfig";
import { exportTreeToJson } from "@/lib/exportUtils";
import type { ConversationTree } from "@graphmind/shared";

const LLM_STORAGE_KEY = "graphmind:llm-config";

/**
 * LSI-039 — Provider, model, and system-skill settings.
 *
 * Locks the mocked provider matrix/settings surface and the browser-local key
 * model: a valid selection is mapped onto the saved configuration, the secret
 * lives only in local browser storage, and it never reaches an export artifact.
 */

describe("LSI-039 provider matrix settings", () => {
  it("exposes every supported provider and maps the selection onto the saved config", () => {
    vi.useFakeTimers();
    const onSaveConfig = vi.fn();
    render(
      <SettingsModal
        isOpen
        onClose={vi.fn()}
        config={{
          provider: "gemini",
          model: "gemini-2.5-flash",
          temperature: 0.7,
          maxTokens: 4096,
          systemPrompt: "",
          geminiApiKey: "",
          openaiApiKey: "",
          anthropicApiKey: "",
          deepseekApiKey: "",
          ollamaBaseUrl: "http://localhost:11434/v1",
        }}
        onSaveConfig={onSaveConfig}
        onResetDefaults={vi.fn()}
      />,
    );

    for (const name of [
      "Google Gemini",
      "Anthropic Claude",
      "OpenAI GPT",
      "DeepSeek",
      "Ollama",
      "Mock Engine",
    ]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }

    fireEvent.click(screen.getByText("OpenAI GPT"));
    fireEvent.change(screen.getByPlaceholderText("sk-proj-..."), {
      target: { value: "  sk-live-openai-key  " },
    });
    fireEvent.click(screen.getByText("GPT-4o Mini"));
    fireEvent.click(screen.getByRole("button", { name: /Save changes/i }));

    expect(onSaveConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openai",
        model: "gpt-4o-mini",
        openaiApiKey: "sk-live-openai-key",
      }),
    );
    vi.useRealTimers();
  });
});

describe("LSI-039 browser-local key model", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores the key only in localStorage and resolves it per provider without any network call", () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => useModelConfig());

    act(() => {
      result.current.updateConfig({
        provider: "anthropic",
        anthropicApiKey: "  sk-ant-secret  ",
      });
    });

    // Resolved for the matching provider, trimmed; absent for everyone else.
    expect(result.current.getEffectiveApiKey("anthropic")).toBe("sk-ant-secret");
    expect(result.current.getEffectiveApiKey("claude")).toBe("sk-ant-secret");
    expect(result.current.getEffectiveApiKey("openai")).toBeUndefined();
    expect(result.current.getEffectiveApiKey("mystery-provider")).toBeUndefined();
    expect(result.current.getEffectiveBaseUrl("ollama")).toBe(
      "http://localhost:11434/v1",
    );

    // The secret is durable in the browser, never uploaded to server storage.
    expect(localStorage.getItem(LLM_STORAGE_KEY)).toContain("sk-ant-secret");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("drops a blank key so the server fallback stays in effect", () => {
    const { result } = renderHook(() => useModelConfig());
    act(() => {
      result.current.updateConfig({ geminiApiKey: "   " });
    });
    expect(result.current.getEffectiveApiKey("gemini")).toBeUndefined();
  });
});

describe("LSI-039 secrets never enter exports", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("exports the conversation graph (provider/model) but never a secret", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/exportUtils.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/api[_-]?key/i);
    expect(source).not.toMatch(/llmConfig/);

    const OriginalBlob = globalThis.Blob;
    const captured: string[] = [];
    vi.stubGlobal(
      "Blob",
      function MockBlob(parts: BlobPart[]) {
        captured.push((parts as string[]).join(""));
        return new OriginalBlob(parts);
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
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const tree: ConversationTree = {
      id: "tree-1",
      rootNodeId: "n1",
      activeNodeId: "n2",
      createdAt: "2026-10-16T00:00:00Z",
      updatedAt: "2026-10-16T00:00:00Z",
      nodes: {
        n1: {
          id: "n1",
          parentId: null,
          childrenIds: ["n2"],
          role: "user",
          content: "Explain event loops",
          createdAt: "2026-10-16T00:00:00Z",
          provider: "openai",
          model: "gpt-4o-mini",
        },
        n2: {
          id: "n2",
          parentId: "n1",
          childrenIds: [],
          role: "assistant",
          content: "An event loop schedules callbacks.",
          createdAt: "2026-10-16T00:00:01Z",
          provider: "openai",
          model: "gpt-4o-mini",
        },
      },
    };

    exportTreeToJson(tree);
    const text = captured.join("");

    expect(text).toContain('"provider": "openai"');
    expect(text).toContain('"model": "gpt-4o-mini"');
    expect(text).not.toMatch(/api[_-]?key/i);
    expect(text).not.toContain("sk-");
  });
});
