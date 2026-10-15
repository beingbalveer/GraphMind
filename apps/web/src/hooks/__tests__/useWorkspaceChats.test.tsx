import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listWorkspaceChats,
  renameWorkspaceChat,
  togglePinWorkspaceChat,
} from "@/lib/workspaceApi";
import { useWorkspaceChats } from "@/hooks/useWorkspaceChats";
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
  nodeCount: 1,
  createdAt: "2026-10-10T12:00:00Z",
  updatedAt: "2026-10-10T12:00:00Z",
  pinned: false,
  topicAssociation: null,
  ...opts,
});

describe("useWorkspaceChats (LSI-018)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listWorkspaceChats).mockResolvedValue([]);
    vi.mocked(renameWorkspaceChat).mockResolvedValue(true);
    vi.mocked(togglePinWorkspaceChat).mockResolvedValue(true);
  });

  it("loads chats scoped to the authorized workspace on mount", async () => {
    const chats = [makeChat("chat-1"), makeChat("chat-2")];
    vi.mocked(listWorkspaceChats).mockResolvedValue(chats);

    const { result } = renderHook(() => useWorkspaceChats("ws-1"));

    await waitFor(() => expect(result.current.chats).toHaveLength(2));
    expect(listWorkspaceChats).toHaveBeenCalledWith("ws-1", expect.any(AbortSignal));
    expect(result.current.loadError).toBeNull();
  });

  it("does not fetch when there is no workspace identity", async () => {
    const { result } = renderHook(() => useWorkspaceChats(null));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(listWorkspaceChats).not.toHaveBeenCalled();
    expect(result.current.chats).toEqual([]);
  });

  it("refreshes the list without changing scoped identity", async () => {
    vi.mocked(listWorkspaceChats).mockResolvedValueOnce([makeChat("chat-1")]);

    const { result } = renderHook(() => useWorkspaceChats("ws-1"));
    await waitFor(() => expect(result.current.chats).toHaveLength(1));

    vi.mocked(listWorkspaceChats).mockResolvedValueOnce([
      makeChat("chat-1"),
      makeChat("chat-2"),
    ]);
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.chats).toHaveLength(2);
    expect(listWorkspaceChats).toHaveBeenLastCalledWith(
      "ws-1",
      expect.any(AbortSignal),
    );
  });

  it("reloads when the workspace identity changes", async () => {
    vi.mocked(listWorkspaceChats).mockResolvedValueOnce([makeChat("chat-a")]);

    const { result, rerender } = renderHook(
      ({ wsId }: { wsId: string }) => useWorkspaceChats(wsId),
      { initialProps: { wsId: "ws-1" } },
    );
    await waitFor(() => expect(result.current.chats[0]?.id).toBe("chat-a"));

    vi.mocked(listWorkspaceChats).mockResolvedValueOnce([makeChat("chat-b")]);
    rerender({ wsId: "ws-2" });

    await waitFor(() => expect(result.current.chats[0]?.id).toBe("chat-b"));
    expect(listWorkspaceChats).toHaveBeenLastCalledWith(
      "ws-2",
      expect.any(AbortSignal),
    );
  });

  it("renames a chat and refreshes with the persisted title", async () => {
    vi.mocked(listWorkspaceChats).mockResolvedValueOnce([makeChat("chat-1")]);

    const { result } = renderHook(() => useWorkspaceChats("ws-1"));
    await waitFor(() => expect(result.current.chats).toHaveLength(1));

    vi.mocked(renameWorkspaceChat).mockResolvedValueOnce(true);
    vi.mocked(listWorkspaceChats).mockResolvedValueOnce([
      makeChat("chat-1", { title: "Renamed" }),
    ]);

    let ok = false;
    await act(async () => {
      ok = await result.current.renameChat("chat-1", "Renamed");
    });

    expect(ok).toBe(true);
    expect(renameWorkspaceChat).toHaveBeenCalledWith("ws-1", "chat-1", "Renamed");
    expect(result.current.chats[0].title).toBe("Renamed");
  });

  it("surfaces a rename failure without dropping the row", async () => {
    vi.mocked(listWorkspaceChats).mockResolvedValue([makeChat("chat-1")]);
    vi.mocked(renameWorkspaceChat).mockResolvedValueOnce(false);

    const { result } = renderHook(() => useWorkspaceChats("ws-1"));
    await waitFor(() => expect(result.current.chats).toHaveLength(1));

    let ok = true;
    await act(async () => {
      ok = await result.current.renameChat("chat-1", "Renamed");
    });

    expect(ok).toBe(false);
    expect(result.current.actionError).toMatch(/rename/i);
    expect(result.current.chats).toHaveLength(1);
  });

  it("toggles pin state and refreshes the ordered list", async () => {
    vi.mocked(listWorkspaceChats).mockResolvedValueOnce([makeChat("chat-1")]);

    const { result } = renderHook(() => useWorkspaceChats("ws-1"));
    await waitFor(() => expect(result.current.chats).toHaveLength(1));

    vi.mocked(listWorkspaceChats).mockResolvedValueOnce([
      makeChat("chat-1", { pinned: true }),
    ]);

    await act(async () => {
      await result.current.togglePin("chat-1", true);
    });

    expect(togglePinWorkspaceChat).toHaveBeenCalledWith("ws-1", "chat-1", true);
    expect(result.current.chats[0].pinned).toBe(true);
  });

  it("surfaces a scoped load failure distinct from an empty list", async () => {
    vi.mocked(listWorkspaceChats).mockRejectedValueOnce(new Error("Forbidden"));

    const { result } = renderHook(() => useWorkspaceChats("ws-1"));

    await waitFor(() => expect(result.current.loadError).toBe("Forbidden"));
    expect(result.current.chats).toEqual([]);
  });
});
