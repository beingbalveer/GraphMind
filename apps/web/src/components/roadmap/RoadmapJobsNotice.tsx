"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  listRoadmapJobs,
  removeRoadmapJob,
} from "@/lib/roadmapApi";
import type { JobSnapshot } from "@/lib/roadmapTypes";
import { buildWorkspaceUrl } from "@/lib/urls";

export function RoadmapJobsNotice({
  onOpenJob,
}: {
  onOpenJob: (id: string) => void;
}) {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobSnapshot[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const load = useRef<() => Promise<void>>(async () => {});
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ROADMAP_GENERATOR_ENABLED !== "true") return;
    let disposed = false;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const list = await listRoadmapJobs(controller.signal);
        if (!disposed) {
          setJobs(list);
          setUnavailable(false);
        }
      } catch {
        if (!disposed) setUnavailable(true);
      }
    };
    load.current = refresh;
    void refresh();
    const timer = setInterval(refresh, 10000);
    window.addEventListener("focus", refresh);
    return () => {
      disposed = true;
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  async function remove(jobId: string) {
    setRemovingId(jobId);
    try {
      await removeRoadmapJob(jobId);
      await load.current();
    } finally {
      setRemovingId(null);
      setConfirmId(null);
    }
  }
  const showFeature = process.env.NEXT_PUBLIC_ROADMAP_GENERATOR_ENABLED === "true";
  if (!showFeature) return null;
  const visible = jobs
    .filter(
      (job) =>
        job.startupReady &&
        job.status !== "canceled" &&
        !["applied", "rejected"].includes(job.result?.proposalState ?? ""),
    )
    .slice(0, 3);
  if (!visible.length && !unavailable) return null;
  return (
    <section
      aria-label="Roadmap generation"
      className="mb-6 space-y-2 rounded-xl border border-border-subtle bg-surface p-3"
    >
      {unavailable && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 text-xs text-foreground-muted"
        >
          <span>Generation status is unavailable.</span>
          <Button variant="ghost" size="sm" onClick={() => void load.current()}>
            Retry status
          </Button>
        </div>
      )}
      {visible.map((job) => (
        <div key={job.id} className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {job.title || "Your learning roadmap"}
            </p>
            <p className="text-xs text-foreground-muted">
              {job.status === "completed"
                ? job.operation === "refine"
                  ? "Changes ready to review"
                  : "Ready to learn"
                : job.status === "awaiting_input"
                  ? "Needs your answer"
                  : job.status === "failed"
                    ? "Needs attention"
                    : "Research in progress"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                job.status === "completed" &&
                job.result &&
                job.operation !== "refine"
                  ? router.push(buildWorkspaceUrl(job.result.workspaceId))
                  : onOpenJob(job.id)
              }
            >
              {job.operation === "refine" && job.status === "completed"
                ? "Review changes"
                : job.status === "completed"
                  ? "Open roadmap"
                  : "View progress"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              disabled={removingId === job.id}
              onClick={() => setConfirmId(job.id)}
            >
              {removingId === job.id ? "Removing…" : "Remove"}
            </Button>
          </div>
        </div>
      ))}
      <ConfirmDialog
        isOpen={confirmId !== null}
        onClose={() => setConfirmId(null)}
        onConfirm={() => (confirmId ? remove(confirmId) : undefined)}
        title="Remove this roadmap?"
        description="This deletes the generated roadmap. Your workspace and its conversations stay intact."
        confirmText="Remove roadmap"
        isLoading={removingId !== null}
      />
    </section>
  );
}
