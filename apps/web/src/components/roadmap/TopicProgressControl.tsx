"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { setTopicProgress } from "@/lib/roadmapApi";
import type { TopicProgressData } from "@/lib/roadmapTypes";
export function TopicProgressControl({
  workspaceId,
  progress,
  onChange,
}: {
  workspaceId: string;
  progress: TopicProgressData;
  onChange: (progress: TopicProgressData) => void;
}) {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function change() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    const previous = progress;
    const status =
      progress.status === "completed" ? "in_progress" : "completed";
    onChange({
      ...progress,
      status,
      completedAt: status === "completed" ? new Date().toISOString() : null,
    });
    try {
      onChange(await setTopicProgress(workspaceId, progress.topicId, status));
    } catch (error) {
      onChange(previous);
      setError(
        error instanceof Error
          ? error.message
          : "Could not save completion. Try again.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <div className="space-y-1">
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => void change()}
      >
        {pending
          ? "Saving…"
          : progress.status === "completed"
            ? "Mark incomplete"
            : "Mark completed"}
      </Button>
      {error && (
        <p role="alert" className="max-w-xs text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
