import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChatInput } from "@/components/chat/ChatInput";

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

  it("keeps a stable send/stop control and exposes attachment mode", () => {
    render(<ChatInput {...baseProps} />);

    expect(screen.getByRole("button", { name: "Add attachment or select mode" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  });

  it("keeps migrated composer styles on semantic color tokens", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/components/chat/ChatInput.tsx"),
      "utf8"
    );

    expect(source).not.toMatch(/\b(?:bg|text|border|ring)-(?:white|zinc|red|emerald|blue)-/);
  });
});
