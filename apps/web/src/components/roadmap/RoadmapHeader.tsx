"use client";
import { BookOpen, Network } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { buildWorkspaceUrl, buildCanvasUrl } from "@/lib/urls";
import type { CurriculumView } from "@/lib/roadmapTypes";
export function RoadmapHeader({
  view,
  mode,
}: {
  view: CurriculumView;
  mode: "page" | "canvas";
}) {
  const router = useRouter();
  return (
    <header className="flex h-13 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-medium">Roadmap</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={mode === "page" ? "Switch to canvas" : "Switch to roadmap"}
        title={mode === "page" ? "Switch to canvas" : "Switch to roadmap"}
        className={mode === "canvas" ? "bg-surface-hover" : undefined}
        onClick={() =>
          router.push(
            mode === "page"
              ? buildCanvasUrl(view.workspaceId, view.canvasAnchorChatId)
              : buildWorkspaceUrl(view.workspaceId),
          )
        }
      >
        {mode === "page" ? (
          <Network aria-hidden="true" className="size-4" />
        ) : (
          <BookOpen aria-hidden="true" className="size-4" />
        )}
      </Button>
    </header>
  );
}
