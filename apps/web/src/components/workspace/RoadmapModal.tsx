"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JobActivity } from "@/components/roadmap/JobActivity";
import { JobStatus } from "@/components/roadmap/JobStatus";
import {
  shouldOpenCompletedRoadmap,
  useRoadmapJob,
} from "@/hooks/useRoadmapJob";
import {
  attachRoadmapFile,
  attachRoadmapLink,
  createRoadmapJob,
  startRoadmapJob,
  readRoadmapJob,
} from "@/lib/roadmapApi";
import type {
  JobReferenceData,
  JobSnapshot,
  LearningLevel,
  RoadmapRequest,
} from "@/lib/roadmapTypes";
import { buildWorkspaceUrl } from "@/lib/urls";
import { ResumeRefinement } from "@/components/roadmap/ResumeRefinement";
import { LegacyRoadmapModal } from "./LegacyRoadmapModal";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (workspaceId: string) => void;
  resumeJobId?: string | null;
  onJobAccepted?: (id: string) => void;
}
export function RoadmapModal(props: Props) {
  const [resumed, setResumed] = useState<{
    id: string;
    job: JobSnapshot;
  } | null>(null);
  useEffect(() => {
    if (
      process.env.NEXT_PUBLIC_ROADMAP_GENERATOR_ENABLED !== "true" ||
      !props.isOpen ||
      !props.resumeJobId
    )
      return;
    const controller = new AbortController();
    void (async () => {
      try {
        const job = await readRoadmapJob(props.resumeJobId!, controller.signal);
        if (!controller.signal.aborted && job) setResumed({ id: job.id, job });
      } catch {
        /* Saved progress hook provides recovery if this initial read fails. */
      }
    })();
    return () => controller.abort();
  }, [props.isOpen, props.resumeJobId]);

  if (process.env.NEXT_PUBLIC_ROADMAP_GENERATOR_ENABLED !== "true")
    return <LegacyRoadmapModal {...props} />;
  if (
    props.isOpen &&
    resumed &&
    resumed.id === props.resumeJobId &&
    resumed.job.operation === "refine" &&
    (resumed.job.targetWorkspaceId || resumed.job.result?.workspaceId)
  )
    return (
      <ResumeRefinement
        workspaceId={
          (resumed.job.targetWorkspaceId || resumed.job.result?.workspaceId)!
        }
        jobId={resumed.job.id}
        onClose={props.onClose}
      />
    );
  return <RoadmapSetup {...props} />;
}

