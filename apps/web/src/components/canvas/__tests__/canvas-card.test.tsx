import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect, vi } from "vitest";
import { CanvasCard } from "../CanvasCard";
import type { CanvasItem } from "@/lib/canvas/types";

it("keeps a long title accessible and selects the real message using Enter", async () => {
  const title = "An existing conversation with a long title\nand meaningful context";
  const item: CanvasItem = { id: "segment:r", kind: "conversation", title, summary: "Preview",
    itemIds: ["r", "a"], selectionId: "a", lane: "spine", parentId: null, originId: null, order: 0 };
  const onSelect = vi.fn();
  render(<CanvasCard item={item} selected streaming={false} onSelect={onSelect} />);
  const card = screen.getByRole("button", { name: title.replace(/\s+/g, " ") });
  expect(card).toHaveAttribute("aria-pressed", "true");
  // React Flow excludes every descendant of .nodrag from its drag gesture.
  expect(card.closest(".nodrag")).toBeNull();
  card.focus();
  await userEvent.keyboard("{Enter}");
  expect(onSelect).toHaveBeenCalledWith("a");
});
