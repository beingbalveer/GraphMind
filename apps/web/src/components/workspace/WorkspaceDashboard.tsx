"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, LayoutGrid, Clock, MessageSquare, Loader2, Compass, Sparkles } from "lucide-react";
import { fetchWorkspaces, createWorkspace, WorkspaceItem } from "@/lib/workspaceApi";
import { buildWorkspaceUrl } from "@/lib/urls";
import { LogoBadge } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/UserMenu";
import { RoadmapModal } from "@/components/workspace/RoadmapModal";

export function WorkspaceDashboard() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isRoadmapOpen, setIsRoadmapOpen] = useState(false);

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
      <div className="min-h-screen w-full flex items-center justify-center bg-background-secondary">
        <div className="flex flex-col items-center gap-4">
          <LogoBadge size="lg" />
          <div className="text-sm text-foreground-muted font-medium animate-pulse">
            Loading workspaces...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background-secondary text-foreground flex flex-col">
      <header className="h-13 border-b border-border bg-surface/90 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <LogoBadge size="sm" />
          <span className="font-semibold text-foreground text-sm tracking-tight">
            GraphMind
          </span>
        </div>
        <UserMenu />
      </header>

      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2.5">
                <LayoutGrid className="w-6 h-6 text-foreground-muted" />
                Your Workspaces
              </h1>
              <p className="text-xs text-foreground-muted mt-1">
                Visual knowledge graphs, learning roadmaps, and conversation trees
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                onClick={() => setIsRoadmapOpen(true)}
                variant="default"
                size="default"
              >
                <Compass className="w-4 h-4 mr-1.5" />
                <span>Generate Roadmap</span>
              </Button>
              <Button
                onClick={handleCreateWorkspace}
                disabled={isCreating}
                variant="outline"
                size="default"
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-1.5" />
                )}
                <span>New Workspace</span>
              </Button>
            </div>
          </div>

          {workspaces.length === 0 ? (
            <div className="py-16 px-6 text-center border-2 border-dashed border-border rounded-2xl bg-surface/50 max-w-2xl mx-auto">
              <div className="w-12 h-12 rounded-full bg-muted border border-border flex items-center justify-center mx-auto mb-4">
                <Compass className="w-6 h-6 text-foreground-muted" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-1.5">
                Start your learning journey
              </h3>
              <p className="text-xs text-foreground-muted mb-6 max-w-md mx-auto">
                Generate a structured, prerequisite-ordered roadmap for any skill or subject, or create a blank graph workspace.
              </p>
              <div className="flex items-center justify-center gap-3">
                <Button
                  onClick={() => setIsRoadmapOpen(true)}
                  variant="default"
                  size="default"
                >
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  <span>Generate AI Roadmap</span>
                </Button>
                <Button
                  onClick={handleCreateWorkspace}
                  disabled={isCreating}
                  variant="outline"
                  size="default"
                >
                  {isCreating ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-1.5" />
                  )}
                  <span>Blank Workspace</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => router.push(buildWorkspaceUrl(ws.id))}
                  className="group flex flex-col text-left bg-surface border border-border rounded-xl p-5 hover:border-border-subtle hover:shadow-xs transition-all cursor-pointer relative"
                >
                  <div className="flex items-start justify-between w-full mb-2.5">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate pr-4 text-sm">
                      {ws.name}
                    </h3>
                  </div>
                  {ws.description && (
                    <p className="text-xs text-foreground-muted line-clamp-2 mb-4 leading-relaxed">
                      {ws.description}
                    </p>
                  )}
                  <div className="mt-auto pt-4 flex items-center justify-between text-2xs text-foreground-muted border-t border-border-subtle w-full">
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

      <RoadmapModal
        isOpen={isRoadmapOpen}
        onClose={() => setIsRoadmapOpen(false)}
      />
    </div>
  );
}
