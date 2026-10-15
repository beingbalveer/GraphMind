"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  MessageSquare,
  Loader2,
  Compass,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  FolderOpen,
  Trash2,
} from "lucide-react";
import {
  fetchWorkspaces,
  createWorkspace,
  renameWorkspace,
  deleteWorkspace,
  WorkspaceItem,
} from "@/lib/workspaceApi";
import { ApiError } from "@/lib/apiClient";
import { buildWorkspaceUrl } from "@/lib/urls";
import { LogoBadge } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { NavigationItem } from "@/components/ui/navigation-item";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { Surface } from "@/components/ui/surface";
import { InlineFeedback } from "@/components/ui/feedback";
import { UserMenu } from "@/components/layout/UserMenu";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { RoadmapJobsNotice } from "@/components/roadmap/RoadmapJobsNotice";
import { RoadmapModal } from "@/components/workspace/RoadmapModal";

/** Turn a failed management write into an actionable, membership-aware message. */
function describeManagementError(action: "rename" | "delete", error: unknown): string {
  const status = error instanceof ApiError ? error.status : 0;
  if (status === 403) {
    return `You do not have permission to ${action} this workspace. Only owners and editors can.`;
  }
  if (status === 404) {
    return `This workspace no longer exists or you are not a member. Refresh and try again.`;
  }
  return `Could not ${action} this workspace. Check your connection and try again.`;
}

