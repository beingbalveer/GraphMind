import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "../input";
import { Textarea } from "../textarea";

describe("form controls", () => {
  it("connects an input error to the field", () => {
    render(<Input aria-label="Workspace name" invalid errorMessage="Name is required" />);
    expect(screen.getByRole("textbox", { name: "Workspace name" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Name is required");
  });

  it("supports a constrained multiline input", () => {
    render(<Textarea aria-label="Message" maxRowsClassName="max-h-48" />);
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveClass("resize-none", "max-h-48");
  });
});
