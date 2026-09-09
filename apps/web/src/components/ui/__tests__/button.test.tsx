import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "../button";

describe("Button", () => {
  it("disables itself and exposes a loading label while loading", () => {
    render(<Button loading loadingLabel="Creating workspace">Create</Button>);
    const button = screen.getByRole("button", { name: "Creating workspace" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("keeps standard dimensions and supports an explicit pill shape", () => {
    const { rerender } = render(<Button>Save</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-8", "rounded-lg");
    rerender(<Button shape="pill">Save</Button>);
    expect(screen.getByRole("button")).toHaveClass("rounded-full");
  });
});
