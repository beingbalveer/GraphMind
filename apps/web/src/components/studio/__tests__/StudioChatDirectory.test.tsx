import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudioChatDirectory } from "../StudioChatDirectory";
import {
  listWorkspaceChats,
  renameWorkspaceChat,
  togglePinWorkspaceChat,
} from "@/lib/workspaceApi";
import type { ChatItem } from "@/lib/workspaceApi";

vi.mock("@/lib/workspaceApi", () => ({
  listWorkspaceChats: vi.fn(),
  renameWorkspaceChat: vi.fn(),
  togglePinWorkspaceChat: vi.fn(),
}));

const makeChat = (id: string, opts: Partial<ChatItem> = {}): ChatItem => ({
  id,
  workspaceId: "ws-1",
  title: id,
  nodeCount: 2,
  createdAt: "2026-10-10T12:00:00Z",
  updatedAt: "2026-10-10T12:00:00Z",
  pinned: false,
  topicAssociation: null,
  ...opts,
});

const rowsInOrder = () =>
  screen
    .queryAllByTestId(/^chat-directory-row-/)
    .map((row) => row.getAttribute("data-testid"));

describe("StudioChatDirectory (LSI-018)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listWorkspaceChats).mockResolvedValue([]);
    vi.mocked(renameWorkspaceChat).mockResolvedValue(true);
    vi.mocked(togglePinWorkspaceChat).mockResolvedValue(true);
  });

  it("lists only the scoped workspace conversations and omits the protected anchor row", async () => {
    vi.mocked(listWorkspaceChats).mockResolvedValue([
      makeChat("anchor-1", { title: "Canvas Anchor" }),
      makeChat("chat-1", { title: "Fraction basics" }),
      makeChat("chat-2", {
        title: "Lesson follow-up",
        topicAssociation: {
          sessionId: "s-1",
          topicId: "t1",
          title: "Equivalent fractions",
          archived: false,
        },
      }),
    ]);

    render(
      <StudioChatDirectory
        workspaceId="ws-1"
        excludeChatId="anchor-1"
        onOpenChat={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(listWorkspaceChats).toHaveBeenCalledWith(
        "ws-1",
        expect.any(AbortSignal),
      ),
    );

    expect(await screen.findByText("Fraction basics")).toBeInTheDocument();
    expect(screen.getByText("Lesson follow-up")).toBeInTheDocument();
    expect(screen.queryByText("Canvas Anchor")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chat-directory-row-anchor-1")).not.toBeInTheDocument();
  });

  it("filters the directory with scoped search and clears it", async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    vi.mocked(listWorkspaceChats).mockResolvedValue([
      makeChat("chat-1", { title: "Fraction basics" }),
      makeChat("chat-2", { title: "Email fields" }),
    ]);

    render(<StudioChatDirectory workspaceId="ws-1" onOpenChat={vi.fn()} />);
    await screen.findByText("Fraction basics");

    const search = screen.getByRole("textbox", {
      name: "Search course conversations",
    });
    await user.type(search, "Email");

    expect(screen.queryByText("Fraction basics")).not.toBeInTheDocument();
    expect(screen.getByText("Email fields")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByText("Fraction basics")).toBeInTheDocument();
  });

  it("renames a conversation and preserves the persisted title after refresh", async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    vi.mocked(listWorkspaceChats).mockResolvedValueOnce([
      makeChat("chat-1", { title: "Untitled chat" }),
    ]);

    render(<StudioChatDirectory workspaceId="ws-1" onOpenChat={vi.fn()} />);
    await screen.findByText("Untitled chat");

    vi.mocked(listWorkspaceChats).mockResolvedValueOnce([
      makeChat("chat-1", { title: "Course foundations" }),
    ]);

    const trigger = screen.getByRole("button", {
      name: "Chat actions for Untitled chat",
    });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}"); // Rename (first item)

    const titleInput = screen.getByRole("textbox", { name: "Chat title" });
    await user.clear(titleInput);
    await user.type(titleInput, "Course foundations");
    await user.click(screen.getByRole("button", { name: "Save chat title" }));

    await waitFor(() =>
      expect(renameWorkspaceChat).toHaveBeenCalledWith(
        "ws-1",
        "chat-1",
        "Course foundations",
      ),
    );
    expect(await screen.findByText("Course foundations")).toBeInTheDocument();
  });

  it("pins a conversation, persisting pinned-first ordering", async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    vi.mocked(listWorkspaceChats).mockResolvedValueOnce([
      makeChat("chat-recent", {
        title: "Recent chat",
        updatedAt: "2026-10-12T12:00:00Z",
      }),
      makeChat("chat-older", {
        title: "Older chat",
        updatedAt: "2026-10-01T12:00:00Z",
      }),
    ]);

    render(<StudioChatDirectory workspaceId="ws-1" onOpenChat={vi.fn()} />);
    await screen.findByText("Recent chat");
    expect(rowsInOrder()).toEqual([
      "chat-directory-row-chat-recent",
      "chat-directory-row-chat-older",
    ]);

    vi.mocked(listWorkspaceChats).mockResolvedValueOnce([
      makeChat("chat-older", {
        title: "Older chat",
        updatedAt: "2026-10-01T12:00:00Z",
        pinned: true,
      }),
      makeChat("chat-recent", {
        title: "Recent chat",
        updatedAt: "2026-10-12T12:00:00Z",
      }),
    ]);

    const trigger = screen.getByRole("button", {
      name: "Chat actions for Older chat",
    });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}"); // Pin (second item)

    await waitFor(() =>
      expect(togglePinWorkspaceChat).toHaveBeenCalledWith(
        "ws-1",
        "chat-older",
        true,
      ),
    );
    await waitFor(() =>
      expect(rowsInOrder()).toEqual([
        "chat-directory-row-chat-older",
        "chat-directory-row-chat-recent",
      ]),
    );
  });

  it("projects lesson ancestry and distinguishes personal chats", async () => {
    vi.mocked(listWorkspaceChats).mockResolvedValue([
      makeChat("chat-lesson", {
        title: "Equivalent fractions",
        topicAssociation: {
          sessionId: "s-1",
          topicId: "t1",
          title: "Fractions",
          archived: false,
        },
      }),
      makeChat("chat-personal", { title: "Scratch pad" }),
    ]);

    render(<StudioChatDirectory workspaceId="ws-1" onOpenChat={vi.fn()} />);
    await screen.findByText("Equivalent fractions");

    const lessonRow = screen.getByTestId("chat-directory-row-chat-lesson");
    expect(within(lessonRow).getAllByText("Lesson").length).toBeGreaterThan(0);

    const personalRow = screen.getByTestId("chat-directory-row-chat-personal");
    expect(within(personalRow).getAllByText("Personal").length).toBeGreaterThan(0);

    const lessonAncestry = screen.getByTestId("chat-ancestry-chat-lesson");
    expect(within(lessonAncestry).getByText("Fractions")).toBeInTheDocument();

    const personalAncestry = screen.getByTestId("chat-ancestry-chat-personal");
    expect(within(personalAncestry).getByText("Personal")).toBeInTheDocument();
  });

  it("opens a conversation through the caller's canonical navigation", async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    const chat = makeChat("chat-1", { title: "Fraction basics" });
    vi.mocked(listWorkspaceChats).mockResolvedValue([chat]);

    const onOpenChat = vi.fn();
    render(<StudioChatDirectory workspaceId="ws-1" onOpenChat={onOpenChat} />);
    await screen.findByText("Fraction basics");

    await user.click(
      screen.getByRole("button", { name: "Open conversation Fraction basics" }),
    );
    expect(onOpenChat).toHaveBeenCalledWith(chat);
  });

  it("surfaces an authorization failure and recovers on retry", async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    vi.mocked(listWorkspaceChats)
      .mockRejectedValueOnce(new Error("Not authorized"))
      .mockResolvedValueOnce([makeChat("chat-1", { title: "Recovered chat" })]);

    render(<StudioChatDirectory workspaceId="ws-1" onOpenChat={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Not authorized");

    await user.click(
      screen.getByRole("button", { name: "Retry conversations" }),
    );

    expect(await screen.findByText("Recovered chat")).toBeInTheDocument();
  });
});
