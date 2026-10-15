import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspaceDashboard } from "../WorkspaceDashboard";
import * as workspaceApi from "@/lib/workspaceApi";
import { ApiError } from "@/lib/apiClient";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u-1", email: "test@graphmind.app", fullName: "Test User", provider: "google" },
    logout: vi.fn(),
  }),
}));

function workspace(overrides: Partial<workspaceApi.WorkspaceItem> = {}): workspaceApi.WorkspaceItem {
  return {
    id: "ws-1",
    name: "Algorithms & DS",
    description: "Graphs, trees, and complexity",
    nodeCount: 14,
    viewportX: 0,
    viewportY: 0,
    zoom: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

async function renderDashboard(items: workspaceApi.WorkspaceItem[]) {
  const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
  vi.spyOn(workspaceApi, "fetchWorkspaces").mockResolvedValue(items);
  render(<WorkspaceDashboard />);
  await waitFor(() => {
    expect(screen.getByRole("heading", { name: items[0].name })).toBeInTheDocument();
  });
  return user;
}

async function openManagementMenu(
  user: ReturnType<typeof userEvent.setup>,
  workspaceName: string
) {
  await user.click(screen.getByRole("button", { name: `Manage ${workspaceName}` }));
  return screen.findByRole("menu");
}

describe("WorkspaceDashboard management (LSI-040)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renames a workspace and keeps the same identity and canonical URL", async () => {
    const user = await renderDashboard([workspace()]);
    const renameSpy = vi
      .spyOn(workspaceApi, "renameWorkspace")
      .mockResolvedValue(workspace({ name: "Algorithms" }));

    await openManagementMenu(user, "Algorithms & DS");
    await user.click(await screen.findByRole("menuitem", { name: "Rename" }));

    const input = screen.getByRole("textbox", { name: "Workspace name" });
    expect(input).toHaveValue("Algorithms & DS");
    await user.clear(input);
    await user.type(input, "Algorithms");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(renameSpy).toHaveBeenCalledWith("ws-1", "Algorithms");
    });
    // Same id, only the projected name changes.
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Algorithms" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { name: "Algorithms & DS" })).not.toBeInTheDocument();

    mockPush.mockClear();
    await user.click(screen.getByRole("button", { name: "Open workspace Algorithms" }));
    expect(mockPush).toHaveBeenCalledWith("/w/ws-1");
  });

  it("requires confirmation before deleting a workspace", async () => {
    const user = await renderDashboard([workspace()]);
    const deleteSpy = vi.spyOn(workspaceApi, "deleteWorkspace").mockResolvedValue(true);

    await openManagementMenu(user, "Algorithms & DS");
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));

    expect(await screen.findByText("Delete workspace")).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to delete "Algorithms & DS"/)
    ).toBeInTheDocument();
    expect(deleteSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith("ws-1");
    });
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Algorithms & DS" })).not.toBeInTheDocument();
    });
  });

  it("keeps the workspace when deletion is cancelled", async () => {
    const user = await renderDashboard([workspace()]);
    const deleteSpy = vi.spyOn(workspaceApi, "deleteWorkspace").mockResolvedValue(true);

    await openManagementMenu(user, "Algorithms & DS");
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(deleteSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Algorithms & DS" })).toBeInTheDocument();
  });

  it("surfaces an actionable membership error and leaves the workspace intact", async () => {
    const user = await renderDashboard([workspace()]);
    vi.spyOn(workspaceApi, "renameWorkspace").mockRejectedValue(
      new ApiError(403, "Viewer role does not have permission to modify this workspace.")
    );

    await openManagementMenu(user, "Algorithms & DS");
    await user.click(await screen.findByRole("menuitem", { name: "Rename" }));
    const input = screen.getByRole("textbox", { name: "Workspace name" });
    await user.clear(input);
    await user.type(input, "Hijacked");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText(/You do not have permission to rename this workspace/)
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Algorithms & DS" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Hijacked" })).not.toBeInTheDocument();
  });

  it("builds every navigation URL through the canonical helper", () => {
    const content = readFileSync(
      path.resolve(process.cwd(), "src/components/workspace/WorkspaceDashboard.tsx"),
      "utf8"
    );
    expect(content).toContain('from "@/lib/urls"');
    expect(content).toContain("buildWorkspaceUrl(");
    // No hardcoded /w/ path strings in the component body.
    expect(content).not.toMatch(/["'`]\/w\//);
  });
});
