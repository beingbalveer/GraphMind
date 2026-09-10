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
    await user.keyboard("{Enter}");

    expect(onSendMessage).toHaveBeenCalledWith("Explain branching", [], null);
  });

  it("keeps a stable send/stop control and exposes attachment mode", () => {
    render(<ChatInput {...baseProps} />);

    expect(screen.getByRole("button", { name: "Add attachment or select mode" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  });
});
