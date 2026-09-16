"use client";

import { useState } from "react";
import { BookOpen, Compass, FileText, Flag, LayoutGrid, MessageSquare, Pin, Plus, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

const recentThreads = [
  {
    type: "Conversation",
    icon: MessageSquare,
    title: "Understanding graph traversal",
    workspace: "Algorithms",
    updated: "12 min ago",
  },
  {
    type: "Flashcards",
    icon: BookOpen,
    title: "Generated review cards",
    workspace: "Algorithms",
    updated: "Yesterday",
  },
  {
    type: "File",
    icon: FileText,
    title: "Uploaded distributed systems notes",
    workspace: "Systems Design",
    updated: "Yesterday",
  },
  {
    type: "Roadmap",
    icon: Flag,
    title: "Generated a machine learning roadmap",
    workspace: "Machine Learning",
    updated: "Aug 22",
  },
];

const workspaces = [
  {
    name: "Algorithms",
    description: "Data structures, graph theory, and problem solving",
    conversation: "Understanding graph traversal",
    updated: "12 min ago",
    nodes: "39 nodes",
    pinned: true,
  },
  {
    name: "Systems Design",
    description: "Distributed systems and scalable architecture",
    conversation: "Designing a reliable queue",
    updated: "Yesterday",
    nodes: "24 nodes",
    pinned: true,
  },
  {
    name: "Machine Learning",
    description: "A structured path from fundamentals to practice",
    conversation: "Neural network foundations",
    updated: "Aug 22",
    nodes: "18 nodes",
    pinned: false,
  },
  {
    name: "Writing",
    description: "Clearer thinking through deliberate practice",
    conversation: "Building a writing habit",
    updated: "Aug 18",
    nodes: "12 nodes",
    pinned: false,
  },
];

function SectionHeading({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-lg font-semibold leading-7 text-foreground">{children}</h2>
      {action}
    </div>
  );
}

function RecentThreadList() {
  return (
    <div className="divide-y divide-border-subtle">
      {recentThreads.map((thread) => {
        const Icon = thread.icon;
        return (
          <div key={thread.title} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border border-border-subtle text-foreground-muted">
              <Icon className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-normal leading-6 text-foreground">{thread.title}</p>
              <p className="mt-1 truncate text-sm leading-5 text-foreground-muted">
                {thread.type} · {thread.workspace}
              </p>
            </div>
            <span className="shrink-0 text-xs leading-5 text-foreground-subtle">{thread.updated}</span>
          </div>
        );
      })}
    </div>
  );
}

function WorkspaceCard({ workspace }: { workspace: (typeof workspaces)[number] }) {
  return (
    <div className="group relative rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-border-strong hover:bg-surface-hover">
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold leading-6 text-foreground">{workspace.name}</h3>
            <span className="shrink-0 font-mono text-xs text-foreground-subtle">{workspace.nodes}</span>
          </div>
          <p className="mt-1.5 line-clamp-2 text-base leading-6 text-foreground-muted">
            {workspace.description}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`${workspace.pinned ? "Unpin" : "Pin"} ${workspace.name}`}
          className="shrink-0 text-foreground-subtle opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        >
          <Pin className={workspace.pinned ? "size-3.5 fill-current" : "size-3.5"} />
        </Button>
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-border-subtle pt-3 text-sm text-foreground-muted">
        <span className="flex min-w-0 items-center gap-1.5 truncate">
          <MessageSquare className="size-4 shrink-0" />
          <span className="truncate">{workspace.conversation}</span>
        </span>
        <span className="ml-3 shrink-0 text-xs">{workspace.updated}</span>
      </div>
    </div>
  );
}

export default function DashboardPreviewPage() {
  const [workspaceView, setWorkspaceView] = useState<"mine" | "discover">("mine");

  return (
    <main className="min-h-screen text-foreground" style={{ backgroundColor: "#ffffff" }}>
      <header className="flex h-13 items-center justify-between border-b border-border bg-surface px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex size-6 items-center justify-center border border-foreground text-foreground">
            <LayoutGrid className="size-3.5" />
          </div>
          <span className="text-base font-semibold tracking-tight">GraphMind</span>
        </div>
        <Button variant="ghost" size="default" className="gap-2 text-sm">
          <span className="flex size-8 items-center justify-center rounded-full border border-foreground text-xs">A</span>
          <span>Alex Morgan</span>
        </Button>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10 sm:px-8 lg:py-14">
        <section className="pt-10">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="lg"
                className={
                  workspaceView === "mine"
                    ? "h-11 border-border-strong bg-muted px-5 text-sm hover:bg-muted"
                    : "h-11 border-transparent bg-transparent px-5 text-sm"
                }
                aria-pressed={workspaceView === "mine"}
                onClick={() => setWorkspaceView("mine")}
              >
                <LayoutGrid className="size-4" />
                My workspaces
              </Button>
              <Button
                variant="outline"
                size="lg"
                className={
                  workspaceView === "discover"
                    ? "h-11 border-border-strong bg-muted px-5 text-sm hover:bg-muted"
                    : "h-11 border-transparent bg-transparent px-5 text-sm"
                }
                aria-pressed={workspaceView === "discover"}
                onClick={() => setWorkspaceView("discover")}
              >
                <Compass className="size-4" />
                Discover
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="lg" className="h-11 px-5 bg-muted text-sm hover:bg-muted/80">
                <Sparkles className="size-4" />
                Generate roadmap
              </Button>
              <Button variant="default" size="lg" className="h-11 px-5 text-sm">
                <Plus className="size-4" />
                Create new
              </Button>
            </div>
          </div>
          <SectionHeading>Your workspaces</SectionHeading>
          <div className="grid gap-4 md:grid-cols-3">
            {workspaces.map((workspace) => (
              <WorkspaceCard key={workspace.name} workspace={workspace} />
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}
