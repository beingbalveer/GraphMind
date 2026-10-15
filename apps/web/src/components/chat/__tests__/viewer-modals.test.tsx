import React from "react";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CodeViewerModal } from "../CodeViewerModal";
import { PdfViewerModal } from "../PdfViewerModal";
import { TableViewerModal } from "../TableViewerModal";
import { FileLibraryModal } from "@/components/library/FileLibraryModal";
import * as workspaceApi from "@/lib/workspaceApi";
import { FileAttachment } from "@graphmind/shared";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function csvOf(rowCount: number): string {
  const lines = ["id,name"];
  for (let i = 1; i <= rowCount; i += 1) lines.push(`${i},name-${i}`);
  return lines.join("\n");
}

describe("LSI-034 CodeViewerModal", () => {
  it("renders the file content, language locator, and line/character counts", () => {
    render(
      <CodeViewerModal
        isOpen
        onClose={vi.fn()}
        filename="app.py"
        content={"print(1)\nprint(2)"}
        sizeBytes={42}
      />
    );

    expect(screen.getByText("app.py")).toBeInTheDocument();
    expect(screen.getByText("PY")).toBeInTheDocument();
    expect(screen.getByText("2 lines")).toBeInTheDocument();
    expect(screen.getByText(/print\(1\)/)).toBeInTheDocument();
  });

  it("previews markdown by default, toggles to raw source, and closes on Escape", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onClose = vi.fn();
    render(
      <CodeViewerModal
        isOpen
        onClose={onClose}
        filename="notes.md"
        content={"# Heading\n\nBody paragraph"}
      />
    );

    expect(screen.getByRole("heading", { name: "Heading" })).toBeVisible();

    await user.click(screen.getByRole("tab", { name: "Source" }));
    expect(screen.getByText(/^# Heading/)).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("copies the exact content and downloads through the resolved file URL", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);

    render(
      <CodeViewerModal
        isOpen
        onClose={vi.fn()}
        filename="snippet.ts"
        content="const answer = 42;"
        downloadUrl="https://files.example/snippet.ts"
      />
    );

    await user.click(screen.getByRole("button", { name: /Copy/ }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("const answer = 42;")
    );
    expect(await screen.findByText("Copied")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Download/ }));
    expect(openSpy).toHaveBeenCalledWith(
      "https://files.example/snippet.ts",
      "_blank"
    );
  });

  it("falls back to a Blob download when no file URL is available", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = vi.fn(
      () => "blob:mock"
    );
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = vi.fn();

    render(
      <CodeViewerModal
        isOpen
        onClose={vi.fn()}
        filename="snippet.ts"
        content="const answer = 42;"
      />
    );

    await user.click(screen.getByRole("button", { name: /Download/ }));

    expect(anchorClick).toHaveBeenCalledTimes(1);
    const anchor = anchorClick.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(anchor.download).toBe("snippet.ts");
    expect(anchor.href).toContain("blob:mock");

    anchorClick.mockRestore();
  });
});

describe("LSI-034 PdfViewerModal", () => {
  it("renders the file in an iframe and appends the source locator page anchor", () => {
    render(
      <PdfViewerModal
        isOpen
        onClose={vi.fn()}
        filename="paper.pdf"
        url="/api/v1/workspaces/ws-1/files/f-1/download"
        initialPage={4}
        sizeBytes={1024}
      />
    );

    const frame = screen.getByTitle("paper.pdf") as HTMLIFrameElement;
    expect(frame.src).toContain("#page=4");
    expect(screen.getByText("PDF")).toBeInTheDocument();
    expect(screen.getByText("Page 4")).toBeInTheDocument();
  });

  it("downloads with the attachment disposition flag and shows an explicit error without a source", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);

    const { unmount } = render(
      <PdfViewerModal
        isOpen
        onClose={vi.fn()}
        filename="paper.pdf"
        url="/api/v1/workspaces/ws-1/files/f-1/download"
      />
    );

    await user.click(
      screen.getByRole("button", { name: /Download/ })
    );
    expect(openSpy).toHaveBeenCalledWith(
      "/api/v1/workspaces/ws-1/files/f-1/download?download=true",
      "_blank"
    );

    unmount();
    render(<PdfViewerModal isOpen onClose={vi.fn()} filename="broken.pdf" />);
    expect(
      screen.getByText("Unable to load PDF preview.")
    ).toBeInTheDocument();
  });
});

