import { ArrowRight, Clock, Compass, LayoutGrid, MessageSquare, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

function WorkspacePreview({ font }: { font: "public" | "geist" | "system" }) {
  const fontFamily =
    font === "public"
      ? "var(--font-public-sans)"
      : font === "geist"
        ? "var(--font-geist-sans)"
        : "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  const label = font === "public" ? "Public Sans" : font === "geist" ? "Geist" : "System UI";

  return (
    <section
      className="min-w-0 flex-1 bg-background-secondary px-6 py-10 text-foreground"
      style={{ fontFamily }}
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2.5 text-2xl font-semibold text-foreground">
              <LayoutGrid className="h-6 w-6 text-foreground-muted" />
              Learning Workspaces
            </h2>
            <p className="mt-1 text-xs text-foreground-muted">
              Visual knowledge graphs, learning roadmaps, and branching conversation trees
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button variant="default" size="default">
              <Compass className="mr-1.5 h-4 w-4" />
              Generate Roadmap
            </Button>
            <Button variant="outline" size="default">
              <Plus className="mr-1.5 h-4 w-4" />
              New Workspace
            </Button>
          </div>
        </div>

        <div className="max-w-md rounded-2xl border border-border bg-surface-raised p-5">
          <div className="mb-2.5 flex w-full items-start justify-between">
            <h3 className="truncate pr-3 text-sm font-semibold text-foreground">Main Workspace</h3>
            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-foreground-muted" />
          </div>
          <p className="mb-4 text-xs leading-relaxed text-foreground-muted">Default knowledge tree</p>
          <div className="flex items-center justify-between border-t border-border-subtle pt-3 text-2xs text-foreground-muted">
            <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 font-mono">
              <MessageSquare className="h-3 w-3" />
              39 nodes
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Aug 22
            </span>
          </div>
        </div>

        <p className="mt-5 text-center font-mono text-2xs text-foreground-subtle">{label}</p>
      </div>
    </section>
  );
}

export default function FontComparisonPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-surface px-6 py-4 text-center text-sm font-medium">
        Font comparison
      </div>
      <div className="grid min-h-[calc(100vh-57px)] grid-cols-1 gap-px bg-border lg:grid-cols-2">
        <WorkspacePreview font="public" />
        <WorkspacePreview font="geist" />
        <WorkspacePreview font="system" />
      </div>
    </main>
  );
}
