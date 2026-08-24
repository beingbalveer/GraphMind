"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, LayoutGrid, Clock, MessageSquare } from "lucide-react";
import { fetchWorkspaces, createWorkspace, WorkspaceItem } from "@/lib/workspaceApi";
import { buildWorkspaceUrl } from "@/lib/urls";
import { LogoBadge } from "@/components/ui/Logo";

export function WorkspaceDashboard() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    async function load() {
      const list = await fetchWorkspaces();
      setWorkspaces(list);
      setLoading(false);
    }
    load();
  }, []);

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

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-zinc-50/50">
        <div className="flex flex-col items-center space-y-4">
          <LogoBadge size="lg" />
          <div className="text-sm text-zinc-500 font-medium animate-pulse">Loading workspaces...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-zinc-50/50 flex flex-col">
      <header className="h-14 border-b border-zinc-200/80 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <LogoBadge size="sm" />
          <span className="font-semibold text-zinc-950 text-[14px] tracking-tight">
            GraphMind
          </span>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-semibold text-zinc-900 flex items-center gap-2">
              <LayoutGrid className="w-6 h-6 text-zinc-400" />
              Your Workspaces
            </h1>
            <button
              onClick={handleCreateWorkspace}
              disabled={isCreating}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Workspace</span>
            </button>
          </div>

          {workspaces.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-4 text-center border-2 border-dashed border-zinc-200 rounded-2xl bg-white/50">
              <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
                <LayoutGrid className="w-6 h-6 text-zinc-400" />
              </div>
              <h3 className="text-lg font-medium text-zinc-900 mb-1">No workspaces yet</h3>
              <p className="text-zinc-500 mb-6 max-w-sm">
                Create your first workspace to start mapping your knowledge in a spatial graph.
              </p>
              <button
                onClick={handleCreateWorkspace}
                disabled={isCreating}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Workspace</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => router.push(buildWorkspaceUrl(ws.id))}
                  className="group flex flex-col text-left bg-white border border-zinc-200/80 rounded-xl p-5 hover:border-zinc-300 hover:shadow-sm transition-all cursor-pointer relative"
                >
                  <div className="flex items-start justify-between w-full mb-3">
                    <h3 className="font-semibold text-zinc-900 group-hover:text-blue-600 transition-colors truncate pr-4">
                      {ws.name}
                    </h3>
                  </div>
                  {ws.description && (
                    <p className="text-sm text-zinc-500 line-clamp-2 mb-4">
                      {ws.description}
                    </p>
                  )}
                  <div className="mt-auto pt-4 flex items-center justify-between text-xs text-zinc-400 border-t border-zinc-100 w-full">
                    <div className="flex items-center gap-1.5 font-medium">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>{ws.nodeCount || 0} nodes</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        {new Date(ws.updatedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
