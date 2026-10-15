import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Textarea } from "@/components/ui/textarea";
import { ChevronRight, Send, X } from "lucide-react";
import { allLessons, type Lesson } from "./catalog";
import { allAvailableRoadmaps, getRoadmap, scopedKey, type State } from "./state";
import { LessonActivity, type ActivityProgress } from "./lesson-activity";

export function Home({
  state,
  activeEnrollment,
  onResume,
  onBrowse,
  onCreate,
  displayName,
}: {
  state: State;
  activeEnrollment?: State["enrollments"][number];
  onResume: () => void;
  onBrowse: () => void;
  onCreate: () => void;
  displayName?: string;
}) {
  const current = activeEnrollment;
  const roadmap = current && getRoadmap(current.templateId);
  const done = current?.completedTopicIds.length ?? 0;
  const count = roadmap ? allLessons(roadmap).length : 0;
  const currentLesson = roadmap && state.enrollmentId === current?.id
    ? allLessons(roadmap).find((lesson) => lesson.id === state.topicId)
    : undefined;
  const nextLesson = roadmap?.phases.flatMap((phase) => phase.lessons).find((lesson) => !current?.completedTopicIds.includes(lesson.id));
  return (
    <div className="mx-auto max-w-5xl px-6 py-12 md:px-10">
      <div className="mb-9">
        <div className="mb-3 flex items-center gap-2 text-xs text-foreground-muted">
          <span className="size-2 rounded-full bg-success" />
          Your learning space
        </div>
        <h1 className="text-xl font-semibold">
          {displayName ? `Welcome back, ${displayName}.` : "Make room for a little learning."}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-foreground-muted">
          Pick up where you left off, explore a sample roadmap, or describe a
          goal for a local demo copy.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.8fr]">
        <section className="rounded-2xl border border-border-subtle bg-surface p-6">
          {current ? (
            <>
              <div className="flex items-center justify-between">
                <Badge variant={done === count ? "success" : "outline"}>
                  {done === count ? "PATH COMPLETE" : "IN PROGRESS"}
                </Badge>
                <span className="text-xs text-foreground-muted">
                  {done}/{count} lessons
                </span>
              </div>
              <h2 className="mt-5 text-lg font-semibold">{current.title}</h2>
              <p className="mt-2 text-sm leading-6 text-foreground-muted">
                {roadmap?.summary}
              </p>
              {currentLesson && <p className="mt-4 text-sm"><span className="text-foreground-muted">Last active · </span>{currentLesson.title}</p>}
              {nextLesson && <p className="mt-1 text-sm"><span className="text-foreground-muted">Next lesson · </span>{nextLesson.title}</p>}
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${count ? (done / count) * 100 : 0}%` }}
                />
              </div>
              <Button className="mt-5" onClick={onResume}>
                {done === count ? "Review lessons" : "Continue learning"}
                <ChevronRight className="size-4" />
              </Button>
            </>
          ) : (
            <>
              <Badge variant="secondary">A place to begin</Badge>
              <h2 className="mt-5 text-lg font-semibold">
                Choose a roadmap for your next skill.
              </h2>
              <p className="mt-2 text-sm leading-6 text-foreground-muted">
                Saved roadmaps and your lesson progress will appear here.
              </p>
              <Button className="mt-5" onClick={onBrowse}>
                Browse sample roadmaps
              </Button>
            </>
          )}
        </section>
        <section className="rounded-2xl border border-border-subtle bg-background-secondary p-6">
          <h2 className="text-base font-semibold">Build a focused plan</h2>
          <p className="mt-2 text-sm leading-6 text-foreground-muted">
            Describe your goal and pace, then choose a fixed sample curriculum
            to preview as your own copy.
          </p>
          <Button variant="outline" className="mt-4" onClick={onCreate}>
            Create roadmap
          </Button>
        </section>
      </div>
    </div>
  );
}
export function MyLearning({
  state,
  onOpen,
  onBrowse,
}: {
  state: State;
  onOpen: (id: string) => void;
  onBrowse: () => void;
}) {
  const [query, setQuery] = useState("");
  const [progressFilter, setProgressFilter] = useState<
    "all" | "not-started" | "in-progress" | "completed"
  >("all");
  const rows = state.enrollments.filter((enrollment) => {
    if (!enrollment.title.toLowerCase().includes(query.toLowerCase()))
      return false;
    const course = getRoadmap(enrollment.templateId);
    if (!course) return false;
    const total = allLessons(course).length;
    const complete = enrollment.completedTopicIds.length;
    const topics = allLessons(course);
    const enrollmentWithLastTopic = enrollment as typeof enrollment & { lastTopicId?: string };
    const hasStarted = Boolean(enrollmentWithLastTopic.lastTopicId) || topics.some((lesson) => {
      const key = scopedKey(enrollment.id, lesson.id);
      const activity = state.activity[key];
      return Boolean(
        activity?.attempts || activity?.draft.trim() || activity?.selectedAnswer ||
        state.drafts[key]?.trim() || state.conversations[key]?.length ||
        state.readingPositions[key] > 0
      );
    });
    if (progressFilter === "completed") return complete >= total;
    if (progressFilter === "not-started") return !hasStarted;
    if (progressFilter === "in-progress") return hasStarted && complete < total;
    return true;
  });
  return (
    <div className="mx-auto max-w-5xl px-6 py-10 md:px-10">
      <h1 className="text-xl font-semibold">My learning</h1>
      <p className="mt-2 text-sm text-foreground-muted">
        Saved roadmaps are personal copies with progress kept separately from
        their public sample.
      </p>
      <div className="mt-5 max-w-md">
        <Input
          aria-label="Search My learning"
          placeholder="Search saved roadmaps"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="mt-4">
        <SegmentedTabs
          ariaLabel="Filter My learning by progress"
          items={[
            { id: "all", label: "All" },
            { id: "not-started", label: "Not started" },
            { id: "in-progress", label: "In progress" },
            { id: "completed", label: "Completed" },
          ]}
          value={progressFilter}
          onChange={setProgressFilter}
          size="sm"
        />
      </div>
      {rows.length ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {rows.map((e) => {
            const course = getRoadmap(e.templateId);
            const lessons = course ? allLessons(course) : [];
            const total = lessons.length;
            const next = lessons.find((item) => !e.completedTopicIds.includes(item.id));
            const complete = e.completedTopicIds.length >= total;
            const lastActive = state.enrollmentId === e.id ? lessons.find((item) => item.id === state.topicId) : undefined;
            return (
              <article
                key={e.id}
                className="rounded-2xl border border-border-subtle bg-surface p-5"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">
                    {course?.category ?? "Personal"}
                  </Badge>
                  <span className="text-xs text-foreground-muted">
                    {e.completedTopicIds.length}/{total} complete
                  </span>
                </div>
                <h2 className="mt-4 text-base font-semibold">{e.title}</h2>
                <p className="mt-2 text-sm text-foreground-muted">
                  {e.generation
                    ? `${e.generation.level} · ${e.generation.hoursPerWeek} hours/week · ${e.generation.duration} weeks`
                    : course?.duration}
                </p>
                <p className="mt-3 text-sm"><span className="text-foreground-muted">{complete ? "Ready to review" : next ? "Next lesson · " : "Progress · "}</span>{complete ? "Choose any lesson to revisit" : next?.title ?? `${e.completedTopicIds.length} lessons complete`}</p>
                {lastActive && <p className="mt-1 text-sm"><span className="text-foreground-muted">Last active · </span>{lastActive.title}</p>}
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" aria-label={`${total ? Math.round((e.completedTopicIds.length / total) * 100) : 0}% complete`}>
                  <div className="h-full bg-primary" style={{ width: `${total ? Math.min(100, (e.completedTopicIds.length / total) * 100) : 0}%` }} />
                </div>
                <Button
                  className="mt-5"
                  variant="outline"
                  onClick={() => onOpen(e.id)}
                >
                  Open course
                  <ChevronRight className="size-4" />
                </Button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-border-subtle bg-surface p-6">
          <h2 className="text-base font-medium">
            {query || progressFilter !== "all"
              ? "No matching roadmaps"
              : "Nothing saved yet"}
          </h2>
          <p className="mt-2 text-sm text-foreground-muted">
            {query || progressFilter !== "all"
              ? "Try another search."
              : "Browse a sample and save it to keep your progress here."}
          </p>
          {(query || progressFilter !== "all") && <Button className="mt-3" variant="outline" onClick={() => { setQuery(""); setProgressFilter("all"); }}>Clear search and filters</Button>}
          <Button className={query || progressFilter !== "all" ? "ml-2 mt-3" : "mt-4"} onClick={onBrowse}>
            Browse roadmaps
          </Button>
        </div>
      )}
    </div>
  );
}
export function Conversation({
  state,
  messages,
  prompt,
  setPrompt,
  send,
  busy = false,
  onStop,
  error,
  onRetry,
  onReturn,
  onTopic,
  quote,
  clearQuote,
}: {
  state: State;
  messages: State["conversations"][string];
  prompt: string;
  setPrompt: (value: string) => void;
  send: () => void;
  busy?: boolean;
  onStop?: () => void;
  error?: string;
  onRetry?: () => void;
  onReturn: () => void;
  onTopic: (id: string) => void;
  quote?: string;
  clearQuote: () => void;
}) {
  const course = getRoadmap(state.roadmapId)!;
  const lesson = allLessons(course).find((item) => item.id === state.topicId)!;
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col px-6 py-4 md:py-6">
      <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-foreground-muted">{course.title}</div>
          <h1 className="mt-2 text-lg font-semibold">{lesson.title}</h1>
          <p className="mt-1 text-xs text-foreground-muted">
            Sample replies · local demo
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onReturn}>
          Return to lesson
        </Button>
      </div>
      <nav aria-label="Choose a lesson topic" className="mb-3 flex max-w-full min-w-0 shrink-0 gap-2 overflow-x-auto pb-2">
        {allLessons(course).map((item) => (
          <Button
            key={item.id}
            size="sm"
            className="shrink-0"
            variant={item.id === lesson.id ? "secondary" : "ghost"}
            onClick={() => onTopic(item.id)}
          >
            {item.title}
          </Button>
        ))}
      </nav>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain rounded-2xl border border-border-subtle bg-surface p-4">
        {messages.length ? (
          messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[90%] rounded-xl p-3 text-sm leading-6 ${m.role === "learner" ? "ml-auto bg-primary text-primary-foreground" : "border border-border-subtle bg-background-secondary"}`}
            >
              <div className="mb-1 text-xs font-medium">
                {m.role === "learner" ? "You" : "Sample tutor reply"}
              </div>
              {m.quote && (
                <blockquote className="mb-2 border-l-2 border-current pl-3 text-xs italic opacity-80">
                  {m.quote}
                </blockquote>
              )}
              {m.text}
            </div>
          ))
        ) : (
          <p className="py-12 text-center text-sm text-foreground-muted">
            No messages for this lesson yet.
          </p>
        )}
      </div>
      {error && <div role="alert" className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/40 bg-background-secondary px-3 py-2 text-sm"><p>{error}</p>{onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Retry response</Button>}</div>}
      <form
        className="mt-3 shrink-0 rounded-2xl border border-border-subtle bg-surface p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) send();
        }}
      >
        {quote && (
          <div className="mb-3 rounded-xl border border-border-subtle bg-background-secondary p-3">
            <div className="mb-1 flex items-center justify-between text-xs font-medium">
              Selected passage
              <Button
                size="iconSm"
                variant="ghost"
                aria-label="Remove quoted passage"
                onClick={clearQuote}
              >
                <X className="size-3.5" />
              </Button>
            </div>
            <blockquote className="border-l-2 border-border-strong pl-3 text-xs leading-5 text-foreground-muted">
              {quote}
            </blockquote>
          </div>
        )}
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          aria-label="Write a message in this lesson conversation"
          placeholder="Ask a question about this lesson…"
          className="min-h-20"
        />
        <div className="mt-2 flex justify-end gap-2">
          {busy && onStop && <Button type="button" size="sm" variant="outline" onClick={onStop}>Stop generating</Button>}
          <Button type="submit" size="sm" disabled={busy || (!prompt.trim() && !quote)}>
            <Send className="size-3.5" />
            Send message
          </Button>
        </div>
      </form>
    </div>
  );
}

