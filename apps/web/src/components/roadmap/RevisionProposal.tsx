"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  readRoadmapProposal,
  applyRoadmapRevision,
  rejectRoadmapProposal,
} from "@/lib/roadmapApi";
import { ApiError } from "@/lib/apiClient";
import type { CurriculumView, RevisionProposalData } from "@/lib/roadmapTypes";
import { selectedCoreTopics } from "@/lib/canvas/curriculumProjection";
import { CurriculumGroup } from "./CurriculumGroup";
export function RevisionProposal({
  workspaceId,
  revisionId,
  onSaved,
  onClose,
  onRegenerate,
}: {
  workspaceId: string;
  revisionId: string;
  onSaved: (view: CurriculumView) => void;
  onClose: () => void;
  onRegenerate: (instruction?: string | null) => void | Promise<void>;
}) {
  const [proposal, setProposal] = useState<RevisionProposalData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [pending, setPending] = useState(false);
  const [outdated, setOutdated] = useState(false);
  const [details, setDetails] = useState(false);
  const [expandedTopics, setExpandedTopics] = useState(new Set<string>());
  const [ack, setAck] = useState(false);
  const [reload, setReload] = useState(0);
  const busy = useRef(false);
  const scope = useRef(0);
  useEffect(() => {
    scope.current += 1;
    const controller = new AbortController();
    setProposal(null);
    setError(null);
    setOutdated(false);
    void readRoadmapProposal(workspaceId, revisionId, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setProposal(value);
          setOutdated(value.outdated);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(
            err instanceof Error
              ? err
              : new Error("Could not load the proposal."),
          );
      });
    return () => {
      scope.current += 1;
      controller.abort();
    };
  }, [workspaceId, revisionId, reload]);
  async function apply(historyRemovalAck = false) {
    if (!proposal || busy.current) return;
    const current = scope.current;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const view = await applyRoadmapRevision(
        workspaceId,
        revisionId,
        proposal.baseRevisionId,
        historyRemovalAck,
      );
      if (scope.current === current) {
        onSaved(view);
        onClose();
      }
    } catch (err) {
      if (scope.current === current) {
        if (
          err instanceof ApiError &&
          err.code === "HISTORY_REMOVAL_ACK_REQUIRED"
        )
          setAck(true);
        else {
          setError(
            err instanceof Error
              ? err
              : new Error("Could not apply these changes."),
          );
          if (err instanceof ApiError && err.code === "REVISION_CONFLICT")
            setOutdated(true);
        }
      }
    } finally {
      busy.current = false;
      if (scope.current === current) setPending(false);
    }
  }
  async function keep() {
    if (busy.current) return;
    const current = scope.current;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      await rejectRoadmapProposal(workspaceId, revisionId);
      if (scope.current === current) onClose();
    } catch (err) {
      if (scope.current === current)
        setError(
          err instanceof Error
            ? err
            : new Error("Could not keep your current plan."),
        );
    } finally {
      busy.current = false;
      if (scope.current === current) setPending(false);
    }
  }
  const label = (id: string) =>
    proposal?.view.candidate.items.find((i) => i.id === id)?.title ??
    proposal?.original.items.find((i) => i.id === id)?.title ??
    "Archived topic";
  const toggleTopic = (id: string) =>
    setExpandedTopics((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  function changeDetails(id: string) {
    if (!proposal) return null;
    const before = proposal.original.items.find((item) => item.id === id);
    const after = proposal.view.candidate.items.find(
      (item) => item.id === id && item.participation === "active",
    );
    const sections: { title: string; before: string; after: string }[] = [];
    for (const [field, title] of [
      ["title", "Title"],
      ["brief", "Purpose"],
      ["objectives", "Objectives"],
      ["exercise", "Exercise"],
      ["estimateMinutes", "Effort in minutes"],
      ["path", "Learning path"],
      ["order", "Presentation order"],
    ] as const) {
      const old = before?.[field];
      const next = after?.[field];
      if (
        JSON.stringify(
          typeof old === "string" ? old.trim().replace(/\s+/g, " ") : old,
        ) !==
        JSON.stringify(
          typeof next === "string" ? next.trim().replace(/\s+/g, " ") : next,
        )
      )
        sections.push({
          title,
          before: Array.isArray(old)
            ? old.join(" · ")
            : String(old ?? "Not in this plan"),
          after: Array.isArray(next)
            ? next.join(" · ")
            : String(next ?? "Archived"),
        });
    }
    const oldParent = proposal.original.relations.find(
      (relation) => relation.kind === "contains" && relation.targetId === id,
    )?.sourceId;
    const newParent = proposal.view.candidate.relations.find(
      (relation) => relation.kind === "contains" && relation.targetId === id,
    )?.sourceId;
    if (oldParent !== newParent)
      sections.push({
        title: "Placement",
        before: oldParent ? label(oldParent) : "Not in this plan",
        after: newParent ? label(newParent) : "Archived",
      });
    const oldResources = proposal.original.resources.filter(
      (resource) => resource.topicId === id,
    );
    const newResources = proposal.view.candidate.resources.filter(
      (resource) => resource.topicId === id,
    );
    const resourceText = (resources: typeof oldResources) =>
      resources
        .map(
          (resource) =>
            `${proposal.view.sources.find((source) => source.id === resource.sourceId)?.title ?? "Saved source"}: ${resource.rationale}`,
        )
        .join("\n");
    if (JSON.stringify(oldResources) !== JSON.stringify(newResources))
      sections.push({
        title: "Resources",
        before: resourceText(oldResources),
        after: resourceText(newResources),
      });
    const oldSessions = proposal.original.sessions.filter(
      (session) => session.topicId === id,
    );
    const newSessions = proposal.view.candidate.sessions.filter(
      (session) => session.topicId === id,
    );
    const sessionText = (sessions: typeof oldSessions) =>
      sessions
        .map((session) => `Week ${session.week}: ${session.minutes} min`)
        .join(" · ");
    if (JSON.stringify(oldSessions) !== JSON.stringify(newSessions))
      sections.push({
        title: "Weekly sessions",
        before: sessionText(oldSessions),
        after: sessionText(newSessions),
      });
    return (
      <CurriculumGroup
        id={`proposal-topic-${id}`}
        title={label(id)}
        open={expandedTopics.has(id)}
        onToggle={() => toggleTopic(id)}
      >
        <div className="space-y-4">
          {sections.map((section) => (
            <section key={section.title} className="space-y-2">
              <h5 className="text-sm font-medium">{section.title}</h5>
              <div className="space-y-3 rounded-xl border border-border-subtle p-3">
                <div>
                  <p className="text-2xs uppercase text-foreground-subtle">
                    Current
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-foreground-muted">
                    {section.before || "None"}
                  </p>
                </div>
                <div>
                  <p className="text-2xs uppercase text-foreground-subtle">
                    Proposed
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-foreground">
                    {section.after || "None"}
                  </p>
                </div>
              </div>
            </section>
          ))}
        </div>
      </CurriculumGroup>
    );
  }
  return (
    <div className="space-y-5">
      {proposal ? (
        <>
          <div className="space-y-2">
            <h3 className="font-roadmap-display text-xl">Suggested changes</h3>
            <p className="text-sm text-foreground-muted">
              {proposal.diff.summary}
            </p>
            <p className="text-xs text-foreground-muted">
              Your current roadmap stays active until you apply.
            </p>
            {proposal.affectedCompletedTopics.length > 0 && (
              <p className="text-xs text-foreground-muted">
                {proposal.affectedCompletedTopics.length} completed{" "}
                {proposal.affectedCompletedTopics.length === 1
                  ? "topic is"
                  : "topics are"}{" "}
                affected. Learning history stays saved.
              </p>
            )}
          </div>
          <CurriculumGroup
            id="proposal-details"
            title="View changes"
            open={details}
            onToggle={() => setDetails((old) => !old)}
          >
            <div className="space-y-4">
              {(["added", "changed", "removed"] as const).map(
                (kind) =>
                  proposal.diff[kind].length > 0 && (
                    <section key={kind} className="space-y-2">
                      <h4 className="text-sm font-medium capitalize">{kind}</h4>
                      <ul className="space-y-2 text-sm text-foreground-muted">
                        {proposal.diff[kind]
                          .slice()
                          .sort((a, b) => {
                            const order = [
                              ...selectedCoreTopics(proposal.view).map(
                                (item) => item.id,
                              ),
                              ...proposal.view.candidate.items.map(
                                (item) => item.id,
                              ),
                              ...proposal.original.items.map((item) => item.id),
                            ];
                            return order.indexOf(a) - order.indexOf(b);
                          })
                          .map((id) => (
                            <li key={id}>{changeDetails(id)}</li>
                          ))}
                      </ul>
                    </section>
                  ),
              )}
              {proposal.view.candidate.assumptions.map((assumption, index) => (
                <p key={index} className="text-xs text-foreground-muted">
                  {assumption}
                </p>
              ))}
              {proposal.diff.identityChanges.map((change) => (
                <p
                  key={change.newItemId}
                  className="text-xs text-foreground-muted"
                >
                  {label(change.oldItemId)} → {label(change.newItemId)}:{" "}
                  {change.reason}
                </p>
              ))}
            </div>
          </CurriculumGroup>
          {outdated && (
            <p className="text-sm text-foreground-muted">
              Your roadmap changed while the agent was working. Generate a fresh
              proposal against the latest version.
            </p>
          )}
          {proposal.status === "rejected" ? (
            <>
              <p className="text-sm text-foreground-muted">
                You kept the current roadmap.
              </p>
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              {proposal.status !== "candidate" ? (
                <Button variant="secondary" onClick={onClose}>
                  Close
                </Button>
              ) : (
                <>
                  {outdated ? (
                    <Button
                      disabled={pending}
                      onClick={() => void onRegenerate(proposal.instruction)}
                    >
                      Reload and regenerate
                    </Button>
                  ) : (
                    <Button disabled={pending} onClick={() => void apply()}>
                      {pending ? "Applying…" : "Apply changes"}
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    disabled={pending}
                    onClick={() => void keep()}
                  >
                    Keep current
                  </Button>
                </>
              )}
            </div>
          )}
        </>
      ) : !error ? (
        <p role="status" className="text-sm text-foreground-muted">
          Loading proposed changes…
        </p>
      ) : (
        <Button variant="secondary" onClick={() => setReload((old) => old + 1)}>
          Retry proposal
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      )}
      <ConfirmDialog
        isOpen={ack}
        onClose={() => setAck(false)}
        title="Archive affected topics?"
        description="Removed topics keep their saved lessons, completion and assessments in archived history."
        confirmText="Apply and keep history"
        isLoading={pending}
        onConfirm={() => apply(true)}
      />
    </div>
  );
}
