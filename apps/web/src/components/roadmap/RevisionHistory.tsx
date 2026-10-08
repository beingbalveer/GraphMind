"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  listRoadmapRevisions,
  readArchivedTopics,
  restoreRoadmapRevision,
} from "@/lib/roadmapApi";
import { ApiError } from "@/lib/apiClient";
import { buildChatUrl } from "@/lib/urls";
import type {
  CurriculumView,
  RevisionSummary,
  ArchivedTopic,
} from "@/lib/roadmapTypes";
import { CurriculumGroup } from "./CurriculumGroup";
export function RevisionHistory({
  view,
  onClose,
  onSaved,
  onReload,
}: {
  view: CurriculumView;
  onClose: () => void;
  onSaved: (view: CurriculumView) => void;
  onReload?: () => Promise<void>;
}) {
  const router = useRouter();
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [archived, setArchived] = useState<ArchivedTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [pending, setPending] = useState(false);
  const [ack, setAck] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void Promise.all([
      listRoadmapRevisions(view.workspaceId, controller.signal),
      readArchivedTopics(view.workspaceId, controller.signal),
    ])
      .then(([history, topics]) => {
        if (!controller.signal.aborted) {
          setRevisions(history);
          setArchived(topics);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(
            err instanceof Error ? err : new Error("Could not load history."),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [view.workspaceId, view.revisionId, reload]);
  const current = revisions.find((r) => r.id === view.revisionId);
  async function undo(historyRemovalAck = false) {
    if (!current?.baseRevisionId || pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await restoreRoadmapRevision(
        view.workspaceId,
        current.baseRevisionId,
        view.revisionId,
        historyRemovalAck,
      );
      onSaved(result);
      onClose();
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.code === "HISTORY_REMOVAL_ACK_REQUIRED"
      )
        setAck(true);
      else
        setError(
          err instanceof Error
            ? err
            : new Error("Could not restore this revision."),
        );
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <Modal isOpen onClose={onClose} size="lg">
        <ModalHeader title="Roadmap history" />
        <ModalBody className="space-y-5">
          {loading ? (
            <p role="status" className="text-sm text-foreground-muted">
              Loading history…
            </p>
          ) : (
            <>
              {current?.baseRevisionId && (
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() => void undo()}
                >
                  {pending ? "Restoring…" : "Undo last change"}
                </Button>
              )}
              <p className="text-xs text-foreground-muted">
                Undo restores the plan. Your lessons and completion stay saved.
              </p>
              <div className="space-y-3">
                {revisions
                  .filter((r) => r.status !== "candidate")
                  .map((revision) => (
                    <div
                      key={revision.id}
                      className="rounded-xl border border-border-subtle p-3"
                    >
                      <p className="text-sm font-medium">
                        {revision.title}
                        {revision.id === view.revisionId ? " · Current" : ""}
                      </p>
                      <p className="mt-1 text-xs text-foreground-muted">
                        {new Date(revision.createdAt).toLocaleString()} ·{" "}
                        {revision.added.length} added ·{" "}
                        {revision.changed.length} changed ·{" "}
                        {revision.removed.length} removed
                      </p>
                    </div>
                  ))}
              </div>
              <CurriculumGroup
                id="archived-topics"
                title={`Archived topics (${archived.length})`}
                open={expanded}
                onToggle={() => setExpanded((old) => !old)}
              >
                <div className="space-y-4">
                  {archived.map((topic) => (
                    <div key={topic.item.id} className="space-y-2">
                      <h3 className="text-sm font-medium">
                        {topic.item.title}
                      </h3>
                      <p className="text-xs text-foreground-muted">
                        {topic.item.brief} ·{" "}
                        {topic.progress.status.replaceAll("_", " ")}
                      </p>
                      {topic.sessions.map((session, index) => (
                        <Button
                          key={session.id}
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            onClose();
                            router.push(
                              buildChatUrl(view.workspaceId, session.chatId),
                            );
                          }}
                        >
                          Open saved lesson
                          {topic.sessions.length > 1 ? ` ${index + 1}` : ""}
                        </Button>
                      ))}
                    </div>
                  ))}
                  {!archived.length && (
                    <p className="text-xs text-foreground-muted">
                      No archived topics.
                    </p>
                  )}
                </div>
              </CurriculumGroup>
            </>
          )}
          {error && (
            <div className="space-y-2">
              <p role="alert" className="text-sm text-destructive">
                {error.message}
              </p>
              {error instanceof ApiError &&
              error.code === "REVISION_CONFLICT" &&
              onReload ? (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await onReload();
                    onClose();
                  }}
                >
                  Reload latest
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => setReload((old) => old + 1)}
                >
                  Retry history
                </Button>
              )}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
      <ConfirmDialog
        isOpen={ack}
        onClose={() => setAck(false)}
        title="Keep learning history?"
        description="Undo removes a topic with saved learning. Its lessons and completion will remain available in archived history."
        confirmText="Undo and keep history"
        isLoading={pending}
        onConfirm={() => undo(true)}
      />
    </>
  );
}