export function LearningLesson({
  roadmapId,
  topicId,
  enrollment,
  guest,
  onPrev,
  onRoadmap,
  onNext,
  onComplete,
  onAsk,
  onQuote,
  quote,
  note,
  onNote,
  activity,
  onActivityChange,
  onEnablePractice,
}: {
  roadmapId: string;
  topicId: string;
  enrollment?: State["enrollments"][number];
  guest: boolean;
  onPrev: () => void;
  onRoadmap: () => void;
  onNext: () => void;
  onComplete: () => void;
  onAsk: (quote?: string) => void;
  onQuote: (quote?: string) => void;
  quote?: string;
  note: boolean;
  onNote: (value: boolean) => void;
  activity?: ActivityProgress;
  onActivityChange: (progress: ActivityProgress) => void;
  onEnablePractice: () => void;
}) {
  const roadmap = getRoadmap(roadmapId);
  const lessons = roadmap ? allLessons(roadmap) : [];
  const index = Math.max(0, lessons.findIndex((item) => item.id === topicId));
  const lesson = lessons[index] ?? lessons[0];
  const [selectionNotice, setSelectionNotice] = useState<string>();
  if (!roadmap || !lesson) return <div className="mx-auto max-w-3xl px-6 py-10 text-sm text-foreground-muted">This lesson is no longer available.</div>;
  const done = enrollment?.completedTopicIds.includes(lesson.id) ?? false;
  const capture = () => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return false;
    const range = selection.getRangeAt(0);
    const content = document.querySelector("[data-lesson-content]");
    if (content?.contains(range.commonAncestorContainer) && selection.toString().trim()) {
      onQuote(selection.toString().trim());
      setSelectionNotice(undefined);
      return true;
    }
    return false;
  };
  const requestCapture = () => {
    if (!capture()) setSelectionNotice("Select text from the lesson reading first. Practice questions and controls are not included.");
  };

  return (
    <section aria-labelledby="lesson-title" className="lesson-reading mx-auto w-full max-w-3xl px-6 pb-16 pt-8 md:px-12">
      <nav aria-label="Lesson location" className="flex flex-wrap items-center gap-2 text-sm text-foreground-muted">
        <Button variant="link" className="h-auto p-0" onClick={onRoadmap}>Roadmap</Button><span aria-hidden="true">›</span><span>{lesson.section}</span>
      </nav>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">LESSON {String(index + 1).padStart(2, "0")}</Badge>
        <span className="text-sm text-foreground-muted">{lesson.duration} min</span>
        {done && <Badge variant="success">Completed</Badge>}
      </div>
      <h1 id="lesson-title" className="mt-3 text-xl font-semibold">{lesson.title}</h1>
      <p className="mt-2 text-base leading-7 text-foreground-muted">{lesson.objective}</p>

      <article data-lesson-content onMouseUp={capture} className="mt-8 space-y-7">
        {lesson.paragraphs.map(([heading, body]) => <section key={heading}><h2 className="mb-2 text-lg font-semibold">{heading}</h2><p className="text-base leading-7 text-foreground-muted">{body}</p></section>)}
        <section aria-labelledby="example-heading" className="overflow-hidden rounded-xl border border-border-subtle bg-code-bg">
          <h2 id="example-heading" className="border-b border-border-subtle bg-code-header-bg px-4 py-3 text-sm font-medium text-code-foreground">Worked example</h2>
          <pre className="overflow-x-auto p-4 text-sm leading-6 text-code-foreground"><code>{lesson.code}</code></pre>
        </section>
      </article>

      <section aria-labelledby="reflection-heading" className="mt-8 rounded-2xl border border-border-subtle bg-background-secondary p-5">
        <h2 id="reflection-heading" className="text-lg font-semibold">Pause and reflect</h2>
        <p className="mt-2 text-base leading-7 text-foreground-muted">{lesson.exercise}</p>
        <p className="mt-3 text-sm leading-6 text-foreground-muted">{lesson.note}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onPointerDown={(event) => event.preventDefault()} onClick={requestCapture}>Ask about selected passage</Button>
          <Button size="sm" onClick={() => onAsk(quote)}>{quote ? "Ask tutor with passage" : "Ask tutor about this lesson"}</Button>
        </div>
        {selectionNotice && <p role="status" className="mt-3 text-sm text-foreground-muted">{selectionNotice}</p>}
        {quote && <div className="mt-4 rounded-lg border border-border-subtle bg-surface p-3"><p className="text-xs font-medium text-foreground-muted">Selected lesson passage</p><blockquote className="mt-1 text-sm leading-6">{quote}</blockquote><Button variant="link" className="mt-1 h-auto p-0" onClick={() => onQuote(undefined)}>Clear selection</Button></div>}
      </section>

      <LessonActivity topicId={lesson.id} progress={activity} enabled={!guest && Boolean(enrollment)} onChange={onActivityChange} onEnablePractice={onEnablePractice} />

      <section className="mt-7 rounded-xl border border-border-subtle bg-surface p-4">
        <h2 className="text-base font-semibold">Source</h2>
        <p className="mt-2 text-sm leading-6 text-foreground-muted">{lesson.source.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <Button variant="link" className="h-auto p-0" onClick={() => onNote(true)}>Preview source note</Button>
          <a className="text-sm underline underline-offset-4" href={lesson.source.url} target="_blank" rel="noreferrer">{lesson.source.title} · official reference</a>
        </div>
        {note && <p role="status" className="mt-3 text-sm text-foreground-muted">Source note preview is open in the lesson details panel.</p>}
      </section>

      {guest && <p className="mt-6 text-sm text-foreground-muted">Public lesson preview. Reading is open; private practice and progress are available in a learning copy.</p>}
      <footer className="mt-9 flex flex-col gap-3 border-t border-border-subtle pt-5 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" disabled={index === 0} onClick={onPrev}>Previous lesson</Button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {done ? <Badge variant="success">This lesson is complete</Badge> : <Button variant="outline" onClick={onComplete}>{guest ? "Track progress" : "Mark complete"}</Button>}
          <Button onClick={onNext}>{index === lessons.length - 1 ? "Finish roadmap" : "Continue to next lesson"}<ChevronRight className="size-4" /></Button>
        </div>
      </footer>
    </section>
  );
}