describe("LSI-034 TableViewerModal", () => {
  it("parses CSV content into a table with row and column metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: async () => "id,name\n1,Alpha\n2,Beta" })
    );

    render(
      <TableViewerModal
        isOpen
        onClose={vi.fn()}
        filename="data.csv"
        url="/api/v1/workspaces/ws-1/files/f-1/download"
      />
    );

    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("CSV")).toBeInTheDocument();
    expect(screen.getByText("2 rows")).toBeInTheDocument();
    expect(screen.getByText("2 columns")).toBeInTheDocument();
  });

  it("paginates large tables at 50 rows per page with working navigation", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: async () => csvOf(120) })
    );

    render(
      <TableViewerModal
        isOpen
        onClose={vi.fn()}
        filename="big.csv"
        url="/api/v1/workspaces/ws-1/files/f-1/download"
      />
    );

    expect(await screen.findByText("name-1")).toBeInTheDocument();
    expect(screen.getByText("name-50")).toBeInTheDocument();
    expect(screen.queryByText("name-51")).not.toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(screen.getByText(/Showing 1–50 of 120 rows/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(screen.queryByText("name-1")).not.toBeInTheDocument();
    expect(screen.getByText("name-51")).toBeInTheDocument();
    expect(screen.getByText("name-100")).toBeInTheDocument();
    expect(screen.queryByText("name-101")).not.toBeInTheDocument();
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(screen.getByText(/Showing 51–100 of 120 rows/)).toBeInTheDocument();
  });

  it("filters rows by search query and sorts by column header", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => "name,score\nBeta,2\nAlpha,10\nGamma,1",
      })
    );

    render(
      <TableViewerModal
        isOpen
        onClose={vi.fn()}
        filename="scores.csv"
        url="/api/v1/workspaces/ws-1/files/f-1/download"
      />
    );

    expect(await screen.findByText("Beta")).toBeInTheDocument();

    // Numeric ascending sort on the score column.
    await user.click(screen.getByText("score"));
    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("Gamma")).toBeInTheDocument();

    // Free-text filter narrows the visible rows.
    fireEvent.change(screen.getByPlaceholderText("Filter table rows..."), {
      target: { value: "Alpha" },
    });
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();
    expect(screen.getByText(/1 matching rows/)).toBeInTheDocument();
  });

  it("parses JSONL records into a column union", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '{"a":11,"b":22}\n{"a":33,"b":44}',
      })
    );

    render(
      <TableViewerModal
        isOpen
        onClose={vi.fn()}
        filename="events.jsonl"
        url="/api/v1/workspaces/ws-1/files/f-1/download"
      />
    );

    expect(await screen.findByText("JSONL")).toBeInTheDocument();
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.getByText("b")).toBeInTheDocument();

    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("11")).toBeInTheDocument();
    expect(within(rows[1]).getByText("22")).toBeInTheDocument();
    expect(within(rows[2]).getByText("33")).toBeInTheDocument();
    expect(within(rows[2]).getByText("44")).toBeInTheDocument();
  });

  it("renders Excel extracted markdown with the sheet source locator", async () => {
    render(
      <TableViewerModal
        isOpen
        onClose={vi.fn()}
        filename="report.xlsx"
        extractedText={
          "Sheet: `Q1`\n\n| Region | Sales |\n| --- | --- |\n| North | 100 |\n| South | 200 |"
        }
      />
    );

    expect(screen.getByText("XLSX")).toBeInTheDocument();
    expect(screen.getByText("Sheet: Q1")).toBeInTheDocument();
    expect(screen.getByText("Region")).toBeInTheDocument();
    expect(screen.getByText("North")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
  });

  it("shows an explicit empty state and closes on Escape without tabular data", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onClose = vi.fn();

    render(
      <TableViewerModal isOpen onClose={onClose} filename="empty.csv" />
    );

    expect(screen.getByText("No tabular data to display")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("LSI-034 nested modal Escape and focus", () => {
  const pdfFile: FileAttachment = {
    id: "f-pdf",
    name: "chapter.pdf",
    sizeBytes: 2048,
    mimeType: "application/pdf",
    fileCategory: "document",
    url: "/api/v1/workspaces/ws-1/files/f-pdf/download",
    metadata: { status: "ready" },
  };

  it("moves focus into the viewer and closes only the top viewer on Escape", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    vi.spyOn(workspaceApi, "fetchWorkspaceFiles").mockResolvedValue([pdfFile]);

    render(
      <FileLibraryModal isOpen onClose={vi.fn()} workspaceId="ws-1" />
    );

    const library = await screen.findByRole("dialog", {
      name: /Workspace File Library/,
    });

    // Open the PDF viewer on top of the library modal.
    await user.click(within(library).getByText("chapter.pdf"));

    const frame = (
      await screen.findAllByTitle("chapter.pdf")
    ).find((el) => el.tagName === "IFRAME") as HTMLIFrameElement;
    expect(frame).toBeTruthy();
    const viewer = frame.closest('[role="dialog"]') as HTMLElement;
    expect(viewer).toBeTruthy();
    // Focus moves into the freshly opened nested viewer.
    await waitFor(() =>
      expect(viewer.contains(document.activeElement)).toBe(true)
    );

    // Escape dismisses the nested viewer but leaves the parent modal mounted.
    await user.keyboard("{Escape}");

    await waitFor(() => {
      const iframes = screen
        .queryAllByTitle("chapter.pdf")
        .filter((el) => el.tagName === "IFRAME");
      expect(iframes.length).toBe(0);
    });
    expect(
      screen.getByRole("dialog", { name: /Workspace File Library/ })
    ).toBeVisible();
  });

  it("opens the image lightbox as a primitive modal that closes on Escape", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const imageFile: FileAttachment = {
      id: "f-img",
      name: "diagram.png",
      sizeBytes: 4096,
      mimeType: "image/png",
      fileCategory: "image",
      url: "/api/v1/workspaces/ws-1/files/f-img/download",
      metadata: { status: "ready" },
    };
    vi.spyOn(workspaceApi, "fetchWorkspaceFiles").mockResolvedValue([imageFile]);

    render(
      <FileLibraryModal isOpen onClose={vi.fn()} workspaceId="ws-1" />
    );

    const library = await screen.findByRole("dialog", {
      name: /Workspace File Library/,
    });

    await user.click(within(library).getByRole("img", { name: "diagram.png" }));

    const lightbox = await screen.findByRole("dialog", {
      name: /diagram\.png/,
    });
    await waitFor(() =>
      expect(lightbox.contains(document.activeElement)).toBe(true)
    );

    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: /diagram\.png/ })
      ).toBeNull()
    );
    expect(
      screen.getByRole("dialog", { name: /Workspace File Library/ })
    ).toBeVisible();
  });
});

