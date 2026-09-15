"use client";

import React, { useState, useEffect } from "react";
import {
  FolderGit2,
  Plus,
  Trash2,
  Check,
  FileCode2,
  FileText,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ModalHeader, ModalBody } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  WorkspaceItem,
  fetchWorkspaces,
  createWorkspace,
  deleteWorkspace,
} from "@/lib/workspaceApi";
import { exportTreeToJson, exportTreeToMarkdown } from "@/lib/exportUtils";
import { ConversationTree } from "@graphmind/shared";

interface WorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWorkspace: WorkspaceItem | null;
  onSelectWorkspace: (workspace: WorkspaceItem) => void;
  activeTree: ConversationTree | null;
}

export function WorkspaceModal({
  isOpen,
  onClose,
  currentWorkspace,
  onSelectWorkspace,
  activeTree,
}: WorkspaceModalProps) {
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [deletingWorkspaceId, setDeletingWorkspaceId] = useState<string | null>(null);

  const loadWorkspaces = async () => {
    setIsLoading(true);
    const list = await fetchWorkspaces();
    setWorkspaces(list);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadWorkspaces();
    }
  }, [isOpen]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      const created = await createWorkspace(
        newName.trim(),
        newDesc.trim() || undefined
      );
      setNewName("");
      setNewDesc("");
      setIsCreating(false);
      await loadWorkspaces();
      onSelectWorkspace(created);
    } catch (err) {
      console.error("Failed to create workspace:", err);
    }
  };

  const confirmDeleteWorkspace = async () => {
    if (!deletingWorkspaceId) return;
    await deleteWorkspace(deletingWorkspaceId);
    setWorkspaces((prev) => prev.filter((w) => w.id !== deletingWorkspaceId));
    setDeletingWorkspaceId(null);
  };

  if (!isOpen) return null;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        {/* Standardized Header */}
        <ModalHeader
          title="Workspaces"
          description="Manage and persist your knowledge trees"
          icon={<FolderGit2 className="w-4 h-4 text-foreground-muted" />}
          onClose={onClose}
        />

        {/* Content Body */}
        <ModalBody className="space-y-4 max-h-[420px]">
          {/* Active Workspace Export Actions */}
          <div className="p-3.5 rounded-xl bg-muted/60 border border-border flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-foreground">Export Knowledge Graph</div>
              <div className="text-xs text-foreground-muted">Download for Obsidian or backup</div>
            </div>
            <div className="flex items-center space-x-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportTreeToMarkdown(activeTree, currentWorkspace?.name || "GraphMind")}
                className="h-7 text-xs flex items-center space-x-1"
                title="Export Obsidian Markdown"
              >
                <FileText className="w-3.5 h-3.5 text-foreground-muted" />
                <span>Markdown</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportTreeToJson(activeTree, currentWorkspace?.name || "GraphMind")}
                className="h-7 text-xs flex items-center space-x-1"
                title="Export JSON Graph"
              >
                <FileCode2 className="w-3.5 h-3.5 text-foreground-muted" />
                <span>JSON</span>
              </Button>
            </div>
          </div>

          {/* New Workspace Button / Form */}
          {isCreating ? (
            <form onSubmit={handleCreate} className="p-3.5 rounded-xl border border-border bg-surface space-y-2.5 shadow-2xs">
              <div className="text-xs font-semibold text-foreground">Create New Workspace</div>
              <Input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Workspace Title (e.g. Distributed Systems)"
                autoFocus
                inputSize="sm"
              />
              <Input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Optional description"
                inputSize="sm"
              />
              <div className="flex items-center justify-end space-x-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCreating(false)}
                  className="h-7 text-xs"
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="h-7 text-xs">
                  Create
                </Button>
              </div>
            </form>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreating(true)}
              className="w-full h-8 text-xs flex items-center justify-center space-x-1.5 border-dashed"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Workspace</span>
            </Button>
          )}

          {/* Workspaces List */}
          <div className="space-y-1.5">
            <div className="text-2xs font-semibold text-foreground-muted uppercase tracking-wider px-1">
              Your Workspaces ({workspaces.length})
            </div>

            {isLoading ? (
              <div className="py-8 flex items-center justify-center text-xs text-foreground-muted space-x-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading workspaces...</span>
              </div>
            ) : workspaces.length === 0 ? (
              <div className="p-4 text-center text-xs text-foreground-muted">
                No saved workspaces yet. Create one above to persist your knowledge trees.
              </div>
            ) : (
              workspaces.map((ws) => {
                const isActive = currentWorkspace?.id === ws.id;
                return (
                  <div
                    key={ws.id}
                    className="flex items-center gap-1.5"
                  >
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        onSelectWorkspace(ws);
                        onClose();
                      }}
                      aria-label={`Select ${ws.name}`}
                      className={`h-auto min-w-0 flex-1 justify-start rounded-xl px-3 py-3 text-left ${
                        isActive
                          ? "border-primary bg-surface-hover shadow-2xs"
                          : "border-border hover:border-border-subtle hover:bg-surface-hover"
                      }`}
                    >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-semibold text-foreground truncate">
                          {ws.name}
                        </span>
                        {isActive && (
                          <span className="inline-flex items-center space-x-0.5 text-2xs px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground font-medium">
                            <Check className="w-2.5 h-2.5" />
                            <span>Active</span>
                          </span>
                        )}
                      </div>
                      {ws.description && (
                        <p className="text-xs text-foreground-muted truncate mt-0.5">
                          {ws.description}
                        </p>
                      )}
                      <div className="text-2xs text-foreground-muted mt-1">
                        {ws.nodeCount} {ws.nodeCount === 1 ? "node" : "nodes"} • Updated{" "}
                        {new Date(ws.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeletingWorkspaceId(ws.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive-bg"
                      title="Delete Workspace"
                      aria-label="Delete Workspace"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </ModalBody>
      </Modal>

      {/* Common Reusable Confirm Dialog for Workspace Deletion */}
      <ConfirmDialog
        isOpen={Boolean(deletingWorkspaceId)}
        onClose={() => setDeletingWorkspaceId(null)}
        onConfirm={confirmDeleteWorkspace}
        title="Delete workspace"
        description="Are you sure you want to delete this workspace and all its conversations? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />
    </>
  );
}
