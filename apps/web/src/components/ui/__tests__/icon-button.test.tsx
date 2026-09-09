import { fireEvent, render, screen } from "@testing-library/react";
import { Plus } from "lucide-react";
import { describe, expect, it } from "vitest";
import { IconButton } from "../icon-button";

describe("IconButton", () => {
  it("always exposes an accessible label", () => {
    render(<IconButton label="Add attachment"><Plus /></IconButton>);
    expect(screen.getByRole("button", { name: "Add attachment" })).toBeVisible();
  });

  it("shows the optional tooltip on focus", () => {
    render(<IconButton label="Add attachment" tooltip="Attach a file"><Plus /></IconButton>);
    fireEvent.focus(screen.getByRole("button", { name: "Add attachment" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Attach a file");
  });
});
