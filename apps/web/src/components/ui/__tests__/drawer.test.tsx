import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Drawer } from "../drawer";

describe("Drawer", () => {
  it("keeps a backdropless drawer open for outside interaction but closes it with Escape", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onClose = vi.fn();

    render(
      <Drawer hasBackdrop={false} isOpen onClose={onClose} title="Branch details">
        Content
      </Drawer>
    );

    await user.click(document.body);

    expect(onClose).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("exposes the drawer as a named dialog and closes it with Escape", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onClose = vi.fn();

    render(
      <Drawer isOpen onClose={onClose} title="Branch details">
        Content
      </Drawer>
    );

    expect(screen.getByRole("dialog", { name: "Branch details" })).toBeVisible();

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledOnce();
  });
});
