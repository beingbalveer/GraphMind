import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SegmentedTabs } from "../segmented-tabs";
import { Switch } from "../switch";

describe("selection controls", () => {
  it("toggles the controlled switch with Space", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();

    render(<Switch checked={false} onCheckedChange={onCheckedChange} id="auto-scroll" />);

    const control = screen.getByRole("switch");
    control.focus();
    await user.keyboard(" ");

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("exposes segmented choices as tabs", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SegmentedTabs
        value="chat"
        onChange={onChange}
        items={[
          { id: "chat", label: "Chat" },
          { id: "canvas", label: "Canvas" },
        ]}
      />
    );

    expect(screen.getByRole("tab", { name: "Chat" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: "Canvas" }));

    expect(onChange).toHaveBeenCalledWith("canvas");
  });
});