export const LessonReader = LearningLesson;
export function LibraryView() {
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<string | undefined>();
  const [category, setCategory] = useState("all");
  const items = allAvailableRoadmaps().flatMap((course) =>
    allLessons(course).map((lesson) => ({ lesson, course })),
  );
  const categories = [...new Set(items.map(({ course }) => course.category))];
  const filtered = items.filter(({ lesson, course }) => (category === "all" || course.category === category) && `${lesson.title} ${lesson.source.title} ${lesson.source.description} ${course.title}`.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <div className="mx-auto max-w-5xl px-6 py-10 md:px-10">
      <Badge variant="secondary">REFERENCE LIBRARY</Badge>
      <h1 className="mt-4 text-xl font-semibold">
        Read alongside your lessons
      </h1>
      <p className="mt-2 text-sm text-foreground-muted">
        Local notes and cited official references from the sample roadmaps.
      </p>
      <div className="mt-5 max-w-lg">
        <Input aria-label="Search reference library" placeholder="Search topics and sources" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <div className="mt-4">
        <SegmentedTabs ariaLabel="Filter reference library by roadmap category" items={[{ id: "all", label: "All topics" }, ...categories.map((item) => ({ id: item, label: item }))]} value={category} onChange={setCategory} size="sm" />
      </div>
      {filtered.length ? <div className="mt-6 grid gap-3 md:grid-cols-2">
        {filtered.map(({ lesson, course }) => (
          <article
            key={`${course.id}:${lesson.id}`}
            className="rounded-2xl border border-border-subtle bg-surface p-4"
          >
            <div className="text-xs text-foreground-muted">{course.title}</div>
            <h2 className="mt-2 text-sm font-semibold">
              {lesson.source.title}
            </h2>
            <p className="mt-2 text-sm text-foreground-muted">
              {lesson.source.description}
            </p>
            <a
              className="mt-3 inline-block text-xs underline underline-offset-4"
              href={lesson.source.url}
              target="_blank"
              rel="noreferrer"
            >
              Open official reference
            </a>
            <Button variant="link" className="mt-3 block h-auto p-0" aria-expanded={preview === lesson.id} onClick={() => setPreview(preview === lesson.id ? undefined : lesson.id)}>{preview === lesson.id ? "Hide lesson note" : "Preview lesson note"}</Button>
            {preview === lesson.id && <p className="mt-2 rounded-lg bg-background-secondary p-3 text-sm leading-6 text-foreground-muted">{lesson.note}</p>}
          </article>
        ))}
      </div> : <div className="mt-6 rounded-2xl border border-border-subtle bg-surface p-6"><h2 className="text-base font-medium">No matching references</h2><p className="mt-2 text-sm text-foreground-muted">Try another topic, roadmap, or source name.</p><Button className="mt-3" variant="outline" onClick={() => { setQuery(""); setCategory("all"); }}>Clear search and filter</Button></div>}
    </div>
  );
}
