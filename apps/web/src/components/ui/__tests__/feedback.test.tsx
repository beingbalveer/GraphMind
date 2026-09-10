import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Badge } from "../badge";
import { Button } from "../button";
import { CopyButton } from "../copy-button";
import { EmptyState } from "../feedback";
import { Toast } from "../toast";

describe("feedback primitives", () => {
  let clipboardDescriptor: PropertyDescriptor | undefined;
  beforeEach(() => { clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard"); });
  afterEach(() => {
    if (clipboardDescriptor) Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
    else Reflect.deleteProperty(navigator, "clipboard");
  });
  it("announces request errors and provides a labeled dismiss action", () => {
    render(<Toast message="Connection failed" onDismiss={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Connection failed");
    expect(screen.getByRole("button", { name: "Dismiss error" })).toBeVisible();
  });

  it("changes CopyButton's accessible label after writing to the clipboard", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

    render(<CopyButton text="Raft notes" title="Copy notes" copiedTitle="Notes copied" />);
    await user.click(screen.getByRole("button", { name: "Copy notes" }));

    expect(writeText).toHaveBeenCalledWith("Raft notes");
    expect(screen.getByRole("button", { name: "Notes copied" })).toBeVisible();
  });

  it("maps warning badges to semantic status tokens", () => {
    render(<Badge variant="warning">Needs review</Badge>);

    expect(screen.getByText("Needs review")).toHaveClass("bg-warning-bg", "text-warning");
  });

  it("renders an EmptyState heading and supplied action", () => {
    render(
      <EmptyState
        title="No sources yet"
        description="Attach a document to begin."
        action={<Button>Attach document</Button>}
      />
    );

    expect(screen.getByRole("heading", { name: "No sources yet" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Attach document" })).toBeVisible();
  });
});
