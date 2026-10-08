import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import type { CanvasGraph, CanvasItem } from "@/lib/canvas/types";
import { curriculumFixture } from "./fixtures";
import { RoadmapCanvas } from "../RoadmapCanvas";

vi.mock("@/hooks/useCanvasLayout", () => ({
  useCanvasLayout: () => ({
    ready: false,
    layout: null,
    setLayout: vi.fn(),
    saveState: "saved",
  }),
}));
vi.mock("@/components/canvas/CanvasSurface", () => ({
  CanvasSurface: ({ graph, renderItem }: {
    graph: CanvasGraph;
    renderItem: (item: CanvasItem) => React.ReactNode;
  }) => (
    <div>
      {graph.items.map((item) => <div key={item.id}>{renderItem(item)}</div>)}
    </div>
  ),
}));

it("shows the recommended path and rationale, revealing alternatives only on request", async () => {
  const open = vi.fn();
  render(<RoadmapCanvas view={curriculumFixture()} onOpenTopic={open} />);
  expect(screen.getByRole("button", { name: "chosen" })).toHaveTextContent("Selected path");
  expect(screen.getByText("Fits your goal")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "other" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Show alternatives" }));
  expect(screen.getByRole("button", { name: "other" })).toHaveTextContent("Alternative");
  await userEvent.click(screen.getByRole("button", { name: "chosen" }));
  expect(open).toHaveBeenCalledWith("chosen");
  await userEvent.click(screen.getByRole("button", { name: "Hide alternatives" }));
  expect(screen.queryByRole("button", { name: "other" })).not.toBeInTheDocument();
});
