import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useChatStream } from "../useChatStream";

afterEach(() => {
  vi.unstubAllGlobals();
  globalThis.localStorage?.clear();
});

function stream(content: string) {
  return new Response(
    `event: token\ndata: ${JSON.stringify({ content })}\n\nevent: done\ndata: [DONE]\n\n`,
    { status: 200 },
  );
}

/**
 * LSI-039 — supported request behavior for the provider/model/system-skill
 * settings. A valid selection must reach the real request unchanged.
 */
it("forwards the selected provider, BYOK key, generation params, and system skill into the request", async () => {
  const fetcher = vi.fn().mockResolvedValue(stream("ok"));
  vi.stubGlobal("fetch", fetcher);
  const hook = renderHook(() => useChatStream());

  await act(async () => {
    await hook.result.current.sendMessage(
      "Research async runtimes",
      "openai",
      "gpt-4o-mini",
      {
        workspaceId: "ws-1",
        apiKey: "sk-byok-key",
        baseUrl: "http://localhost:11434/v1",
        temperature: 0.25,
        maxTokens: 2048,
        systemPrompt: "Be concise",
        enabledSkills: ["deep_research"],
      },
    );
  });

  const payload = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(payload).toMatchObject({
    provider: "openai",
    model: "gpt-4o-mini",
    api_key: "sk-byok-key",
    base_url: "http://localhost:11434/v1",
    temperature: 0.25,
    max_tokens: 2048,
    system_prompt: "Be concise",
    enabled_skills: ["deep_research"],
  });
});

it("omits the key and skill so an unconfigured selection falls back to the server", async () => {
  const fetcher = vi.fn().mockResolvedValue(stream("ok"));
  vi.stubGlobal("fetch", fetcher);
  const hook = renderHook(() => useChatStream());

  await act(async () => {
    await hook.result.current.sendMessage("Plain question", "gemini", "gemini-2.5-flash", {
      workspaceId: "ws-1",
    });
  });

  const payload = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(payload).toMatchObject({ provider: "gemini", model: "gemini-2.5-flash" });
  expect(payload).not.toHaveProperty("api_key");
  expect(payload).not.toHaveProperty("enabled_skills");
});
