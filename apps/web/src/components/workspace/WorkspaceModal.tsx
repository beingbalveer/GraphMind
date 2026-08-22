"use client";

import React, { useState, useEffect } from "react";
import {
  FolderGit2,
  Plus,
  Trash2,
  Check,
  X,
  FileCode2,
  FileText,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
      const created = await createWorkspace(newName.trim(), newDesc.trim() || undefined);
      setWorkspaces((prev) => [created, ...prev]);
      onSelectWorkspace(created);
      setNewName("");
      setNewDesc("");
      setIsCreating(false);
    } catch (err) {
      console.error("Failed to create workspace:", err);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this workspace?")) return;
    await deleteWorkspace(id);
    setWorkspaces((prev) => prev.filter((w) => w.id !== id));
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 select-none font-sans"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white rounded-2xl border border-zinc-200/90 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="h-14 px-5 border-b border-zinc-200/80 flex items-center justify-between shrink-0 bg-zinc-50/70">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-zinc-100 border border-zinc-200/90 text-zinc-800 flex items-center justify-center shadow-2xs">
              <FolderGit2 className="w-4 h-4 text-zinc-600" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-zinc-900 leading-tight">Workspaces</h3>
              <p className="text-[11px] text-zinc-500">Manage and persist your knowledge trees</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[420px] overflow-y-auto">
          {/* Active Workspace Export Actions */}
          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-zinc-900">Export Knowledge Graph</div>
              <div className="text-[11px] text-zinc-500">Download for Obsidian or backup</div>
            </div>
            <div className="flex items-center space-x-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportTreeToMarkdown(activeTree, currentWorkspace?.name || "GraphMind")}
                className="h-7 text-xs flex items-center space-x-1"
                title="Export Obsidian Markdown"
              >
                <FileText className="w-3.5 h-3.5 text-zinc-500" />
                <span>Markdown</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportTreeToJson(activeTree, currentWorkspace?.name || "GraphMind")}
                className="h-7 text-xs flex items-center space-x-1"
                title="Export JSON Graph"
              >
                <FileCode2 className="w-3.5 h-3.5 text-zinc-500" />
                <span>JSON</span>
              </Button>
            </div>
          </div>

          {/* New Workspace Button / Form */}
          {isCreating ? (
            <form onSubmit={handleCreate} className="p-3.5 rounded-xl border border-zinc-300 bg-white space-y-2.5">
              <div className="text-xs font-semibold text-zinc-900">Create New Workspace</div>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Workspace Title (e.g. Distributed Systems)"
                autoFocus
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Optional description"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-900"
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
            <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-1">
              Your Workspaces ({workspaces.length})
            </div>

            {isLoading ? (
              <div className="py-8 flex items-center justify-center text-xs text-zinc-400 space-x-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading workspaces...</span>
              </div>
            ) : workspaces.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-500">
                No saved workspaces yet. Create one above to persist your knowledge trees.
              </div>
            ) : (
              workspaces.map((ws) => {
                const isActive = currentWorkspace?.id === ws.id;
                return (
                  <div
                    key={ws.id}
                    onClick={() => {
                      onSelectWorkspace(ws);
                      onClose();
                    }}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      isActive
                        ? "border-zinc-900 bg-zinc-50 shadow-2xs"
                        : "border-zinc-200/80 hover:border-zinc-300 hover:bg-zinc-50/50"
                    }`}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-semibold text-zinc-900 truncate">
                          {ws.name}
                        </span>
                        {isActive && (
                          <span className="inline-flex items-center space-x-0.5 text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-900 text-white font-medium">
                            <Check className="w-2.5 h-2.5" />
                            <span>Active</span>
                          </span>
                        )}
                      </div>
                      {ws.description && (
                        <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                          {ws.description}
                        </p>
                      )}
                      <div className="text-[10px] text-zinc-400 mt-1">
                        {ws.nodeCount} {ws.nodeCount === 1 ? "node" : "nodes"} • Updated{" "}
                        {new Date(ws.updatedAt).toLocaleDateString()}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, ws.id)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete Workspace"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
