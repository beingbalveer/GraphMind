"use client";
import { PanelLeft, BookOpen, Network } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { buildWorkspaceUrl, buildCanvasUrl } from "@/lib/urls";
import type { CurriculumView } from "@/lib/roadmapTypes";
export function RoadmapHeader({
  view,
  mode,
  onToggleSidebar,
}: {
  view: CurriculumView;
  mode: "page" | "canvas";
  onToggleSidebar: () => void;
}) {
  const router = useRouter();
  return (
    <header className="flex h-13 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle sidebar"
          onClick={onToggleSidebar}
        >
          <PanelLeft className="size-4" />
        </Button>
        <span className="truncate text-sm font-medium">Roadmap</span>
      </div>
      <SegmentedTabs
        ariaLabel="Roadmap view"
        value={mode}
        className="bg-roadmap-switch"
        items={[
          { id: "page", label: "Roadmap", icon: BookOpen },
          { id: "canvas", label: "Canvas", icon: Network },
        ]}
        onChange={(next) =>
          router.push(
            next === "page"
              ? buildWorkspaceUrl(view.workspaceId)
              : buildCanvasUrl(view.workspaceId, view.canvasAnchorChatId),
          )
        }
      />
    </header>
  );
}
