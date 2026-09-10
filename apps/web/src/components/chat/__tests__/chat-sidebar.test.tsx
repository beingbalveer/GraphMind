import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChatSidebar } from "../ChatSidebar";
import type { ChatItem } from "@/lib/workspaceApi";

// Mock AuthContext for UserMenu
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u-1", email: "tester@graphmind.app", fullName: "Test User", provider: "google" },
    logout: vi.fn(),
  }),
}));

const mockChats: ChatItem[] = [
  {
    id: "chat-1",
    workspaceId: "ws-1",
    title: "Quantum Computing Exploration",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodeCount: 2,
    pinned: false,
  },
  {
    id: "chat-2",
    workspaceId: "ws-1",
    title: "Pinned Architecture Notes",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodeCount: 5,
    pinned: true,
  },
];

describe("ChatSidebar & UserMenu Contract (Scope 3, Task 2)", () => {
  it("enforces zero raw <button> elements and semantic tokens in ChatSidebar and UserMenu", () => {
    const files = ["ChatSidebar.tsx", "../layout/UserMenu.tsx"];

    for (const relPath of files) {
      const content = readFileSync(
        path.resolve(process.cwd(), `src/components/chat/${relPath}`),
        "utf8"
      );

      // No raw <button> tags
      expect(content, `${relPath} must not contain raw <button> elements`).not.toMatch(/<button\b/);

      // No hardcoded zinc or white utility classes
      expect(
        content,
        `${relPath} must not contain hardcoded zinc or white utility classes`
      ).not.toMatch(/\b(?:bg|text|border|ring)-(?:white|zinc)-/);
    }
  });

  it("renders thread groups, shows active chat with aria-current, and handles chat selection", async () => {
    const user = userEvent.setup();
    const handleSelectChat = vi.fn();
    const handleToggle = vi.fn();
    const handleNewChat = vi.fn();
    const handleRename = vi.fn().mockResolvedValue(undefined);
    const handleDelete = vi.fn();

    render(
      <ChatSidebar
        isOpen={true}
        onToggle={handleToggle}
        chats={mockChats}
        activeChatId="chat-1"
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDelete}
        onRenameChat={handleRename}
        onNewChat={handleNewChat}
        workspaceName="Research Lab"
      />
    );

    // Workspace name displayed
    expect(screen.getByText("Research Lab")).toBeInTheDocument();

    // Both chats should be rendered
    const activeChatEl = screen.getByText("Quantum Computing Exploration").closest("[role='button']");
    const pinnedChatEl = screen.getByText("Pinned Architecture Notes").closest("[role='button']");

    expect(activeChatEl).toBeInTheDocument();
    expect(pinnedChatEl).toBeInTheDocument();

    // Active chat has aria-current="page"
    expect(activeChatEl).toHaveAttribute("aria-current", "page");
    expect(pinnedChatEl).not.toHaveAttribute("aria-current");

    // Clicking chat item invokes onSelectChat
    if (pinnedChatEl) {
      await user.click(pinnedChatEl);
      expect(handleSelectChat).toHaveBeenCalledWith(mockChats[1]);
    }

    // Keyboard selection via Enter key
    if (activeChatEl) {
      handleSelectChat.mockClear();
      (activeChatEl as HTMLElement).focus();
      await user.keyboard("{Enter}");
      expect(handleSelectChat).toHaveBeenCalledWith(mockChats[0]);
    }
  });

  it("triggers actions for new chat and toggle button", async () => {
    const user = userEvent.setup();
    const handleToggle = vi.fn();
    const handleNewChat = vi.fn();
    const handleOpenFileLibrary = vi.fn();
    const handleOpenSettings = vi.fn();

    render(
      <ChatSidebar
        isOpen={true}
        onToggle={handleToggle}
        chats={mockChats}
        activeChatId={null}
        onSelectChat={vi.fn()}
        onDeleteChat={vi.fn()}
        onRenameChat={vi.fn().mockResolvedValue(undefined)}
        onNewChat={handleNewChat}
        onOpenFileLibrary={handleOpenFileLibrary}
        onOpenSettings={handleOpenSettings}
      />
    );

    const newChatBtn = screen.getByRole("button", { name: /new chat/i });
    await user.click(newChatBtn);
    expect(handleNewChat).toHaveBeenCalledTimes(1);

    const toggleBtn = screen.getByRole("button", { name: /collapse sidebar/i });
    await user.click(toggleBtn);
    expect(handleToggle).toHaveBeenCalledTimes(1);

    const fileLibraryBtn = screen.getByRole("button", { name: /workspace file library/i });
    await user.click(fileLibraryBtn);
    expect(handleOpenFileLibrary).toHaveBeenCalledTimes(1);

    const settingsBtn = screen.getByRole("button", { name: /settings/i });
    await user.click(settingsBtn);
    expect(handleOpenSettings).toHaveBeenCalledTimes(1);
  });
});
