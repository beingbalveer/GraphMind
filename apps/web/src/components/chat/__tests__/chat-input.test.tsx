import { readFileSync } from "node:fs";
import path from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChatInput } from "@/components/chat/ChatInput";
import * as workspaceApi from "@/lib/workspaceApi";

const baseProps = {
  onSendMessage: vi.fn(),
  onStopStreaming: vi.fn(),
  isStreaming: false,
};

describe("ChatInput", () => {
  it("submits with Enter and preserves Shift+Enter", async () => {
    const user = userEvent.setup();
    const onSendMessage = vi.fn();
    render(<ChatInput {...baseProps} onSendMessage={onSendMessage} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "Explain branching");
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    expect(input).toHaveValue("Explain branching\n");
    await user.type(input, "with context");
    await user.keyboard("{Enter}");

    expect(onSendMessage).toHaveBeenCalledWith("Explain branching\nwith context", [], null);
  });

  it("ingests an attached file through the workspace library and sends it with the message", async () => {
    const uploadSpy = vi
      .spyOn(workspaceApi, "uploadWorkspaceFile")
      .mockResolvedValue({
        id: "file_abc",
        name: "notes.txt",
        sizeBytes: 11,
        mimeType: "text/plain",
        fileCategory: "code",
        url: "http://api.local/api/v1/workspaces/ws-1/files/file_abc/download",
        extractedText: "hello notes",
      });
    const onSendMessage = vi.fn();
    const { container } = render(
      <ChatInput {...baseProps} workspaceId="ws-1" onSendMessage={onSendMessage} />
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    const file = new File(["hello notes"], "notes.txt", { type: "text/plain" });
    Object.defineProperty(input, "files", { value: [file], writable: false });
    fireEvent.change(input);

    await waitFor(() => {
      expect(uploadSpy).toHaveBeenCalledWith("ws-1", file);
    });
    expect(await screen.findByText("notes.txt")).toBeInTheDocument();

    const textbox = screen.getByRole("textbox");
    fireEvent.change(textbox, { target: { value: "Summarize this" } });
    fireEvent.submit(textbox.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(onSendMessage).toHaveBeenCalledTimes(1);
    });
    const [prompt, attachments, skill] = onSendMessage.mock.calls[0];
    expect(prompt).toBe("Summarize this");
    expect(attachments).toHaveLength(1);
    expect(attachments[0]).toMatchObject({ id: "file_abc", name: "notes.txt" });
    expect(skill).toBeNull();
  });

  it("keeps a stable send/stop control and exposes attachment mode", () => {
    render(<ChatInput {...baseProps} />);

    expect(screen.getByRole("button", { name: "Add attachment or select mode" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  });

  it("selects a system skill from a slash command and forwards it with the message", () => {
    const onSendMessage = vi.fn();
    render(<ChatInput {...baseProps} onSendMessage={onSendMessage} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, {
      target: { value: "/research quantum error correction" },
    });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    expect(onSendMessage).toHaveBeenCalledWith(
      "quantum error correction",
      [],
      "deep_research"
    );
  });

  it("keeps migrated composer styles on semantic color tokens", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/components/chat/ChatInput.tsx"),
      "utf8"
    );

    expect(source).not.toMatch(/\b(?:bg|text|border|ring)-(?:white|zinc|red|emerald|blue)-/);
  });
});
