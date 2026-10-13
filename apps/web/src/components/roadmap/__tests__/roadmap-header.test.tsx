import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildCanvasUrl, buildWorkspaceUrl } from "@/lib/urls";
import { curriculumFixture } from "./fixtures";
import { RoadmapHeader } from "../RoadmapHeader";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("RoadmapHeader view toggle", () => {
  beforeEach(() => {
    push.mockClear();
  });

  it("uses a compact icon toggle to switch between roadmap and canvas", () => {
    const view = {
      ...curriculumFixture(),
      workspaceId: "workspace-test",
      canvasAnchorChatId: "anchor-test",
    };
    const { rerender } = render(<RoadmapHeader view={view} mode="page" />);

    expect(screen.getByText("Roadmap")).toBeVisible();
    const canvasButton = screen.getByRole("button", { name: "Switch to canvas" });
    fireEvent.click(canvasButton);
    expect(push).toHaveBeenLastCalledWith(
      buildCanvasUrl("workspace-test", "anchor-test"),
    );

    rerender(<RoadmapHeader view={view} mode="canvas" />);
    const roadmapButton = screen.getByRole("button", { name: "Switch to roadmap" });
    expect(roadmapButton).toHaveClass("bg-surface-hover");
    fireEvent.click(roadmapButton);
    expect(push).toHaveBeenLastCalledWith(buildWorkspaceUrl("workspace-test"));
  });
});
