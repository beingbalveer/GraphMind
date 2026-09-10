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
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { fetchWorkspaces, createWorkspace, WorkspaceItem } from "@/lib/workspaceApi";
import { buildWorkspaceUrl } from "@/lib/urls";
import { LogoBadge } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
      <div className="min-h-screen w-full flex items-center justify-center bg-background-secondary">
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
    <div className="min-h-screen w-full bg-background-secondary text-foreground flex flex-col">
      <header className="h-13 border-b border-border bg-surface/90 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <LogoBadge size="sm" />
          <span className="font-semibold text-foreground text-sm tracking-tight">
            GraphMind
          </span>
        </div>
        <UserMenu />
      </header>

      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-12">
          {/* Header row with Title & Primary Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2.5">
                <LayoutGrid className="w-6 h-6 text-foreground-muted" />
                Learning Workspaces
              </h1>
              <p className="text-xs text-foreground-muted mt-1">
                Visual knowledge graphs, learning roadmaps, and branching conversation trees
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {workspaces.map((ws) => (
                <Surface
                  key={ws.id}
                  variant="raised"
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
                  className="group flex flex-col text-left p-5 hover:border-border-strong hover:shadow-xs transition-all cursor-pointer relative select-none"
                  aria-label={`Open workspace ${ws.name}`}
                >
                  <div className="flex items-start justify-between w-full mb-2.5">
                    <h3 className="font-semibold text-foreground group-hover:text-foreground transition-colors truncate pr-3 text-sm">
                      {ws.name}
                    </h3>
                    <ArrowRight className="w-4 h-4 text-foreground-muted group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
                  </div>

                  <p className="text-xs text-foreground-muted line-clamp-2 mb-4 leading-relaxed flex-1">
                    {ws.description || "Interactive knowledge graph & chat workspace"}
                  </p>

                  <div className="mt-auto pt-3 flex items-center justify-between text-2xs text-foreground-muted border-t border-border-subtle w-full">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="gap-1 font-mono text-2xs">
                        <MessageSquare className="w-3 h-3" />
                        <span>{ws.nodeCount || 0} nodes</span>
                      </Badge>
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
