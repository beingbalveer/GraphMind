import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "../button";
import { DropdownMenu } from "../dropdown-menu";

describe("DropdownMenu", () => {
  it("keeps product branch-tab triggers as labelled Button controls", () => {
    const branchPane = readFileSync(resolve(process.cwd(), "src/components/chat/BranchChatPane.tsx"), "utf8");
    const sidePeekSheet = readFileSync(resolve(process.cwd(), "src/components/chat/SidePeekBranchSheet.tsx"), "utf8");

    expect(branchPane).toMatch(
      /trigger=\{\s*<Button[\s\S]{0,300}aria-label="Branch tab options"/
    );
    expect(sidePeekSheet).toMatch(
      /trigger=\{\s*<Button[\s\S]{0,300}aria-label="Side branch tab options"/
    );
  });

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
    trigger.focus();
    await user.keyboard("{ArrowDown}");
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

    const trigger = screen.getByRole("button", { name: "Options" });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  }, 15000);
});
