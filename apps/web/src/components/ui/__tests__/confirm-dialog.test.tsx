import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "../confirm-dialog";

describe("ConfirmDialog", () => {
  it("keeps a loading confirmation open and disables both actions", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onClose = vi.fn();

    render(
      <ConfirmDialog
        isOpen
        onClose={onClose}
        onConfirm={vi.fn()}
        title="Delete branch"
        description="This cannot be undone."
        isLoading
      />
    );

    expect(screen.getByRole("alertdialog", { name: "Delete branch" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Processing" })).toBeDisabled();

    await user.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
  });
});
