"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { readTopicBrief, openTopicSession, listTopicSessions } from "@/lib/roadmapApi";
import { buildChatUrl } from "@/lib/urls";
import { buildNodeUrl } from "@/lib/urls";
import type {
  CurriculumView,
  TopicBrief,
  TopicProgressData,
  TopicSessionSummary,
} from "@/lib/roadmapTypes";
import { TopicEditor } from "./TopicEditor";
import { CurriculumGroup } from "./CurriculumGroup";
import { SourcesList } from "./SourcesList";
import { TopicProgressControl } from "./TopicProgressControl";
export function TopicBriefDrawer({
  view,
  topicId,
  onClose,
  onProgress,
  onSaved,
  onReload,
}: {
  view: CurriculumView;
  topicId: string | null;
  onClose: () => void;
  onProgress: (progress: TopicProgressData) => void;
  onSaved?: (view: CurriculumView) => void;
  onReload?: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const requestScope = useRef(0);
  useEffect(() => {
    requestScope.current += 1;
    return () => {
      requestScope.current += 1;
    };
  }, [pathname, view.workspaceId, view.revisionId, topicId]);
  function close() {
    requestScope.current += 1;
    onClose();
  }
  const [brief, setBrief] = useState<TopicBrief | null>(null);
  const [sessions, setSessions] = useState<TopicSessionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [reload, setReload] = useState(0);
  const [historyReload, setHistoryReload] = useState(0);
  const [expanded, setExpanded] = useState(new Set<string>());
  const keys = useRef(new Map<string, string>());
  const busy = useRef(false);
  useEffect(() => {
    setBrief(null);
    setSessions([]);
    setError(null);
    setHistoryError(null);
    setExpanded(new Set());
    if (!topicId) return;
    const controller = new AbortController();
    void readTopicBrief(view.workspaceId, topicId, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setBrief(data);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "Could not load this topic.",
          );
      });
    return () => controller.abort();
  }, [view.workspaceId, view.revisionId, topicId, reload]);
  useEffect(() => {
    setSessions([]);
    setHistoryError(null);
    if (!topicId) return;
    const controller = new AbortController();
    void listTopicSessions(view.workspaceId, topicId, 20, controller.signal)
      .then((history) => {
        if (!controller.signal.aborted) setSessions(history.sessions);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setHistoryError(
            error instanceof Error
              ? error.message
              : "Could not load saved lesson sessions.",
          );
      });
    return () => controller.abort();
  }, [view.workspaceId, topicId, historyReload]);
  const toggle = (id: string) =>
    setExpanded((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  async function start(fresh = false) {
    if (!brief || busy.current || (fresh && brief.item.participation === "archived")) return;
    const scope = requestScope.current;
    busy.current = true;
    setPending(true);
    setError(null);
    const keyName = `${brief.item.id}:${fresh}`;
    let key = keys.current.get(keyName);
    if (!key) {
      key = crypto.randomUUID();
      keys.current.set(keyName, key);
    }
    try {
      const session = await openTopicSession(
        view.workspaceId,
        brief.item.id,
        key,
        fresh,
      );
      if (scope !== requestScope.current) return;
      if (fresh) keys.current.delete(keyName);
      onClose();
      router.push(buildChatUrl(view.workspaceId, session.chatId));
    } catch (error) {
      if (scope !== requestScope.current) return;
      setError(
        error instanceof Error
          ? error.message
          : "Could not open your lesson. Try again.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  function change(progress: TopicProgressData) {
    setBrief((old) => (old ? { ...old, progress } : old));
    onProgress(progress);
  }
  function sessionStateLabel(state: TopicSessionSummary["lessonStartState"]) {
    switch (state) {
      case "pending": return "Ready to start";
      case "started": return "In progress";
      case "completed": return "Completed";
      case "interrupted": return "Interrupted";
    }
  }
  const origin = topicId
    ? view.origins?.find((candidate) => candidate.topicId === topicId)
    : undefined;
  return (
    <>
      <Drawer
        isOpen={Boolean(topicId)}
        onClose={close}
        title="Learning brief"
        widthClassName="w-full sm:w-[480px]"
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {!brief ? (
            <div className="space-y-3">
              {error ? (
                <>
                  <p role="alert" className="text-sm text-foreground-muted">
                    {error}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setReload((old) => old + 1)}
                  >
                    Retry
                  </Button>
                </>
              ) : (
                <p role="status" className="text-sm text-foreground-muted">
                  Loading topic…
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-3">
                <h2 className="font-roadmap-display text-brief-title font-normal leading-tight">
                  {brief.item.title}
                </h2>
                <p className="text-xs text-foreground-subtle">
                  {brief.item.path === "further"
                    ? "Further learning"
                    : "Core path"}{" "}
                  ·{" "}
                  {brief.item.estimateMinutes
                    ? `${brief.item.estimateMinutes} min`
                    : "Self paced"}
                </p>
                <p className="reading-text text-reading-foreground">
                  {brief.item.brief}
                </p>
              </div>
              {origin && (
                <section className="space-y-2 rounded-xl border border-border-subtle bg-background-secondary p-3">
                  <h3 className="text-sm font-medium">Added from exploration</h3>
                  <p className="text-xs text-foreground-muted">{origin.sourceTitle}</p>
                  {origin.sourceExcerpt && (
                    <p className="line-clamp-4 whitespace-pre-wrap reading-text text-reading-foreground">
                      {origin.sourceExcerpt}
                    </p>
                  )}
                  {origin.unavailable || !origin.sourceWorkspaceId || !origin.sourceChatId || !origin.sourceNodeId ? (
                    <p className="text-xs text-foreground-subtle">The source conversation is no longer available.</p>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(buildNodeUrl(
                        origin.sourceWorkspaceId!,
                        origin.sourceChatId!,
                        origin.sourceNodeId!,
                      ))}
                    >
                      Open source branch
                    </Button>
                  )}
                </section>
              )}
              <section className="space-y-2">
                <h3 className="text-sm font-medium">What you’ll learn</h3>
                <ul className="reading-text list-disc space-y-2 pl-5 text-reading-foreground">
                  {brief.item.objectives.map((objective, index) => (
                    <li key={index}>{objective}</li>
                  ))}
                </ul>
              </section>
              <section className="space-y-2" aria-labelledby="topic-session-history-heading">
                <h3 id="topic-session-history-heading" className="text-sm font-medium">
                  Saved lesson sessions
                </h3>
                {historyError ? (
                  <div className="space-y-2">
                    <p role="alert" className="text-xs text-foreground-muted">{historyError}</p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setHistoryReload((old) => old + 1)}
                    >
                      Retry session history
                    </Button>
                  </div>
                ) : sessions.length ? (
                  <div className="space-y-1">
                    {sessions.map((session, index) => (
                      <Button
                        key={session.id}
                        variant="ghost"
                        className="h-auto w-full justify-start rounded-xl border border-border-subtle px-3 py-2 text-left"
                        onClick={() => {
                          close();
                          router.push(buildChatUrl(view.workspaceId, session.chatId));
                        }}
                        aria-label={`Resume lesson session ${index + 1}${session.archived ? ", archived topic" : ""}`}
                      >
                        <span className="flex min-w-0 flex-col items-start gap-0.5">
                          <span className="text-sm font-medium text-foreground">
                            {session.isPrimary ? "Primary lesson" : `Session ${index + 1}`}
                            {session.archived ? " · Archived topic" : ""}
                          </span>
                          <span className="text-xs text-foreground-muted">
                            Updated {new Date(session.updatedAt).toLocaleDateString()} · {sessionStateLabel(session.lessonStartState)}
                          </span>
                        </span>
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-foreground-muted">No saved sessions yet.</p>
                )}
              </section>
              {brief.item.exercise && (
                <section className="space-y-2">
                  <h3 className="text-sm font-medium">Try it</h3>
                  <p className="reading-text rounded-xl bg-background p-4 text-reading-foreground">
                    {brief.item.exercise}
                  </p>
                </section>
              )}
              <CurriculumGroup
                id="topic-resources"
                title="Resources"
                open={expanded.has("resources")}
                onToggle={() => toggle("resources")}
              >
                <div className="space-y-4">
                  <SourcesList
                    showHeading={false}
                    sources={[...brief.resources]
                      .sort((a, b) => a.order - b.order)
                      .map((resource) => resource.source)}
                    rationales={Object.fromEntries(
                      brief.resources.map((resource) => [
                        resource.source.id,
                        resource.rationale,
                      ]),
                    )}
                  />
                  {!brief.resources.length && (
                    <p className="text-xs text-foreground-muted">
                      No resources available in this revision.
                    </p>
                  )}
                </div>
              </CurriculumGroup>
              <CurriculumGroup
                id="topic-prerequisites"
                title="Prerequisites"
                open={expanded.has("prerequisites")}
                onToggle={() => toggle("prerequisites")}
              >
                <div className="space-y-2">
                  {brief.prerequisites.map((item) => (
                    <p key={item.id} className="reading-text text-reading-foreground">
                      {item.title} ·{" "}
                      {view.progress[item.id]?.status === "completed"
                        ? "Completed"
                        : "Not completed"}
                    </p>
                  ))}
                  {!brief.prerequisites.length && (
                    <p className="text-xs text-foreground-muted">
                      No required earlier topics.
                    </p>
                  )}
                </div>
              </CurriculumGroup>
              <CurriculumGroup
                id="learning-details"
                title="Learning details"
                open={expanded.has("details")}
                onToggle={() => toggle("details")}
              >
                <div className="space-y-3">
                  {onSaved && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(true)}
                    >
                      Edit topic
                    </Button>
                  )}
                  {brief.latestCheck && (
                    <div className="rounded-xl border border-border p-3 text-xs text-foreground-muted">
                      <p className="font-medium">
                        Latest AI assessment ·{" "}
                        {new Date(
                          brief.latestCheck.createdAt,
                        ).toLocaleDateString()}
                      </p>
                      <p>{String(brief.latestCheck.result.rating ?? "")}</p>
                      <p>{String(brief.latestCheck.result.nextStep ?? "")}</p>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending || brief.item.participation === "archived"}
                    aria-label="Start a new lesson conversation"
                    onClick={() => void start(true)}
                  >
                    Start fresh session
                  </Button>
                </div>
              </CurriculumGroup>
              {error && (
                <p role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>
        {brief && (
          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border p-4">
            <TopicProgressControl
              workspaceId={view.workspaceId}
              progress={brief.progress}
              onChange={change}
            />
            <Button disabled={pending || brief.item.participation === "archived"} onClick={() => void start()}>
              {pending
                ? "Opening…"
                : brief.defaultChatId
                  ? "Continue lesson"
                  : "Start learning"}
            </Button>
          </footer>
        )}
      </Drawer>
      {editing && brief && onSaved && (
        <TopicEditor
          view={view}
          topicId={brief.item.id}
          onClose={() => setEditing(false)}
          onSaved={(next) => {
            onSaved(next);
            setEditing(false);
            setReload((old) => old + 1);
          }}
          onReload={onReload}
        />
      )}
    </>
  );
}
