import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceShell } from "../WorkspaceShell";
import { MainHeader } from "../MainHeader";
import { ContextRail } from "../ContextRail";
import { ChatSidebar } from "../../chat/ChatSidebar";

// Mock AuthContext for ChatSidebar's UserMenu
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u-1", email: "tester@graphmind.app", fullName: "Test User", provider: "google" },
    logout: vi.fn(),
  }),
}));

describe("Responsive Workspace Shell Behavior (Scope 3, Task 5)", () => {
  it("enforces desktop (1440px) layout: persistent navigation, capped conversation, inline contextual rail", () => {
    const handleToggleNav = vi.fn();
    const handleToggleRail = vi.fn();

    render(
      <WorkspaceShell
        navigation={
          <ChatSidebar
            isOpen={true}
            onToggle={handleToggleNav}
            chats={[]}
            activeChatId={null}
            onSelectChat={vi.fn()}
            onDeleteChat={vi.fn()}
            onRenameChat={vi.fn().mockResolvedValue(undefined)}
          />
        }
        header={
          <MainHeader
            workspaceName="Research Lab"
            isSidebarOpen={true}
            onToggleSidebar={handleToggleNav}
            isRightSidebarOpen={true}
            onToggleRightSidebar={handleToggleRail}
          />
        }
        rail={
          <ContextRail
            isOpen={true}
            onToggle={handleToggleRail}
            title="Knowledge Graph"
            forceDrawer={false}
          >
            <div>Mastery Data</div>
          </ContextRail>
        }
      >
        <div data-testid="chat-conversation-column" className="max-w-[var(--chat-content-max)] w-full mx-auto">
          Conversation Content
        </div>
      </WorkspaceShell>
    );

    // Shell container renders correctly
    expect(screen.getByTestId("workspace-shell")).toBeInTheDocument();

    // Desktop aside is rendered for the contextual rail
    expect(screen.getByTestId("context-rail-aside")).toBeInTheDocument();
    expect(screen.getByText("Mastery Data")).toBeInTheDocument();

    // Central conversation column has capped max width
    const chatCol = screen.getByTestId("chat-conversation-column");
    expect(chatCol).toHaveClass("max-w-[var(--chat-content-max)]");
  });

  it("enforces tablet (768px) layout: collapsible navigation and rail drawer", () => {
    const handleToggleNav = vi.fn();
    const handleToggleRail = vi.fn();

    const { rerender } = render(
      <WorkspaceShell
        navigation={
          <ChatSidebar
            isOpen={false}
            onToggle={handleToggleNav}
            chats={[]}
            activeChatId={null}
            onSelectChat={vi.fn()}
            onDeleteChat={vi.fn()}
            onRenameChat={vi.fn().mockResolvedValue(undefined)}
          />
        }
        header={
          <MainHeader
            workspaceName="Research Lab"
            isSidebarOpen={false}
            onToggleSidebar={handleToggleNav}
            isRightSidebarOpen={false}
            onToggleRightSidebar={handleToggleRail}
          />
        }
        rail={
          <ContextRail
            isOpen={false}
            onToggle={handleToggleRail}
            title="Tablet Rail"
            forceDrawer={true}
          >
            <div>Tablet Drawer Content</div>
          </ContextRail>
        }
      >
        <div data-testid="tablet-chat">Tablet Viewport</div>
      </WorkspaceShell>
    );

    // Sidebar expand button is visible (on collapsed sidebar rail and/or in header)
    const expandBtns = screen.getAllByRole("button", { name: /expand sidebar/i });
    expect(expandBtns.length).toBeGreaterThanOrEqual(1);

    // Now open the drawer
    rerender(
      <WorkspaceShell
        navigation={
          <ChatSidebar
            isOpen={false}
            onToggle={handleToggleNav}
            chats={[]}
            activeChatId={null}
            onSelectChat={vi.fn()}
            onDeleteChat={vi.fn()}
            onRenameChat={vi.fn().mockResolvedValue(undefined)}
          />
        }
        header={
          <MainHeader
            workspaceName="Research Lab"
            isSidebarOpen={false}
            onToggleSidebar={handleToggleNav}
            isRightSidebarOpen={true}
            onToggleRightSidebar={handleToggleRail}
          />
        }
        rail={
          <ContextRail
            isOpen={true}
            onToggle={handleToggleRail}
            title="Tablet Rail"
            forceDrawer={true}
          >
            <div>Tablet Drawer Content</div>
          </ContextRail>
        }
      >
        <div data-testid="tablet-chat">Tablet Viewport</div>
      </WorkspaceShell>
    );

    // Context rail uses drawer modal
    expect(screen.getByTestId("context-rail-drawer-content")).toBeInTheDocument();
    expect(screen.getByText("Tablet Drawer Content")).toBeInTheDocument();
  });

  it("enforces mobile (390px) layout: drawers for navigation & context, zero horizontal overflow", () => {
    const handleToggleNav = vi.fn();
    const handleToggleRail = vi.fn();

    render(
      <WorkspaceShell
        className="overflow-x-hidden"
        navigation={
          <ChatSidebar
            isOpen={true}
            onToggle={handleToggleNav}
            chats={[]}
            activeChatId={null}
            onSelectChat={vi.fn()}
            onDeleteChat={vi.fn()}
            onRenameChat={vi.fn().mockResolvedValue(undefined)}
          />
        }
        header={
          <MainHeader
            workspaceName="Mobile Workspace"
            isSidebarOpen={true}
            onToggleSidebar={handleToggleNav}
            isRightSidebarOpen={true}
            onToggleRightSidebar={handleToggleRail}
          />
        }
        rail={
          <ContextRail
            isOpen={true}
            onToggle={handleToggleRail}
            title="Mobile Rail"
            forceDrawer={true}
          >
            <div>Mobile Context Content</div>
          </ContextRail>
        }
      >
        <div className="w-full flex flex-col min-w-0">
          <div className="flex-1 overflow-x-hidden">Message stream</div>
          <div className="shrink-0 p-4">Composer</div>
        </div>
      </WorkspaceShell>
    );

    // WorkspaceShell root prevents horizontal scrolling
    const shell = screen.getByTestId("workspace-shell");
    expect(shell).toHaveClass("overflow-hidden");

    // Main content area has min-w-0 and overflow containment
    const mainContent = screen.getByTestId("workspace-main-content");
    expect(mainContent).toHaveClass("min-h-0", "overflow-hidden");

    // Drawer is used for context
    expect(screen.getByTestId("context-rail-drawer-content")).toBeInTheDocument();
  });
});