export function WorkspaceDashboard() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRoadmapOpen, setIsRoadmapOpen] = useState(false);
  const [resumeJobId, setResumeJobId] = useState<string | null>(null);
  const [workspaceView, setWorkspaceView] = useState<"mine" | "discover">("mine");
  const [renamingWorkspace, setRenamingWorkspace] = useState<WorkspaceItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [deletingWorkspace, setDeletingWorkspace] = useState<WorkspaceItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadWorkspaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchWorkspaces();
      setWorkspaces(list);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load workspaces.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const handleCreateWorkspace = async () => {
    setIsCreating(true);
    try {
      const ws = await createWorkspace("New Workspace", "Created from dashboard");
      router.push(buildWorkspaceUrl(ws.id));
    } catch (err) {
      console.error(err);
      setIsCreating(false);
    }
  };

  const openRename = (workspace: WorkspaceItem) => {
    setActionError(null);
    setRenamingWorkspace(workspace);
    setRenameValue(workspace.name);
  };

  const closeRename = () => {
    if (isRenaming) return;
    setRenamingWorkspace(null);
  };

  const handleRename = async () => {
    if (!renamingWorkspace) return;
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    setIsRenaming(true);
    setActionError(null);
    try {
      const updated = await renameWorkspace(renamingWorkspace.id, trimmed);
      // The id never changes — only the projected metadata does.
      setWorkspaces((prev) =>
        prev.map((ws) => (ws.id === updated.id ? { ...ws, ...updated } : ws))
      );
      setRenamingWorkspace(null);
    } catch (err) {
      setActionError(describeManagementError("rename", err));
    } finally {
      setIsRenaming(false);
    }
  };

  const confirmDeleteWorkspace = async () => {
    if (!deletingWorkspace) return;
    setIsDeleting(true);
    setActionError(null);
    try {
      const removed = await deleteWorkspace(deletingWorkspace.id);
      if (!removed) {
        throw new ApiError(0, "Delete request failed");
      }
      setWorkspaces((prev) => prev.filter((ws) => ws.id !== deletingWorkspace.id));
      setDeletingWorkspace(null);
    } catch (err) {
      setActionError(describeManagementError("delete", err));
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <LogoBadge size="lg" />
          <div className="text-sm text-foreground-muted font-medium animate-pulse">
            Loading learning workspaces...
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <WorkspaceShell
        navigation={
          <aside className="hidden h-full w-[var(--navigation-width)] shrink-0 flex-col border-r border-border-subtle bg-navigation md:flex">
            <div className="flex h-13 shrink-0 items-center gap-2.5 px-4">
              <LogoBadge size="sm" />
              <span className="font-display text-lg text-foreground">GraphMind</span>
            </div>
            <div className="space-y-1 px-2 pt-1">
              <NavigationItem icon={<Plus />} onClick={handleCreateWorkspace} disabled={isCreating}>
                New workspace
              </NavigationItem>
              <NavigationItem icon={<Compass />} onClick={() => setIsRoadmapOpen(true)}>
                Plan a learning roadmap
              </NavigationItem>
            </div>
            <nav aria-label="Workspaces" className="min-h-0 flex-1 overflow-y-auto px-2 pt-6">
              <p className="px-2.5 pb-2 text-label text-foreground-subtle">Workspaces</p>
              {workspaces.map((workspace) => (
                <NavigationItem
                  key={workspace.id}
                  icon={<FolderOpen />}
                  onClick={() => router.push(buildWorkspaceUrl(workspace.id))}
                >
                  {workspace.name}
                </NavigationItem>
              ))}
            </nav>
            <div className="shrink-0 p-3"><UserMenu placement="top" /></div>
          </aside>
        }
        header={
          <header className="flex h-13 shrink-0 items-center justify-between gap-3 bg-background px-4 sm:px-6">
            <h1 className="truncate text-lg font-medium text-foreground">Workspaces</h1>
            <div className="flex shrink-0 items-center gap-2">
              <Button onClick={() => setIsRoadmapOpen(true)} variant="outline" aria-label="Generate roadmap">
                <Compass className="size-4 sm:hidden" />
                <span className="hidden sm:inline">Generate roadmap</span>
              </Button>
              <Button onClick={handleCreateWorkspace} loading={isCreating} loadingLabel="Creating workspace">
                Create new
              </Button>
              <div className="md:hidden"><UserMenu collapsed className="w-8" /></div>
            </div>
          </header>
        }
      >
      <main className="min-w-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
          <div className="mb-8 space-y-3">
            <h2 className="font-display text-xl font-normal text-foreground sm:text-display-sm">Where knowledge connects</h2>
            <p className="text-sm text-foreground-subtle">Your conversations, branches, and ideas in one place.</p>
          </div>
          <div className="mb-6 overflow-x-auto pb-1">
            <SegmentedTabs
              variant="pills"
              ariaLabel="Workspace collection"
              value={workspaceView}
              onChange={setWorkspaceView}
              items={[
                { id: "mine", label: "My workspaces" },
                { id: "discover", label: "Discover" },
              ]}
            />
          </div>

          {/* Explicit Error State */}
          <RoadmapJobsNotice onOpenJob={id => { setResumeJobId(id); setIsRoadmapOpen(true); }} />
          {error && (
            <div className="mb-6">
              <InlineFeedback
                tone="destructive"
                action={
                  <Button size="sm" variant="outline" onClick={loadWorkspaces}>
                    Retry
                  </Button>
                }
              >
                {error}
              </InlineFeedback>
            </div>
          )}
          {actionError && (
            <div className="mb-6">
              <InlineFeedback
                tone="destructive"
                action={
                  <Button size="sm" variant="outline" onClick={() => setActionError(null)}>
                    Dismiss
                  </Button>
                }
              >
                {actionError}
              </InlineFeedback>
            </div>
          )}

          {/* Empty State vs Workspaces Grid */}
          {workspaces.length === 0 && !error ? (
            <Surface
              variant="base"
              radius="card"
              className="py-16 px-6 text-center border-2 border-dashed border-border max-w-2xl mx-auto space-y-4"
            >
              <div className="w-12 h-12 rounded-full bg-muted border border-border flex items-center justify-center mx-auto mb-2">
                <Compass className="w-6 h-6 text-foreground-muted" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                Start your learning journey
              </h3>
              <p className="text-xs text-foreground-muted max-w-md mx-auto leading-relaxed">
                Generate a structured, prerequisite-ordered roadmap for any skill or subject, or start with a blank graph workspace.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button
                  onClick={() => setIsRoadmapOpen(true)}
                  variant="default"
                >
                  Generate AI Roadmap
                </Button>
                <Button
                  onClick={handleCreateWorkspace}
                  disabled={isCreating}
                  variant="outline"
                >
                  {isCreating ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : null}
                  Blank Workspace
                </Button>
              </div>
            </Surface>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {workspaces.map((ws) => (
                <div key={ws.id} className="relative">
                  <Surface
                    variant="base"
                    radius="card"
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(buildWorkspaceUrl(ws.id))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(buildWorkspaceUrl(ws.id));
                      }
                    }}
                    className="group flex h-full cursor-pointer select-none flex-col p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-hover"
                    aria-label={`Open workspace ${ws.name}`}
                  >
                    <div className="mb-2.5 flex w-full items-start justify-between gap-3 pr-8">
                      <div className="flex min-w-0 items-center gap-2">
                        <h3 className="truncate pr-1 text-base font-medium leading-6 text-foreground">
                          {ws.name}
                        </h3>
                        <span className="shrink-0 font-mono text-xs text-foreground-subtle">
                          {ws.nodeCount || 0} nodes
                        </span>
                      </div>
                      <Pin className="mt-0.5 size-4 shrink-0 text-foreground-subtle" />
                    </div>

                    <p className="mb-4 line-clamp-2 flex-1 text-sm leading-5 text-foreground-muted">
                      {ws.description || "Interactive knowledge graph & chat workspace"}
                    </p>

                    <div className="mt-auto flex w-full items-center justify-between border-t border-border-subtle pt-3 text-sm text-foreground-muted">
                      <span className="flex min-w-0 items-center gap-1.5 truncate">
                        <MessageSquare className="size-4 shrink-0" />
                        <span className="truncate">Knowledge workspace</span>
                      </span>
                      <span className="ml-3 flex shrink-0 items-center gap-1.5 text-xs">
                        <Clock className="size-3.5" />
                        {new Date(ws.updatedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </Surface>

                  {/* Management menu stays a sibling so the clickable card is never
                      nested inside another interactive control. */}
                  <div className="absolute right-2 top-2">
                    <DropdownMenu
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Manage ${ws.name}`}
                          className="text-foreground-subtle hover:text-foreground"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      }
                      items={[
                        {
                          label: "Rename",
                          icon: <Pencil className="size-3.5" />,
                          onClick: () => openRename(ws),
                        },
                        {
                          label: "Delete",
                          icon: <Trash2 className="size-3.5" />,
                          variant: "destructive",
                          onClick: () => {
                            setActionError(null);
                            setDeletingWorkspace(ws);
                          },
                        },
                      ]}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      </WorkspaceShell>

      <RoadmapModal
        resumeJobId={resumeJobId}
        isOpen={isRoadmapOpen}
        onClose={() => setIsRoadmapOpen(false)}
      />

      <Modal
        isOpen={Boolean(renamingWorkspace)}
        onClose={closeRename}
        size="sm"
        closeOnClickOutside={!isRenaming}
      >
        <ModalHeader
          title="Rename workspace"
          description="Only the display name changes; the workspace identity and links stay the same."
          icon={<Pencil className="size-4 text-foreground-muted" />}
          onClose={closeRename}
        />
        <ModalBody>
          <Input
            aria-label="Workspace name"
            autoFocus
            inputSize="sm"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleRename();
              }
            }}
            placeholder="Workspace name"
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={closeRename} disabled={isRenaming}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleRename()}
            loading={isRenaming}
            loadingLabel="Renaming workspace"
            disabled={!renameValue.trim()}
          >
            Save
          </Button>
        </ModalFooter>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deletingWorkspace)}
        onClose={() => setDeletingWorkspace(null)}
        onConfirm={confirmDeleteWorkspace}
        isLoading={isDeleting}
        title="Delete workspace"
        description={`Are you sure you want to delete "${deletingWorkspace?.name ?? ""}" and all of its conversations? This cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
      />
    </>
  );
}
