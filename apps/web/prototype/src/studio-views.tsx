import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, Check, ChevronRight, Clock3, Search } from "lucide-react";
import { cloneElement, isValidElement, useId, type ReactElement } from "react";
import {
  allAvailableRoadmaps,
  allLessons,
  getRoadmap,
  validGeneratorProfile,
  isHttpUrl,
  type Roadmap,
} from "./state";
import type { GeneratorProfile, State } from "./state";

const card = "rounded-2xl border border-border-subtle bg-surface p-5";
export function CatalogView({
  state,
  onFilter,
  onOpen,
}: {
  state: State;
  onFilter: (
    field: "catalogQuery" | "catalogCategory" | "catalogLevel",
    value: string,
  ) => void;
  onOpen: (id: string) => void;
}) {
  const items = allAvailableRoadmaps().filter((item) => {
    const query = state.catalogQuery.toLocaleLowerCase().trim();
    const textMatch =
      !query ||
      `${item.title} ${item.summary} ${item.tags.join(" ")}`
        .toLocaleLowerCase()
        .includes(query);
    return (
      textMatch &&
      (state.catalogCategory === "All topics" ||
        item.category === state.catalogCategory) &&
      (state.catalogLevel === "All levels" || item.level === state.catalogLevel)
    );
  });
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
      <div className="max-w-2xl">
        <Badge variant="secondary">PUBLIC SAMPLE LIBRARY</Badge>
        <h1 className="mt-4 text-xl font-semibold">Browse roadmaps</h1>
        <p className="mt-2 text-sm leading-6 text-foreground-muted">
          Self-guided sample curricula with clear outcomes, short lessons, and
          practice prompts. These examples are seeded previews, not a
          comprehensive catalog.
        </p>
      </div>
      <div className="mt-7 grid gap-3 md:grid-cols-[minmax(220px,1fr)_190px_170px]">
        <Input
          startIcon={<Search className="size-4" />}
          aria-label="Search roadmaps"
          placeholder="Search skills or topics"
          value={state.catalogQuery}
          onChange={(e) => onFilter("catalogQuery", e.target.value)}
        />
        <Select
          value={state.catalogCategory}
          onValueChange={(v) =>
            onFilter("catalogCategory", String(v ?? "All topics"))
          }
        >
          <SelectTrigger aria-label="Filter by topic">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[
              "All topics",
              ...new Set(allAvailableRoadmaps().map((item) => item.category)),
            ].map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={state.catalogLevel}
          onValueChange={(v) =>
            onFilter("catalogLevel", String(v ?? "All levels"))
          }
        >
          <SelectTrigger aria-label="Filter by level">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["All levels", "Beginner", "Intermediate"].map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="mt-6 flex items-center justify-between text-xs text-foreground-muted">
        <span>
          {items.length} sample {items.length === 1 ? "roadmap" : "roadmaps"}
        </span>
        {(state.catalogQuery ||
          state.catalogCategory !== "All topics" ||
          state.catalogLevel !== "All levels") && (
          <Button
            variant="link"
            className="h-auto p-0"
            onClick={() => {
              onFilter("catalogQuery", "");
              onFilter("catalogCategory", "All topics");
              onFilter("catalogLevel", "All levels");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>
      {items.length ? (
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article key={item.id} className={`${card} flex min-h-64 flex-col`}>
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline">{item.category}</Badge>
                <span className="text-xs text-foreground-muted">
                  {item.level}
                </span>
              </div>
              <h2 className="mt-4 text-lg font-semibold">{item.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-foreground-muted">
                {item.summary}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-border-subtle pt-4 text-xs text-foreground-muted">
                <span>{allLessons(item).length} lessons</span>
                <span>{item.duration}</span>
              </div>
              <Button
                className="mt-4 w-full justify-between"
                variant="outline"
                onClick={() => onOpen(item.id)}
              >
                View roadmap <ChevronRight className="size-4" />
              </Button>
            </article>
          ))}
        </div>
      ) : (
        <div className={`${card} mt-3 text-center`}>
          <h2 className="text-base font-medium">No matching roadmaps</h2>
          <p className="mt-2 text-sm text-foreground-muted">
            Try another phrase or clear the filters.
          </p>
        </div>
      )}
    </div>
  );
}

export function RoadmapOverview({
  roadmapId,
  enrollment,
  onLesson,
  onSave,
  onGate,
  onBack,
}: {
  roadmapId: string;
  enrollment?: State["enrollments"][number];
  onLesson: (id: string) => void;
  onSave: () => void;
  onGate: () => void;
  onBack: () => void;
}) {
  const roadmap = getRoadmap(roadmapId)!;
  const lessons = allLessons(roadmap);
  const done = enrollment?.completedTopicIds ?? [];
  return (
    <div className="mx-auto max-w-4xl px-6 py-10 md:px-10">
      <Button variant="link" className="h-auto p-0" onClick={onBack}>
        ← Browse roadmaps
      </Button>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{roadmap.category}</Badge>
        <Badge variant="outline">{roadmap.level}</Badge>
        <Badge variant="outline">Sample curriculum</Badge>
      </div>
      <h1 className="mt-4 text-xl font-semibold">
        {enrollment?.title ?? roadmap.title}
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-foreground-muted">
        {roadmap.summary}
      </p>
      {enrollment?.generation && (
        <div className="mt-4 grid gap-3 rounded-xl border border-border-subtle bg-background-secondary p-4 sm:grid-cols-3">
          <div>
            <div className="text-xs text-foreground-muted">Your outcome</div>
            <p className="mt-1 text-sm">{enrollment.generation.outcome}</p>
          </div>
          <div>
            <div className="text-xs text-foreground-muted">Your pace</div>
            <p className="mt-1 text-sm">
              {enrollment.generation.hoursPerWeek} hours/week ·{" "}
              {enrollment.generation.duration} weeks
            </p>
          </div>
          <div>
            <div className="text-xs text-foreground-muted">Background</div>
            <p className="mt-1 text-sm">
              {enrollment.generation.background || "Not provided"}
            </p>
          </div>
        </div>
      )}
      <div className="mt-5 flex flex-wrap gap-4 text-xs text-foreground-muted">
        <span className="flex items-center gap-1">
          <Clock3 className="size-3.5" />
          {roadmap.duration}
        </span>
        <span>{lessons.length} lessons</span>
        {enrollment && (
          <span>
            {done.length}/{lessons.length} complete
          </span>
        )}
      </div>
      <div className="mt-7 flex flex-wrap gap-2">
        <Button onClick={() => onLesson(lessons[0].id)}>
          Read first lesson
        </Button>
        {enrollment ? (
          <Badge variant="success">In My learning</Badge>
        ) : (
          <Button variant="outline" onClick={onSave}>
            Save to My learning
          </Button>
        )}
        <Button variant="ghost" onClick={onGate}>
          Create a roadmap
        </Button>
      </div>
      <div className="mt-9 grid gap-6 lg:grid-cols-[1fr_280px]">
        <section>
          <h2 className="text-base font-semibold">Roadmap</h2>
          <div className="mt-4 space-y-5">
            {roadmap.phases.map((phase) => (
              <div key={phase.title}>
                <h3 className="mb-2 text-sm font-medium">{phase.title}</h3>
                <div className="space-y-2">
                  {phase.lessons.map((item, i) => (
                    <Button
                      key={item.id}
                      variant="ghost"
                      onClick={() => onLesson(item.id)}
                      className="h-auto w-full justify-start gap-3 rounded-xl border border-border-subtle bg-surface p-4 text-left"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background-secondary text-xs">
                        {done.includes(item.id) ? (
                          <Check className="size-4 text-success" />
                        ) : (
                          String(i + 1).padStart(2, "0")
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block whitespace-normal text-sm font-medium">
                          {item.title}
                        </span>
                        <span className="mt-1 block text-xs text-foreground-muted">
                          {item.duration} min · {item.objective}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0" />
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
        <aside className="space-y-5">
          <section className={card}>
            <h2 className="text-sm font-semibold">You will practice</h2>
            <ul className="mt-3 space-y-2 text-sm leading-5 text-foreground-muted">
              {roadmap.outcomes.map((x) => (
                <li key={x}>• {x}</li>
              ))}
            </ul>
          </section>
          <section className={card}>
            <h2 className="text-sm font-semibold">Before you begin</h2>
            {roadmap.prerequisites.map((x) => (
              <p
                key={x}
                className="mt-2 text-sm leading-5 text-foreground-muted"
              >
                {x}
              </p>
            ))}
          </section>
          <section className={card}>
            <h2 className="text-sm font-semibold">References</h2>
            {lessons.slice(0, 2).map((l) => (
              <a
                key={l.id}
                href={l.source.url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 block text-xs underline underline-offset-4"
              >
                {l.source.title} · official external documentation
              </a>
            ))}
          </section>
        </aside>
      </div>
    </div>
  );
}

export function LessonReader({
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
}) {
  const roadmap = getRoadmap(roadmapId)!;
  const lessons = allLessons(roadmap);
  const index = lessons.findIndex((item) => item.id === topicId);
  const lesson = lessons[index] ?? lessons[0];
  const done = enrollment?.completedTopicIds.includes(lesson.id) ?? false;
  const capture = () => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const article = document.querySelector("[data-lesson-article]");
    if (
      article?.contains(range.commonAncestorContainer) &&
      selection.toString().trim()
    )
      onQuote(selection.toString().trim());
  };
  return (
    <article
      data-lesson-article
      className="mx-auto max-w-3xl px-6 pb-16 pt-8 md:px-12"
      onMouseUp={capture}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
        <Button variant="link" className="h-auto p-0" onClick={onRoadmap}>
          Roadmap
        </Button>
        <span>›</span>
        <span>{lesson.section}</span>
      </div>
      <div className="mt-5 flex items-center gap-2">
        <Badge variant="secondary">
          LESSON {String(index + 1).padStart(2, "0")}
        </Badge>
        <span className="text-xs text-foreground-muted">
          {lesson.duration} min
        </span>
      </div>
      <h1 className="mt-3 text-xl font-semibold">{lesson.title}</h1>
      <p className="mt-3 text-sm leading-6 text-foreground-muted">
        {lesson.objective}
      </p>
      <div className="my-6 rounded-xl border border-border-subtle bg-background-secondary p-4">
        <div className="flex items-center gap-2 text-xs font-medium">
          <BookOpen className="size-4" />
          Learning goal
        </div>
        <p className="mt-2 text-sm leading-6 text-foreground-muted">
          {lesson.objective}
        </p>
      </div>
      <div className="space-y-6">
        {lesson.paragraphs.map(([heading, body]) => (
          <section key={heading}>
            <h2 className="mb-2 text-base font-semibold">{heading}</h2>
            <p className="reading-text text-foreground-muted">{body}</p>
          </section>
        ))}
      </div>
      <div className="my-6 overflow-hidden rounded-xl border border-border-subtle bg-code-bg">
        <div className="border-b border-border-subtle bg-code-header-bg px-3 py-2 text-xs text-code-foreground">
          Example
        </div>
        <pre className="overflow-x-auto p-4 text-xs leading-6 text-code-foreground">
          <code>{lesson.code}</code>
        </pre>
      </div>
      <section className="rounded-xl border border-border-subtle bg-background-secondary p-4">
        <h2 className="text-sm font-medium">Try this as you read</h2>
        <p className="mt-2 text-sm leading-6 text-foreground-muted">
          {lesson.exercise}
        </p>
        <Button
          className="mt-3"
          variant="outline"
          size="sm"
          onPointerDown={(e) => e.preventDefault()}
          onClick={capture}
        >
          Ask about selected text
        </Button>
        <Button className="ml-2 mt-3" size="sm" onClick={() => onAsk(quote)}>
          {quote ? "Ask tutor with passage" : "Ask tutor"}
        </Button>
      </section>
      <section className="mt-7 rounded-xl border border-border-subtle bg-surface p-4">
        <div className="text-xs font-medium">Lesson note</div>
        <p className="mt-2 text-sm leading-6 text-foreground-muted">
          {lesson.note}
        </p>
        <Button
          variant="link"
          className="mt-2 h-auto p-0"
          onClick={() => onNote(true)}
        >
          Preview this source note
        </Button>
        <a
          className="ml-4 text-xs underline underline-offset-4"
          href={lesson.source.url}
          target="_blank"
          rel="noreferrer"
        >
          {lesson.source.title} · official external reference
        </a>
      </section>
      {guest && (
        <p className="mt-6 text-xs text-foreground-muted">
          Public lesson preview · progress is not saved while browsing as a
          guest.
        </p>
      )}
      <div className="mt-9 flex flex-col gap-2 border-t border-border-subtle pt-5 sm:flex-row sm:justify-between">
        <Button variant="ghost" disabled={index === 0} onClick={onPrev}>
          Previous lesson
        </Button>
        <div className="flex flex-wrap justify-end gap-2">
          {guest ? (
            <Button variant="outline" onClick={onComplete}>
              Track progress
            </Button>
          ) : (
            !done && (
              <Button variant="outline" onClick={onComplete}>
                Mark complete
              </Button>
            )
          )}
          <Button onClick={onNext}>
            {index === lessons.length - 1 ? "Finish roadmap" : "Next lesson"}
          </Button>
        </div>
      </div>
      {note && (
        <div className="sr-only" role="status">
          Source note preview open
        </div>
      )}
    </article>
  );
}

export function Generator({
  profile,
  step,
  selectedTemplate,
  onProfile,
  onStep,
  onTemplate,
  onGenerate,
  onCancel,
  onDone,
  onStartLearning,
}: {
  profile: GeneratorProfile;
  step: State["generatorStep"];
  selectedTemplate: string;
  onProfile: (field: keyof GeneratorProfile, value: string | number) => void;
  onStep: (step: State["generatorStep"]) => void;
  onTemplate: (id: string) => void;
  onGenerate: () => void;
  onCancel: () => void;
  onDone: () => void;
  onStartLearning: () => void;
}) {
  const validUrl = !profile.referenceUrl || isHttpUrl(profile.referenceUrl);
  const valid = validGeneratorProfile(profile);
  const templates = allAvailableRoadmaps();
  return (
    <div className="mx-auto max-w-3xl px-6 py-10 md:px-10">
      <Badge variant="secondary">DEMO GENERATOR</Badge>
      <h1 className="mt-4 text-xl font-semibold">Create a focused roadmap</h1>
      <p className="mt-2 text-sm leading-6 text-foreground-muted">
        Describe your goal and pace. This preview makes a personal copy of one
        fixed sample curriculum; it does not generate arbitrary lessons.
      </p>
      {step === "form" && (
        <div className="mt-7 space-y-5">
          <Field label="Roadmap title">
            <Input
              value={profile.title}
              onChange={(e) => onProfile("title", e.target.value)}
              placeholder="e.g. Build my first API"
            />
          </Field>
          <Field label="Learning goal">
            <Textarea
              value={profile.prompt}
              onChange={(e) => onProfile("prompt", e.target.value)}
              placeholder="What do you want to learn and why?"
            />
          </Field>
          <Field label="Current level">
            <SegmentedTabs
              ariaLabel="Current level"
              items={["Beginner", "Intermediate", "Advanced"].map((id) => ({
                id,
                label: id,
              }))}
              value={profile.level}
              onChange={(v) => onProfile("level", v)}
              size="sm"
            />
          </Field>
          <Field label="Prior background and known skills">
            <Textarea
              value={profile.background}
              onChange={(e) => onProfile("background", e.target.value)}
              placeholder="What have you tried already?"
            />
          </Field>
          <Field label="Desired outcome">
            <Input
              value={profile.outcome}
              onChange={(e) => onProfile("outcome", e.target.value)}
              placeholder="What should you be able to do?"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Hours per week (1–40)">
              <Input
                type="number"
                min={1}
                max={40}
                value={profile.hoursPerWeek}
                onChange={(e) =>
                  onProfile("hoursPerWeek", Number(e.target.value))
                }
              />
            </Field>
            <Field label="Duration in weeks (1–52)">
              <Input
                type="number"
                min={1}
                max={52}
                value={profile.duration}
                onChange={(e) => onProfile("duration", Number(e.target.value))}
              />
            </Field>
          </div>
          <Field label="Optional reference URL">
            <Input
              type="url"
              aria-label="Optional reference URL"
              value={profile.referenceUrl}
              onChange={(e) => onProfile("referenceUrl", e.target.value)}
              placeholder="https://…"
            />
            {!validUrl && (
              <p className="text-xs text-destructive">
                Use a complete http:// or https:// URL.
              </p>
            )}
          </Field>
          <Field label="Choose a fixed sample curriculum">
            <div className="grid gap-2">
              {templates.map((item) => (
                <Button
                  key={item.id}
                  variant={
                    selectedTemplate === item.id ? "secondary" : "outline"
                  }
                  className="h-auto justify-start p-3 text-left"
                  onClick={() => onTemplate(item.id)}
                >
                  <span>
                    <span className="block text-sm font-medium">
                      {item.title}
                    </span>
                    <span className="mt-1 block whitespace-normal text-xs text-foreground-muted">
                      {item.summary}
                    </span>
                  </span>
                </Button>
              ))}
            </div>
          </Field>
          {!valid && (
            <p className="text-xs text-foreground-muted">
              Complete the title, learning goal and desired outcome; set a
              whole-number pace from 1–40 hours/week and duration from 1–52
              weeks.
            </p>
          )}
          <Button disabled={!valid} onClick={() => onStep("review")}>
            Review roadmap details <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
      {step === "review" && (
        <div className="mt-7 space-y-5">
          <div className={card}>
            <h2 className="text-base font-semibold">{profile.title}</h2>
            <p className="mt-2 text-sm leading-6 text-foreground-muted">
              {profile.prompt}
            </p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <Summary label="Level" value={profile.level} />
              <Summary
                label="Pace"
                value={`${profile.hoursPerWeek} hours/week for ${profile.duration} weeks`}
              />
              <Summary label="Outcome" value={profile.outcome} />
              <Summary
                label="Background"
                value={profile.background || "No background added"}
              />
              {profile.referenceUrl && (
                <Summary
                  label="Submitted reference URL"
                  value={profile.referenceUrl}
                />
              )}
            </dl>
          </div>
          <div className={card}>
            <h2 className="text-sm font-semibold">Selected local sample</h2>
            <p className="mt-2 text-sm text-foreground-muted">
              {getRoadmap(selectedTemplate)?.title} · lessons remain the fixed
              sample content.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onStep("form")}>
              Back and edit
            </Button>
            <Button onClick={onGenerate}>Start demo generation</Button>
          </div>
        </div>
      )}
      {step === "generating" && (
        <div className={`${card} mt-7`}>
          <h2 className="text-base font-semibold">Preparing your demo copy</h2>
          <p className="mt-2 text-sm text-foreground-muted">
            Local preview steps: validate the profile, copy the selected sample,
            and add it to My learning.
          </p>
          <div className="mt-5 space-y-2 text-sm">
            <p>✓ Profile accepted</p>
            <p>✓ Fixed sample selected</p>
            <p className="text-foreground-muted">Adding your personal copy…</p>
          </div>
          <Button className="mt-5" variant="outline" onClick={onCancel}>
            Cancel demo generation
          </Button>
        </div>
      )}
      {step === "result" && (
        <div className={`${card} mt-7`}>
          <Badge variant="success">Added to My learning</Badge>
          <h2 className="mt-4 text-lg font-semibold">{profile.title}</h2>
          <p className="mt-2 text-sm leading-6 text-foreground-muted">
            Your personal roadmap uses the selected sample lessons with your
            goal and pace attached.
          </p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Summary label="Outcome" value={profile.outcome} />
            <Summary
              label="Level and pace"
              value={`${profile.level} · ${profile.hoursPerWeek} hours/week for ${profile.duration} weeks`}
            />
            <Summary
              label="Background"
              value={profile.background || "Not provided"}
            />
            <Summary
              label="Content source"
              value={getRoadmap(selectedTemplate)?.title ?? "Selected sample"}
            />
            {profile.referenceUrl && (
              <Summary
                label="Submitted reference URL"
                value={profile.referenceUrl}
              />
            )}
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={onStartLearning}>Start learning</Button>
            <Button variant="outline" onClick={onDone}>
              Review in My learning
            </Button>
            <Button variant="ghost" onClick={() => onStep("form")}>
              Create another
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const id = useId();
  const control =
    isValidElement(children) &&
    (children.type === Input || children.type === Textarea)
      ? cloneElement(children as ReactElement<{ id?: string }>, { id })
      : children;
  const isControl = control !== children;

  return (
    <div className="space-y-2 text-sm font-medium">
      {isControl ? (
        <>
          <label htmlFor={id} className="block">
            {label}
          </label>
          {control}
        </>
      ) : (
        <div role="group" aria-label={label} className="space-y-2">
          <span className="block">{label}</span>
          {control}
        </div>
      )}
    </div>
  );
}
function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-foreground-muted">{label}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}
