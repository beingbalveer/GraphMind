import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Button, buttonVariants } from "../button";
import { ConfirmDialog } from "../confirm-dialog";
import { Drawer } from "../drawer";
import { Input } from "../input";
import { Textarea } from "../textarea";
import { CopyButton } from "../copy-button";
import { InlineFeedback } from "../feedback";

describe("final review regressions", () => {
  it("shows the entire confirmation description in a wrapping body and links it once", () => {
    const description = "Delete this branch and all of its messages? This permanently removes every nested branch and cannot be undone.";
    render(<ConfirmDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} title="Delete branch" description={description} />);
    const dialog = screen.getByRole("alertdialog", { name: "Delete branch" });
    const copy = screen.getByText(description);
    expect(copy).toBeVisible();
    expect(copy).not.toHaveClass("truncate");
    expect(copy).toHaveClass("whitespace-normal", "break-words");
    expect(copy.parentElement).toHaveClass("overflow-y-auto");
    expect(dialog).toHaveAccessibleDescription(description);
    expect(screen.getAllByText(description)).toHaveLength(1);
  });

  it.each([true, false])("restores the Drawer opener on Escape with backdrop=%s", async (hasBackdrop) => {
    function Example() {
      const [open, setOpen] = useState(false);
      return <><Button onClick={() => setOpen(true)}>Open panel</Button><Drawer hasBackdrop={hasBackdrop} isOpen={open} onClose={() => setOpen(false)} title="Panel" description="Details">Content</Drawer></>;
    }
    const user = userEvent.setup();
    render(<Example />);
    const opener = screen.getByRole("button", { name: "Open panel" });
    await user.click(opener);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("allows outside keyboard focus without dismissing a backdropless Drawer", async () => {
    const onClose = vi.fn();
    render(<><Button>Outside</Button><Drawer hasBackdrop={false} isOpen onClose={onClose} title="Panel" description="Details">Content</Drawer></>);
    await waitFor(() => expect(screen.getByRole("button", { name: "Close drawer" })).toHaveFocus());
    // A keyboard shortcut can move focus outside even though Radix loops Tab locally.
    act(() => screen.getByRole("button", { name: "Outside" }).focus());
    expect(screen.getByRole("button", { name: "Outside" })).toHaveFocus();
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  for (const Control of [Input, Textarea]) {
    it.each(["help", "help limit"])(`${Control.displayName} appends its own error ID to %s`, (ids) => {
      render(<><p id="help">Helpful instructions</p><p id="limit">Maximum length</p><Control aria-label="Name" aria-describedby={ids} invalid errorMessage="Name required" /></>);
      const error = screen.getByRole("alert");
      expect(error.id).not.toBe("");
      expect(error.id).not.toMatch(/\s/);
      expect(ids.split(" ")).not.toContain(error.id);
      expect(screen.getByRole("textbox")).toHaveAttribute("aria-describedby", `${ids} ${error.id}`);
      expect(document.querySelectorAll('[id="help"]')).toHaveLength(1);
    });
  }

  it("supports a ghost Textarea while preserving invalid styling", () => {
    render(<Textarea aria-label="Message" variant="ghost" invalid />);
    expect(screen.getByRole("textbox")).toHaveClass("bg-transparent", "border-destructive");
    expect(screen.getByRole("textbox")).not.toHaveAttribute("variant");
  });

  it.each([
    ["xs", "h-6"],
    ["sm", "h-7"],
    ["icon-sm", "size-7"],
  ] as const)("keeps compact %s control dimensions", (size, dimension) => {
    expect(buttonVariants({ size })).toContain(dimension);
  });

  it.each([ ["info", "status"], ["success", "status"], ["warning", "alert"], ["destructive", "alert"] ] as const)("announces %s feedback as %s", (tone, role) => {
    render(<InlineFeedback tone={tone}>Updates available</InlineFeedback>);
    expect(screen.getByRole(role)).toHaveTextContent("Updates available");
  });
});

describe("CopyButton reset lifecycle", () => {
  let clipboardDescriptor: PropertyDescriptor | undefined;
  beforeEach(() => {
    clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    vi.useFakeTimers();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });
  afterEach(() => {
    vi.useRealTimers();
    if (clipboardDescriptor) Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
    else Reflect.deleteProperty(navigator, "clipboard");
  });
  it("keeps copied feedback for two seconds after the latest successful copy", async () => {
    render(<CopyButton text="Notes" />);
    await act(async () => fireEvent.click(screen.getByRole("button")));
    act(() => vi.advanceTimersByTime(1500));
    await act(async () => fireEvent.click(screen.getByRole("button")));
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByRole("button", { name: "Copied!" })).toBeVisible();
    act(() => vi.advanceTimersByTime(1499));
    expect(screen.getByRole("button", { name: "Copied!" })).toBeVisible();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("button", { name: "Copy message" })).toBeVisible();
  });
  it("cancels its feedback timer on unmount", async () => {
    const { unmount } = render(<CopyButton text="Notes" />);
    await act(async () => fireEvent.click(screen.getByRole("button")));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
