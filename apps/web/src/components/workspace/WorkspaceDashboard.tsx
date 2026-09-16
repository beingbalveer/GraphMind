"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  LayoutGrid,
  Clock,
  MessageSquare,
  Loader2,
  Compass,
  Sparkles,
  Pin,
} from "lucide-react";
import { fetchWorkspaces, createWorkspace, WorkspaceItem } from "@/lib/workspaceApi";
import { buildWorkspaceUrl } from "@/lib/urls";
import { LogoBadge } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { InlineFeedback } from "@/components/ui/feedback";
import { UserMenu } from "@/components/layout/UserMenu";
import { RoadmapModal } from "@/components/workspace/RoadmapModal";

export function WorkspaceDashboard() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRoadmapOpen, setIsRoadmapOpen] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<"mine" | "discover">("mine");

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
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col">
      <header className="h-13 border-b border-border bg-surface px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <LogoBadge size="sm" />
          <span className="font-semibold text-foreground text-sm tracking-tight">
            GraphMind
          </span>
        </div>
        <UserMenu className="w-auto" />
      </header>

      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-10 sm:px-8 lg:py-14">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setWorkspaceView("mine")}
                aria-pressed={workspaceView === "mine"}
                variant="outline"
                size="lg"
                className={
                  workspaceView === "mine"
                    ? "h-11 border-border-strong bg-muted px-5 text-sm hover:bg-muted"
                    : "h-11 border-transparent bg-transparent px-5 text-sm"
                }
              >
                <LayoutGrid className="size-4" />
                My workspaces
              </Button>
              <Button
                onClick={() => setWorkspaceView("discover")}
                aria-pressed={workspaceView === "discover"}
                variant="outline"
                size="lg"
                className={
                  workspaceView === "discover"
                    ? "h-11 border-border-strong bg-muted px-5 text-sm hover:bg-muted"
                    : "h-11 border-transparent bg-transparent px-5 text-sm"
                }
              >
                <Compass className="size-4" />
                Discover
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setIsRoadmapOpen(true)}
                variant="outline"
                size="lg"
                className="h-11 bg-muted px-5 text-sm hover:bg-muted/80"
              >
                <Sparkles className="size-4" />
                Generate roadmap
              </Button>
              <Button
                onClick={handleCreateWorkspace}
                disabled={isCreating}
                variant="default"
                size="lg"
                className="h-11 px-5 text-sm"
              >
                {isCreating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Create new
              </Button>
            </div>
          </div>

          {/* Explicit Error State */}
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
            </Surface>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {workspaces.map((ws) => (
                <Surface
                  key={ws.id}
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
                  className="group relative flex cursor-pointer select-none flex-col p-5 text-left transition-colors hover:border-border-strong hover:bg-surface-hover"
                  aria-label={`Open workspace ${ws.name}`}
                >
                  <div className="mb-2.5 flex w-full items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <h3 className="truncate pr-1 text-base font-semibold leading-6 text-foreground">
                        {ws.name}
                      </h3>
                      <span className="shrink-0 font-mono text-xs text-foreground-subtle">
                        {ws.nodeCount || 0} nodes
                      </span>
                    </div>
                    <Pin className="mt-0.5 size-4 shrink-0 text-foreground-subtle" />
                  </div>

                  <p className="mb-4 line-clamp-2 flex-1 text-base leading-6 text-foreground-muted">
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
