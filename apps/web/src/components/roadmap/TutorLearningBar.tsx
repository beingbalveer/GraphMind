"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { buildWorkspaceUrl } from "@/lib/urls";
import type { TopicSessionData, TopicProgressData } from "@/lib/roadmapTypes";
import { CurriculumGroup } from "./CurriculumGroup";
import { TopicProgressControl } from "./TopicProgressControl";
export function TutorLearningBar({
  workspaceId,
  session,
  onResume,
  onAsk,
  onAssess,
  onProgress,
  busy,
  error,
}: {
  workspaceId: string;
  session: TopicSessionData;
  onResume: () => void;
  onAsk: () => void;
  onAssess: () => void;
  onProgress: (data: TopicProgressData) => void;
  busy: boolean;
  error?: string | null;
}) {
  const router = useRouter();
  const [details, setDetails] = useState(false);
  return (
    <div className="shrink-0 border-b border-border-subtle bg-background px-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(buildWorkspaceUrl(workspaceId))}
        >
          Back to roadmap
        </Button>
        <span className="text-xs text-foreground-muted">
          {session.archived ? "Archived topic · " : ""}
          {session.topicTitle ?? "Guided lesson"}
        </span>
        {!session.archived && session.progress && (
          <TopicProgressControl
            workspaceId={workspaceId}
            progress={session.progress}
            onChange={onProgress}
          />
        )}
      </div>
      {session.lessonStartState === "interrupted" && (
        <div className="flex items-center justify-between gap-3 py-2 text-xs text-foreground-muted">
          <p>The first lesson was interrupted.</p>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={onResume}
          >
            Resume lesson
          </Button>
        </div>
      )}
      {session.lessonStartState === "started" && !busy && (
        <p role="status" className="py-2 text-xs text-foreground-muted">
          Your first lesson is starting. This view will update when it’s saved.
        </p>
      )}
      <CurriculumGroup
        id="tutor-details"
        title="Learning details"
        open={details}
        onToggle={() => setDetails((old) => !old)}
      >
        <div className="space-y-3 px-2">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy || session.lessonStartState !== "completed"}
              onClick={onAsk}
            >
              Check understanding
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={onAssess}
            >
              Assess my answer
            </Button>
          </div>
          <p className="text-xs text-foreground-muted">
            Optional AI assessments are separate from topic completion.
          </p>
          {session.checks?.map((check) => (
            <div
              key={check.id}
              className="space-y-2 rounded-xl border border-border bg-surface p-3 text-xs"
            >
              <p className="font-medium">
                AI assessment · {new Date(check.createdAt).toLocaleString()}
              </p>
              <p className="text-foreground-muted">
                {String(check.result.rating ?? "")}
              </p>
              {Array.isArray(check.result.strengths) &&
                check.result.strengths.map((value, index) => (
                  <p
                    key={`strength-${index}`}
                    className="text-foreground-muted"
                  >
                    {String(value)}
                  </p>
                ))}
              {Array.isArray(check.result.gaps) &&
                check.result.gaps.map((value, index) => (
                  <p key={`gap-${index}`} className="text-foreground-muted">
                    Practice: {String(value)}
                  </p>
                ))}
              <p className="text-foreground-muted">
                {String(check.result.nextStep ?? "")}
              </p>
              <p className="text-foreground-subtle">
                Based on the saved lesson revision.
              </p>
            </div>
          ))}
        </div>
      </CurriculumGroup>
      {error && (
        <p role="alert" className="px-2 py-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