function RoadmapSetup({
  isOpen,
  onClose,
  onSuccess,
  resumeJobId,
  onJobAccepted,
}: Props) {
  const router = useRouter();
  const path = usePathname();
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [level, setLevel] = useState<LearningLevel>("beginner");
  const [duration, setDuration] = useState("unsure");
  const [weeks, setWeeks] = useState("");
  const [hours, setHours] = useState("");
  const [background, setBackground] = useState("");
  const [link, setLink] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedId, setAcceptedId] = useState<string | null>(null);
  const [watchingId, setWatchingId] = useState<string | null>(
    resumeJobId || null,
  );
  const key = useRef<string | null>(null);
  const fingerprint = useRef<string | null>(null);
  const accepted = useRef<string | null>(null);
  const submitting = useRef(false);
  const attachedFiles = useRef(new Map<File, JobReferenceData>());
  const attachedLinks = useRef(new Set<string>());
  const pathRef = useRef(path);
  pathRef.current = path;
  const startPath = useRef(path);
  const openedResult = useRef<string | null>(null);
  const {
    job,
    events,
    connection,
    error: statusError,
    answer,
    cancel,
    retry,
  } = useRoadmapJob(watchingId);
  useEffect(() => {
    if (isOpen && resumeJobId) {
      setWatchingId(resumeJobId);
      startPath.current = pathRef.current;
    }
  }, [isOpen, resumeJobId]);
  useEffect(() => {
    if (
      job?.operation === "refine" ||
      job?.status !== "completed" ||
      !job.result ||
      openedResult.current === job.id
    )
      return;
    if (
      shouldOpenCompletedRoadmap({
        watchingJobId: watchingId,
        completedJobId: job.id,
        isProgressOpen: isOpen,
        currentPath: path,
        startPath: startPath.current,
      })
    ) {
      openedResult.current = job.id;
      onClose();
      if (onSuccess) onSuccess(job.result.workspaceId);
      else router.push(buildWorkspaceUrl(job.result.workspaceId));
    }
  }, [job, watchingId, isOpen, path, onClose, onSuccess, router]);
  function startOver() {
    accepted.current = null;
    key.current = null;
    fingerprint.current = null;
    attachedFiles.current.clear();
    attachedLinks.current.clear();
    setAcceptedId(null);
    setWatchingId(null);
    setError(null);
  }
  function addLink() {
    if (!link.trim()) return;
    try {
      const url = new URL(link.trim());
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error();
      if (links.length >= 10) {
        setError("Add at most 10 links.");
        return;
      }
      setLinks((values) =>
        values.includes(url.href) ? values : [...values, url.href],
      );
      setLink("");
      setError(null);
    } catch {
      setError("Enter a public HTTP or HTTPS link.");
    }
  }
  async function generate(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current || prompt.trim().length < 10) return;
    const selectedFiles = files;
    if (
      selectedFiles.length > 5 ||
      selectedFiles.some((file) => file.size > 20 * 1024 * 1024) ||
      selectedFiles.reduce((sum, file) => sum + file.size, 0) > 50 * 1024 * 1024
    ) {
      setError("Use up to 5 files, 20MB each and 50MB total.");
      return;
    }
    if (link.trim()) {
      setError("Add the reference link before generating.");
      return;
    }
    const request: RoadmapRequest = {
      title: title.trim() || null,
      prompt: prompt.trim(),
      level,
      background: background.trim() || null,
      duration:
        duration === "unsure"
          ? null
          : duration === "custom"
            ? { value: Number(weeks), unit: "weeks" }
            : { value: Number(duration), unit: "months" },
      hoursPerWeek: hours ? Number(hours) : null,
    };
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const nextFingerprint = JSON.stringify(request);
      if (!accepted.current && fingerprint.current !== nextFingerprint)
        key.current = null;
      fingerprint.current = nextFingerprint;
      key.current ??= crypto.randomUUID();
      if (!accepted.current) {
        const created = await createRoadmapJob(request, key.current);
        accepted.current = created.id;
        setAcceptedId(created.id);
      }
      const id = accepted.current;
      for (const file of selectedFiles) {
        const acknowledged = attachedFiles.current.get(file);
        if (acknowledged?.status === "rejected")
          throw new Error(
            acknowledged.error || "Start over to replace the unreadable file.",
          );
        if (acknowledged) continue;
        const result = await attachRoadmapFile(id, file);
        attachedFiles.current.set(file, result);
        if (result.status === "rejected")
          throw new Error(
            result.error ||
              `${file.name} could not be read. Start over to replace it.`,
          );
      }
      for (const url of links) {
        if (!attachedLinks.current.has(url)) {
          await attachRoadmapLink(id, url);
          attachedLinks.current.add(url);
        }
      }
      await startRoadmapJob(id);
      startPath.current = path;
      setWatchingId(id);
      onJobAccepted?.(id);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not start generation. Retry submission.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  const locked = busy || !!acceptedId;
  if (
    isOpen &&
    job?.operation === "refine" &&
    (job.targetWorkspaceId || job.result?.workspaceId)
  )
    return (
      <ResumeRefinement
        workspaceId={(job.targetWorkspaceId || job.result?.workspaceId)!}
        jobId={job.id}
        onClose={onClose}
      />
    );
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      className="max-w-[30rem] bg-background"
      ariaLabel="Create a learning roadmap"
    >
      <ModalHeader
        className="bg-background px-6 [&_h2]:text-xl"
        title={
          watchingId
            ? job?.title || "Your learning roadmap"
            : "Create a learning roadmap"
        }
        description={
          watchingId
            ? undefined
            : "Tell us where you want to go. We’ll research the path."
        }
        onClose={onClose}
      />
      {watchingId ? (
        <ModalBody className="space-y-6 p-6">
          {job ? (
            <JobStatus
              snapshot={job}
              onBackground={onClose}
              onCancel={cancel}
              onRetry={retry}
              onAnswer={answer}
            />
          ) : (
            <p className="text-sm text-foreground-muted">
              Loading saved progress…
            </p>
          )}
          {(connection === "offline" || statusError) && (
            <p role="status" className="text-xs text-foreground-muted">
              Connection interrupted. Your generation stays saved.
            </p>
          )}
          <JobActivity events={events} />
          {job && ["failed", "canceled", "completed"].includes(job.status) && (
            <Button variant="ghost" onClick={startOver}>
              Create another roadmap
            </Button>
          )}
        </ModalBody>
      ) : (
        <form onSubmit={generate} className="flex min-h-0 flex-col">
          <ModalBody className="space-y-5 p-6">
            <div className="space-y-2">
              <label htmlFor="roadmap-title" className="text-sm font-medium">
                Title{" "}
                <span className="font-normal text-foreground-muted">
                  · optional
                </span>
              </label>
              <Input
                id="roadmap-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={locked}
                maxLength={180}
                placeholder="My learning journey"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="roadmap-prompt" className="text-sm font-medium">
                What do you want to learn?
              </label>
              <Textarea
                id="roadmap-prompt"
                aria-label="Learning prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={locked}
                minLength={10}
                maxLength={8000}
                required
                placeholder="Describe your goal and what you’d like to be able to do."
                className="min-h-28 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label id="roadmap-level-label" className="text-sm font-medium">
                Current level
              </label>
              <Select
                items={[
                  { value: "beginner", label: "Beginner in this subject" },
                  { value: "intermediate", label: "Intermediate" },
                  { value: "advanced", label: "Advanced" },
                ]}
                value={level}
                onValueChange={(v) => {
                  if (v) setLevel(v);
                }}
              >
                <SelectTrigger
                  aria-labelledby="roadmap-level-label"
                  disabled={locked}
                  className="w-full border-border bg-surface"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">
                    Beginner in this subject
                  </SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label
                  id="roadmap-duration-label"
                  className="text-sm font-medium"
                >
                  Target duration
                </label>
                <Select
                  items={[
                    { value: "unsure", label: "Unsure" },
                    { value: "1", label: "1 month" },
                    { value: "3", label: "3 months" },
                    { value: "6", label: "6 months" },
                    { value: "custom", label: "Custom duration" },
                  ]}
                  value={duration}
                  onValueChange={(v) => {
                    if (v) setDuration(v);
                  }}
                >
                  <SelectTrigger
                    aria-labelledby="roadmap-duration-label"
                    disabled={locked}
                    className="w-full border-border bg-surface"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      ["unsure", "Unsure"],
                      ["1", "1 month"],
                      ["3", "3 months"],
                      ["6", "6 months"],
                      ["custom", "Custom duration"],
                    ].map(([value, text]) => (
                      <SelectItem key={value} value={value}>
                        {text}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {duration === "custom" && (
                  <Input
                    aria-label="Number of weeks"
                    type="number"
                    min={1}
                    max={104}
                    required
                    value={weeks}
                    onChange={(e) => setWeeks(e.target.value)}
                    disabled={locked}
                    placeholder="Weeks"
                  />
                )}
              </div>
              <div className="space-y-2">
                <label htmlFor="roadmap-hours" className="text-sm font-medium">
                  Hours per week
                </label>
                <Input
                  id="roadmap-hours"
                  type="number"
                  min={0.5}
                  max={80}
                  step={0.5}
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  disabled={locked}
                  placeholder="Optional"
                />
              </div>
            </div>
            <p className="text-xs text-foreground-muted">
              Time budget is optional. Choose Unsure if you’re still exploring.
            </p>
            <Collapsible className="border-t border-border-subtle pt-3">
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-between px-0"
                >
                  Background & references
                  <ChevronDown className="size-4 text-foreground-muted" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-3">
                <div className="space-y-2">
                  <label
                    htmlFor="roadmap-background"
                    className="text-sm font-medium"
                  >
                    What do you already know?
                  </label>
                  <Textarea
                    id="roadmap-background"
                    value={background}
                    onChange={(e) => setBackground(e.target.value)}
                    disabled={locked}
                    maxLength={4000}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="roadmap-link" className="text-sm font-medium">
                    Reference link
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="roadmap-link"
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      disabled={locked}
                      placeholder="A roadmap, syllabus or article URL"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={locked || !link.trim()}
                      onClick={addLink}
                    >
                      Add link
                    </Button>
                  </div>
                  {links.map((url) => (
                    <div key={url} className="flex items-center gap-2 text-xs">
                      <span className="min-w-0 flex-1 break-words text-foreground-muted">
                        {url}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="iconSm"
                        aria-label={`Remove ${url}`}
                        disabled={locked}
                        onClick={() =>
                          setLinks((values) => values.filter((v) => v !== url))
                        }
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="roadmap-files"
                    className="text-sm font-medium"
                  >
                    Reference files
                  </label>
                  <Input
                    id="roadmap-files"
                    type="file"
                    multiple
                    accept=".pdf,.txt,.md,text/plain,text/markdown,application/pdf"
                    disabled={locked}
                    onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  />
                  <p className="text-xs text-foreground-muted">
                    PDF, TXT or Markdown · up to 5 files, 20MB each.
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
            {error && (
              <div role="alert" className="space-y-2 text-sm text-destructive">
                <p>{error}</p>
                {acceptedId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={startOver}
                  >
                    Start over
                  </Button>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter className="flex flex-wrap justify-between gap-3 bg-background px-6">
            <p className="text-xs text-foreground-muted">
              Research continues in the background.
            </p>
            <Button type="submit" disabled={busy || prompt.trim().length < 10}>
              <Sparkles className="mr-2 size-4" />
              {busy
                ? "Starting…"
                : error && acceptedId
                  ? "Retry submission"
                  : "Generate roadmap"}
            </Button>
          </ModalFooter>
        </form>
      )}
    </Modal>
  );
}
