import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "../button";
import { DropdownMenu } from "../dropdown-menu";
import { Modal, ModalBody, ModalHeader } from "../modal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../tooltip";

describe("portalled overlays inside a modal", () => {
  it("puts the menu on the compiled dropdown layer and restores its modal trigger on Escape", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<Modal isOpen onClose={vi.fn()}><ModalHeader title="Settings" description="Edit settings" /><ModalBody>
      <DropdownMenu trigger={<Button>Options</Button>} items={[{ label: "Rename", onClick: vi.fn() }]} />
    </ModalBody></Modal>);
    const trigger = screen.getByRole("button", { name: "Options" });
    const dialog = screen.getByRole("dialog");
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    const menu = screen.getByRole("menu");
    // compiled-theme.test proves this layer is emitted and exceeds the modal's 50.
    expect(menu).toHaveClass("z-dropdown");
    expect(dialog).toHaveClass("z-50");
    expect(dialog).not.toContainElement(menu);
    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
    expect(screen.getByRole("dialog")).toBeVisible();
  }, 30000);
  it("puts a modal tooltip on the same compiled dropdown layer", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<Modal isOpen onClose={vi.fn()}><ModalHeader title="Settings" description="Edit settings" /><ModalBody>
      <TooltipProvider delayDuration={0}><Tooltip><TooltipTrigger asChild><Button>Help</Button></TooltipTrigger><TooltipContent>More details</TooltipContent></Tooltip></TooltipProvider>
    </ModalBody></Modal>);
    await user.hover(screen.getByRole("button", { name: "Help" }));
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.closest(".z-dropdown")).not.toBeNull();
    expect(screen.getByRole("dialog")).not.toContainElement(tooltip);
  }, 30000);
});
