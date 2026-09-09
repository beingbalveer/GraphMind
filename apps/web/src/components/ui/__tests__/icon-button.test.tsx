import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Plus } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IconButton } from "../icon-button";

describe("IconButton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("jest", { advanceTimersByTime: vi.advanceTimersByTime });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("always exposes an accessible label", () => {
    render(<IconButton label="Add attachment"><Plus /></IconButton>);
    expect(screen.getByRole("button", { name: "Add attachment" })).toBeVisible();
  });

  it("shows the optional tooltip on keyboard focus", async () => {
    render(<IconButton label="Add attachment" tooltip="Attach a file"><Plus /></IconButton>);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.tab();
    await vi.runAllTimersAsync();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Attach a file");
  });

  it("keeps its accessible label while loading without a loading label", () => {
    render(<IconButton label="Add attachment" loading><Plus /></IconButton>);
    expect(screen.getByRole("button", { name: "Add attachment" })).toBeDisabled();
  });
});
