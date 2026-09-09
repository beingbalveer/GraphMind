import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../collapsible";

describe("Collapsible", () => {
  it("exposes and toggles its expanded state", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [open, setOpen] = React.useState(false);

      return (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger>Sources</CollapsibleTrigger>
          <CollapsibleContent>Source list</CollapsibleContent>
        </Collapsible>
      );
    }

    render(<Harness />);

    const trigger = screen.getByRole("button", { name: "Sources" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Source list")).toBeVisible();
  });
});
