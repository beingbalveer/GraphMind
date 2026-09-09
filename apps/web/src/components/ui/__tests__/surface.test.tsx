import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Surface } from "../surface";
import { Skeleton } from "../skeleton";

describe("surface primitives", () => {
  it("maps raised cards to semantic elevation", () => {
    render(<Surface variant="raised" radius="card">Content</Surface>);
    expect(screen.getByText("Content")).toHaveClass("bg-surface-raised", "rounded-2xl");
  });

  it("announces a labeled loading region", () => {
    render(<Skeleton label="Loading conversation" />);
    expect(screen.getByRole("status", { name: "Loading conversation" })).toBeVisible();
  });
});
