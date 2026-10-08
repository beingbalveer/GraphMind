"use client";
import { useEffect, useRef, useState } from "react";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ApiError } from "@/lib/apiClient";
import { saveRoadmapEdits, inspectRoadmapSource } from "@/lib/roadmapApi";
import type {
  CurriculumView,
  CurriculumPatch,
  SourceData,
  ResourceData,
} from "@/lib/roadmapTypes";
import { CurriculumGroup } from "./CurriculumGroup";
export function TopicEditor({
  view,
  topicId,
  onClose,
  onSaved,
  onReload,
}: {
  view: CurriculumView;
  topicId: string | null;
  onClose: () => void;
  onSaved: (view: CurriculumView) => void;
  onReload?: () => Promise<void>;
}) {
  const item = view.candidate.items.find((i) => i.id === topicId);
  const adding = !item;
  const [title, setTitle] = useState(item?.title ?? "");
  const [brief, setBrief] = useState(item?.brief ?? "");
  const [effort, setEffort] = useState(String(item?.estimateMinutes ?? 30));
  const [objectives, setObjectives] = useState(
    item?.objectives.join("\n") ?? "",
  );
  const [exercise, setExercise] = useState(item?.exercise ?? "");
  const originalParent = view.candidate.relations.find(
    (r) => r.kind === "contains" && r.targetId === topicId,
  )?.sourceId;
  const [parent, setParent] = useState(
    originalParent ??
      view.candidate.items.find((i) => i.kind === "phase")?.id ??
      "",
  );
  const [order, setOrder] = useState(
    String(item?.order ?? view.candidate.items.length),
  );
  const [resources, setResources] = useState<ResourceData[]>(
    view.candidate.resources.filter((r) => r.topicId === topicId),
  );
  const [sources, setSources] = useState(view.sources);
  const [resourceEdited, setResourceEdited] = useState(false);
  const [link, setLink] = useState("");
  const [inspecting, setInspecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState<"remove" | "save" | null>(null);
  const [expanded, setExpanded] = useState(
    new Set(adding ? ["resources", "lesson"] : []),
  );
  const busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const newId = useRef<string | null>(null);
  const id =
    item?.id ??
    (newId.current ??= "item_" + crypto.randomUUID().replaceAll("-", ""));
  const toggle = (section: string) =>
    setExpanded((old) => {
      const next = new Set(old);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  const parentChoice = view.candidate.choices.find(
    (choice) => choice.choiceId === originalParent,
  );
  const [useAlternative, setUseAlternative] = useState(false);
  const [sessions, setSessions] = useState(
    view.candidate.sessions.filter((s) => s.topicId === topicId),
  );
  const [scheduleEdited, setScheduleEdited] = useState(false);
  async function save(remove = false, ack = false) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const patches: CurriculumPatch[] = [];
      if (remove) patches.push({ op: "remove_topic", itemId: id });
      else {
        const estimate = Number(effort);
        if (!title.trim() || !Number.isInteger(estimate) || estimate < 1)
          throw new Error(
            "Enter a title and a positive whole number of minutes.",
          );
        const details = {
          title: title.trim(),
          brief,
          objectives: objectives
            .split("\n")
            .map((o) => o.trim())
            .filter(Boolean),
          exercise: exercise || null,
          estimateMinutes: estimate,
        };
        if (adding)
          patches.push({
            op: "add_topic",
            parentId: parent,
            item: {
              id,
              kind: "topic",
              order: Number(order),
              path: "core",
              participation: "active",
              format: "concepts",
              ...details,
            },
          });
        else {
          patches.push({ op: "update_item", itemId: id, ...details });
          if (parent !== originalParent || Number(order) !== item.order)
            patches.push({
              op: "move_item",
              itemId: id,
              parentId: parent,
              order: Number(order),
            });
        }
        if (useAlternative && parentChoice)
          patches.push({
            op: "select_alternative",
            choiceId: parentChoice.choiceId,
            selectedId: id,
          });
        if (adding || resourceEdited)
          patches.push({
            op: "replace_resources",
            itemId: id,
            resources: resources.map((r, index) => ({
              ...r,
              topicId: id,
              order: index,
            })),
          });
        if (scheduleEdited)
          patches.push({
            op: "assign_week",
            sessions: [
              ...view.candidate.sessions.filter((s) => s.topicId !== id),
              ...sessions,
            ].sort(
              (a, b) =>
                a.week - b.week ||
                view.candidate.items.findIndex((i) => i.id === a.topicId) -
                  view.candidate.items.findIndex((i) => i.id === b.topicId) ||
                a.sequence - b.sequence,
            ),
          });
      }
      const result = await saveRoadmapEdits(view.workspaceId, {
        baseRevisionId: view.revisionId,
        patches,
        historyRemovalAck: ack,
      });
      if (alive.current) {
        onSaved(result);
        onClose();
      }
    } catch (err) {
      if (alive.current) {
        if (
          err instanceof ApiError &&
          err.code === "HISTORY_REMOVAL_ACK_REQUIRED"
        )
          setConfirm(remove ? "remove" : "save");
        else
          setError(
            err instanceof Error
              ? err
              : new Error("Could not save these changes."),
          );
      }
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  }
  function chooseSource(source: SourceData) {
    setResourceEdited(true);
    setResources((old) =>
      old.some((r) => r.sourceId === source.id)
        ? old.filter((r) => r.sourceId !== source.id)
        : old.length < 3
          ? [
              ...old,
              {
                topicId: id,
                sourceId: source.id,
                order: old.length,
                rationale: "",
              },
            ]
          : old,
    );
  }
  async function inspect() {
    if (inspecting || !link.trim()) return;
    setInspecting(true);
    setError(null);
    try {
      const source = await inspectRoadmapSource(view.workspaceId, link);
      if (alive.current) {
        setSources((old) => [...old.filter((s) => s.id !== source.id), source]);
        chooseSource(source);
        setLink("");
      }
    } catch (err) {
      if (alive.current)
        setError(
          err instanceof Error
            ? err
            : new Error("Could not inspect this source."),
        );
    } finally {
      if (alive.current) setInspecting(false);
    }
  }
  return (
    <>
      <Modal isOpen onClose={onClose} size="lg">
        <ModalHeader title={adding ? "Add topic" : "Edit topic"} />
        <ModalBody className="space-y-4">
          <label className="block space-y-2 text-sm">
            <span>Title</span>
            <Input
              aria-label="Title"
              value={title}
              maxLength={180}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span>Purpose</span>
            <Textarea
              aria-label="Purpose"
              value={brief}
              maxLength={4000}
              onChange={(e) => setBrief(e.target.value)}
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span>Effort in minutes</span>
            <Input
              aria-label="Effort in minutes"
              type="number"
              min={1}
              max={100000}
              step={1}
              value={effort}
              onChange={(e) => setEffort(e.target.value)}
            />
          </label>
          <CurriculumGroup
            id="edit-lesson"
            title="Learning details"
            open={expanded.has("lesson")}
            onToggle={() => toggle("lesson")}
          >
            <div className="space-y-3">
              <label className="block space-y-2 text-sm">
                Objectives, one per line
                <Textarea
                  aria-label="Objectives"
                  value={objectives}
                  onChange={(e) => setObjectives(e.target.value)}
                />
              </label>
              <label className="block space-y-2 text-sm">
                Exercise
                <Textarea
                  aria-label="Exercise"
                  value={exercise}
                  maxLength={4000}
                  onChange={(e) => setExercise(e.target.value)}
                />
              </label>
            </div>
          </CurriculumGroup>
          <CurriculumGroup
            id="edit-resources"
            title="Resources"
            open={expanded.has("resources")}
            onToggle={() => toggle("resources")}
          >
            <div className="space-y-3">
              <p className="text-xs text-foreground-muted">
                Choose one to three sources and explain their relevance.
              </p>
              {sources
                .filter((s) => s.status !== "unavailable")
                .map((source) => (
                  <div key={source.id} className="space-y-2">
                    <Button
                      variant="ghost"
                      className="h-auto w-full justify-start whitespace-normal text-left"
                      disabled={
                        resources.length >= 3 &&
                        !resources.some((r) => r.sourceId === source.id)
                      }
                      aria-pressed={resources.some(
                        (r) => r.sourceId === source.id,
                      )}
                      onClick={() => chooseSource(source)}
                    >
                      {resources.some((r) => r.sourceId === source.id)
                        ? "✓ "
                        : ""}
                      {source.title} · {source.access} · {source.status}
                    </Button>
                    {resources.some((r) => r.sourceId === source.id) && (
                      <Input
                        aria-label={`Why use ${source.title}?`}
                        value={
                          resources.find((r) => r.sourceId === source.id)
                            ?.rationale ?? ""
                        }
                        maxLength={2000}
                        onChange={(e) => {
                          setResourceEdited(true);
                          setResources((old) =>
                            old.map((r) =>
                              r.sourceId === source.id
                                ? { ...r, rationale: e.target.value }
                                : r,
                            ),
                          );
                        }}
                      />
                    )}
                  </div>
                ))}
              <div className="flex gap-2">
                <Input
                  aria-label="Public resource URL"
                  placeholder="Add a public link"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                />
                <Button
                  variant="secondary"
                  disabled={inspecting || resources.length >= 3 || !link.trim()}
                  onClick={() => void inspect()}
                >
                  {inspecting ? "Inspecting…" : "Inspect"}
                </Button>
              </div>
            </div>
          </CurriculumGroup>
          <CurriculumGroup
            id="edit-placement"
            title="Placement"
            open={expanded.has("placement")}
            onToggle={() => toggle("placement")}
          >
            <div className="space-y-3">
              <Select
                value={parent}
                onValueChange={(value) => value && setParent(value)}
              >
                <SelectTrigger aria-label="Parent phase or group">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {view.candidate.items
                    .filter(
                      (i) =>
                        ["phase", "group", "choice"].includes(i.kind) &&
                        i.id !== id,
                    )
                    .map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {parentChoice && parentChoice.selectedId !== id && (
                <Button
                  variant="secondary"
                  aria-pressed={useAlternative}
                  onClick={() => setUseAlternative((old) => !old)}
                >
                  {useAlternative
                    ? "Use this option in the core path"
                    : "Choose this alternative"}
                </Button>
              )}
              <label className="block space-y-2 text-sm">
                Presentation order
                <Input
                  aria-label="Presentation order"
                  type="number"
                  min={0}
                  step={1}
                  value={order}
                  onChange={(e) => setOrder(e.target.value)}
                />
              </label>
            </div>
          </CurriculumGroup>
          {sessions.length > 0 && (
            <CurriculumGroup
              id="edit-schedule"
              title="Schedule"
              open={expanded.has("schedule")}
              onToggle={() => toggle("schedule")}
            >
              <div className="space-y-3">
                <p className="text-xs text-foreground-muted">
                  Changing effort automatically recalculates the schedule.
                  Manual weeks must respect prerequisites.
                </p>
                {sessions.map((session, index) => (
                  <label
                    key={session.sequence}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span>{session.minutes} minutes · Week</span>
                    <Input
                      aria-label={`Week for session ${index + 1}`}
                      type="number"
                      min={1}
                      value={session.week}
                      onChange={(e) => {
                        setScheduleEdited(true);
                        setSessions((old) =>
                          old.map((s, n) =>
                            n === index
                              ? { ...s, week: Number(e.target.value) }
                              : s,
                          ),
                        );
                      }}
                    />
                  </label>
                ))}
              </div>
            </CurriculumGroup>
          )}
          {error && (
            <div className="space-y-2">
              <p role="alert" className="text-sm text-destructive">
                {error.message}
              </p>
              {error instanceof ApiError &&
                error.code === "REVISION_CONFLICT" &&
                onReload && (
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      await onReload();
                      onClose();
                    }}
                  >
                    Reload latest and discard draft
                  </Button>
                )}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          {!adding && (
            <Button
              variant="ghost"
              className="mr-auto"
              disabled={pending}
              onClick={() => setConfirm("remove")}
            >
              Remove topic
            </Button>
          )}
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending || inspecting} onClick={() => void save()}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </ModalFooter>
      </Modal>
      <ConfirmDialog
        isOpen={confirm !== null}
        onClose={() => setConfirm(null)}
        title={
          confirm === "remove"
            ? "Remove this topic?"
            : "Archive learning history?"
        }
        description="The topic leaves the active plan. Saved lessons, progress and assessments remain available in history."
        confirmText={
          confirm === "remove"
            ? "Remove and keep history"
            : "Save and keep history"
        }
        isLoading={pending}
        onConfirm={() => save(confirm === "remove", true)}
      />
    </>
  );
}
