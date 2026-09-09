import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "../button";
import { DropdownMenu } from "../dropdown-menu";

describe("DropdownMenu", () => {
  it("invokes the initially focused first item and restores trigger focus", async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    const onRename = vi.fn();

    render(
      <DropdownMenu
        trigger={<Button>Options</Button>}
        items={[
          { label: "Rename", onClick: onRename },
          { label: "Delete", variant: "destructive", onClick: vi.fn() },
        ]}
      />
    );

    const trigger = screen.getByRole("button", { name: "Options" });
    await user.click(trigger);
    await user.keyboard("{Enter}");

    expect(onRename).toHaveBeenCalledOnce();
    expect(trigger).toHaveFocus();
  }, 15000);

  it("moves focus to Delete with ArrowDown and closes on Escape", async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    const onDelete = vi.fn();

    render(
      <DropdownMenu
        trigger={<Button>Options</Button>}
        items={[
          { label: "Rename", onClick: vi.fn() },
          { label: "Delete", variant: "destructive", onClick: onDelete },
        ]}
      />
    );

    await user.click(screen.getByRole("button", { name: "Options" }));
    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  }, 15000);
});
