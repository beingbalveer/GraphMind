import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "../button";
import { Input } from "../input";
import { Modal, ModalBody, ModalHeader } from "../modal";

describe("Modal", () => {
  it("names the dialog, focuses inside it, and restores trigger focus", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });

    function Harness() {
      const [open, setOpen] = React.useState(false);

      return (
        <>
          <Button onClick={() => setOpen(true)}>Open settings</Button>
          <Modal isOpen={open} onClose={() => setOpen(false)}>
            <ModalHeader title="Settings" onClose={() => setOpen(false)} />
            <ModalBody>
              <Input aria-label="API key" />
            </ModalBody>
          </Modal>
        </>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open settings" });

    await user.click(trigger);

    expect(screen.getByRole("dialog", { name: "Settings" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "API key" })).toHaveFocus();

    await user.keyboard("{Escape}");

    expect(trigger).toHaveFocus();
  });

  it("honors closeOnClickOutside=false", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onClose = vi.fn();

    render(
      <Modal isOpen onClose={onClose} closeOnClickOutside={false} ariaLabel="Protected dialog">
        <ModalBody>Protected</ModalBody>
      </Modal>
    );

    await user.click(document.body);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("gives a headerless dialog a compatibility name", () => {
    render(
      <Modal isOpen onClose={vi.fn()} ariaLabel="File library">
        <ModalBody>Files</ModalBody>
      </Modal>
    );

    expect(screen.getByRole("dialog", { name: "File library" })).toBeVisible();
  });
});
