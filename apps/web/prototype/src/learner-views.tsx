import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, Check, ChevronRight, Library, Send, X } from "lucide-react";
import { allLessons } from "./catalog";
import { allAvailableRoadmaps, getRoadmap, type State } from "./state";

export function Home({
  state,
  activeEnrollment,
  onResume,
  onBrowse,
  onCreate,
}: {
  state: State;
  activeEnrollment?: State["enrollments"][number];
  onResume: () => void;
  onBrowse: () => void;
  onCreate: () => void;
}) {
  const current = activeEnrollment;
  const roadmap = current && getRoadmap(current.templateId);
  const done = current?.completedTopicIds.length ?? 0;
  const count = roadmap ? allLessons(roadmap).length : 0;
  return (
    <div className="mx-auto max-w-5xl px-6 py-12 md:px-10">
      <div className="mb-9">
        <div className="mb-3 flex items-center gap-2 text-xs text-foreground-muted">
          <span className="size-2 rounded-full bg-success" />
          Your learning space
        </div>
        <h1 className="text-xl font-semibold">
          Make room for a little learning.
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
    "all" | "in-progress" | "completed"
  >("all");
  const rows = state.enrollments.filter((enrollment) => {
    if (!enrollment.title.toLowerCase().includes(query.toLowerCase()))
      return false;
    const total = allLessons(getRoadmap(enrollment.templateId)!).length;
    const complete = enrollment.completedTopicIds.length;
    if (progressFilter === "completed") return complete >= total;
    if (progressFilter === "in-progress") return complete < total;
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
            const total = course ? allLessons(course).length : 0;
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
                <Button
                  className="mt-5"
                  variant="outline"
                  onClick={() => onOpen(e.id)}
                >
                  Resume roadmap
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
          <Button className="mt-4" onClick={onBrowse}>
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
  onReturn: () => void;
  onTopic: (id: string) => void;
  quote?: string;
  clearQuote: () => void;
}) {
  const course = getRoadmap(state.roadmapId)!;
  const lesson = allLessons(course).find((item) => item.id === state.topicId)!;
  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-6 py-8">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
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
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {allLessons(course).map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant={item.id === lesson.id ? "secondary" : "ghost"}
            onClick={() => onTopic(item.id)}
          >
            {item.title}
          </Button>
        ))}
      </div>
      <div className="min-h-40 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border-subtle bg-surface p-4">
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
      <form
        className="mt-3 rounded-2xl border border-border-subtle bg-surface p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
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
        <div className="mt-2 flex justify-end">
          <Button type="submit" size="sm" disabled={!prompt.trim() && !quote}>
            <Send className="size-3.5" />
            Send message
          </Button>
        </div>
      </form>
    </div>
  );
}
export function LibraryView() {
  const items = allAvailableRoadmaps().flatMap((course) =>
    allLessons(course).map((lesson) => ({ lesson, course })),
  );
  return (
    <div className="mx-auto max-w-5xl px-6 py-10 md:px-10">
      <Badge variant="secondary">REFERENCE LIBRARY</Badge>
      <h1 className="mt-4 text-xl font-semibold">
        Read alongside your lessons
      </h1>
      <p className="mt-2 text-sm text-foreground-muted">
        Local notes and cited official references from the sample roadmaps.
      </p>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {items.map(({ lesson, course }) => (
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
              Official external documentation
            </a>
          </article>
        ))}
      </div>
    </div>
  );
}
