import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "../button";

describe("Button", () => {
  it("disables itself and exposes a loading label while loading", () => {
    render(<Button loading loadingLabel="Creating workspace">Create</Button>);
    const button = screen.getByRole("button", { name: "Creating workspace" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector("svg")).toHaveClass("motion-reduce:animate-none");
  });

  it("uses the Assistant UI default button treatment", () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });

    expect(button).toHaveAttribute("data-slot", "button");
    expect(button).toHaveClass("h-8", "rounded-lg", "font-medium", "bg-primary", "hover:bg-primary/80");
  });

  it("supports Assistant UI's compact icon size", () => {
    render(<Button size="icon-sm" aria-label="Open menu">Menu</Button>);

    expect(screen.getByRole("button", { name: "Open menu" })).toHaveClass("size-7");
  });

  it("uses Assistant UI's low-emphasis destructive treatment", () => {
    render(<Button variant="destructive">Delete</Button>);

    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass(
      "bg-destructive/10",
      "text-destructive",
      "hover:bg-destructive/20"
    );
  });

  it("preserves an explicit aria-busy value while not loading", () => {
    render(<Button aria-busy="false">Save</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "false");
  });
});
