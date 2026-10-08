"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { readTopicBrief, openTopicSession } from "@/lib/roadmapApi";
import { buildChatUrl } from "@/lib/urls";
import type {
  CurriculumView,
  TopicBrief,
  TopicProgressData,
} from "@/lib/roadmapTypes";
import { CurriculumGroup } from "./CurriculumGroup";
import { SourcesList } from "./SourcesList";
import { TopicProgressControl } from "./TopicProgressControl";
export function TopicBriefDrawer({
  view,
  topicId,
  onClose,
  onProgress,
}: {
  view: CurriculumView;
  topicId: string | null;
  onClose: () => void;
  onProgress: (progress: TopicProgressData) => void;
}) {
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
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [reload, setReload] = useState(0);
  const [expanded, setExpanded] = useState(new Set<string>());
  const keys = useRef(new Map<string, string>());
  const busy = useRef(false);
  useEffect(() => {
    setBrief(null);
    setError(null);
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
  const toggle = (id: string) =>
    setExpanded((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  async function start(fresh = false) {
    if (!brief || busy.current) return;
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
  return (
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
              <p className="text-sm leading-6 text-foreground-muted">
                {brief.item.brief}
              </p>
            </div>
            <section className="space-y-2">
              <h3 className="text-sm font-medium">What you’ll learn</h3>
              <ul className="list-disc space-y-2 pl-5 text-sm text-foreground-muted">
                {brief.item.objectives.map((objective, index) => (
                  <li key={index}>{objective}</li>
                ))}
              </ul>
            </section>
            {brief.item.exercise && (
              <section className="space-y-2">
                <h3 className="text-sm font-medium">Try it</h3>
                <p className="rounded-xl bg-background p-4 text-sm leading-6 text-foreground-muted">
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
                  <p key={item.id} className="text-sm text-foreground-muted">
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
                  disabled={pending}
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
          <Button disabled={pending} onClick={() => void start()}>
            {pending
              ? "Opening…"
              : brief.defaultChatId
                ? "Continue lesson"
                : "Start learning"}
          </Button>
        </footer>
      )}
    </Drawer>
  );
}
