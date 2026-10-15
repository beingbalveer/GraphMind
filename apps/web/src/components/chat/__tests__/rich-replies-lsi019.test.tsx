import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useChatStream } from "@/hooks/useChatStream";
import { MarkdownRenderer } from "../ChatMessage";

afterEach(() => {
  vi.unstubAllGlobals();
  globalThis.localStorage?.clear();
});

const encoder = new TextEncoder();

const tokenChunk = (content: string) =>
  encoder.encode(`event: token\ndata: ${JSON.stringify({ content })}\n\n`);

const doneChunk = () => encoder.encode("event: done\ndata: [DONE]\n\n");

function controlledStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const readable = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  return { readable, controller };
}

describe("LSI-019 rich replies — SSE content parity", () => {
  it("agrees between each incremental streamed chunk and the final reply content", async () => {
    const { readable, controller } = controlledStream();
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(readable, { status: 200 }));
    vi.stubGlobal("fetch", fetcher);

    const hook = renderHook(() => useChatStream());
    const assistantContent = () => {
      const tree = hook.result.current.tree;
      if (!tree) return "";
      return (
        Object.values(tree.nodes).find((node) => node.role === "assistant")
          ?.content ?? ""
      );
    };

    let sendPromise!: Promise<unknown>;
    await act(async () => {
      sendPromise = hook.result.current.sendMessage(
        "Teach me streamed replies",
        "gemini",
        "gemini-2.5-flash",
      );
    });

    // Incremental token 1
    await act(async () => {
      controller.enqueue(tokenChunk("**Bold** "));
      await Promise.resolve();
    });
    expect(assistantContent()).toBe("**Bold** ");

    // Incremental token 2
    await act(async () => {
      controller.enqueue(tokenChunk("and `code`."));
      await Promise.resolve();
    });
    expect(assistantContent()).toBe("**Bold** and `code`.");

    // Finalise the stream
    await act(async () => {
      controller.enqueue(doneChunk());
      controller.close();
      await sendPromise;
    });

    const finalContent = assistantContent();
    expect(finalContent).toBe("**Bold** and `code`.");

    // The rendered final reply agrees with the streamed incremental content.
    render(<MarkdownRenderer content={finalContent} />);
    expect(screen.getByText("Bold").tagName).toBe("STRONG");
    expect(screen.getByText("code")).toHaveClass("bg-muted");
  });
});

describe("LSI-019 rich replies — unsafe markup and links", () => {
  it("blocks raw HTML injection and unsafe link protocols", () => {
    const { container } = render(
      <MarkdownRenderer
        content={[
          "[danger](javascript:alert(1))",
          "",
          "[data](data:text/html,<script>alert(1)</script>)",
          "",
          "<script>window.__lsi019 = 1</script>",
          "",
          '<img src="x" onerror="window.__lsi019 = 2" />',
        ].join("\n")}
      />,
    );

    // Raw HTML is never mounted as live DOM.
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();

    // Unsafe protocols are stripped before the anchor renderer runs.
    const dangerLink = screen.getByText("danger").closest("a");
    expect(dangerLink).not.toBeNull();
    expect((dangerLink?.getAttribute("href") ?? "").toLowerCase()).not.toContain(
      "javascript:",
    );
    const dataLink = screen.getByText("data").closest("a");
    expect((dataLink?.getAttribute("href") ?? "").toLowerCase()).not.toContain(
      "data:",
    );

    expect(
      (window as unknown as Record<string, unknown>).__lsi019,
    ).toBeUndefined();
  });

  it("keeps safe external links with noopener protection", () => {
    render(<MarkdownRenderer content="[docs](https://example.com/guide)" />);

    const link = screen.getByText("docs").closest("a");
    expect(link).toHaveAttribute("href", "https://example.com/guide");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});

describe("LSI-019 rich replies — reused renderers", () => {
  it("reuses the quiz renderer for a fenced quiz block", () => {
    render(
      <MarkdownRenderer
        content={
          "```quiz\n" +
          JSON.stringify({
            concept: "Event loop",
            question: "What does the event loop do?",
            options: [
              { id: "A", text: "Schedules callbacks", isCorrect: true },
              { id: "B", text: "Compiles bytecode", isCorrect: false },
            ],
          }) +
          "\n```"
        }
      />,
    );

    expect(screen.getByText("Interactive Quiz")).toBeVisible();
    expect(screen.getByText("What does the event loop do?")).toBeVisible();
  });

  it("renders fenced code with a copy control", () => {
    render(<MarkdownRenderer content={'```python\nprint("hi")\n```'} />);

    expect(screen.getByText("python")).toBeVisible();
    expect(screen.getByTitle("Copy code")).toBeVisible();
  });
});
