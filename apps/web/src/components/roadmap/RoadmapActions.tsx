"use client";
import { useEffect, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import type { CurriculumView } from "@/lib/roadmapTypes";
import { TopicEditor } from "./TopicEditor";
import { RefinementModal } from "./RefinementModal";
import { listRoadmapJobs } from "@/lib/roadmapApi";
import { RevisionHistory } from "./RevisionHistory";
export function RoadmapActions({
  view,
  onSaved,
  onReload,
}: {
  view: CurriculumView;
  onSaved: (view: CurriculumView) => void;
  onReload?: () => Promise<void>;
}) {
  const [dialog, setDialog] = useState<"add" | "history" | "refine" | null>(
    null,
  );
  const [refinementId, setRefinementId] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      try {
        const jobs = await listRoadmapJobs(controller.signal);
        if (!controller.signal.aborted)
          setRefinementId(
            jobs.find(
              (job) =>
                job.operation === "refine" &&
                job.targetWorkspaceId === view.workspaceId &&
                job.status !== "canceled" &&
                !["applied", "rejected"].includes(
                  job.result?.proposalState ?? "",
                ),
            )?.id ?? null,
          );
      } catch {
        /* Existing accepted job remains available during temporary disconnection. */
      }
    }
    void refresh();
    const timer = setInterval(refresh, 10000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [view.workspaceId, view.revisionId]);
  return (
    <>
      <DropdownMenu
        trigger={
          <Button variant="ghost" size="icon" aria-label="Roadmap actions">
            <MoreHorizontal />
          </Button>
        }
        items={[
          {
            label: refinementId ? "Review refinement" : "Refine roadmap",
            onClick: () => setDialog("refine"),
          },
          { label: "Add topic", onClick: () => setDialog("add") },
          { label: "Revision history", onClick: () => setDialog("history") },
        ]}
      />
      {dialog === "refine" && (
        <RefinementModal
          view={view}
          resumeJobId={refinementId}
          onClose={() => setDialog(null)}
          onSaved={onSaved}
          onJobAccepted={setRefinementId}
        />
      )}
      {dialog === "add" && (
        <TopicEditor
          view={view}
          topicId={null}
          onClose={() => setDialog(null)}
          onSaved={onSaved}
          onReload={onReload}
        />
      )}{" "}
      {dialog === "history" && (
        <RevisionHistory
          view={view}
          onClose={() => setDialog(null)}
          onSaved={onSaved}
          onReload={onReload}
        />
      )}
    </>
  );
}
