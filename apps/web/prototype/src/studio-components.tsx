import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, Check, ChevronRight, Expand, Send, X } from "lucide-react";
import { curriculum } from "./curriculum";
import type { Message } from "./state";

const referencesByLesson = [
  {
    title: "Python functions",
    description: "Official Python reference for defining reusable functions.",
    url: "https://docs.python.org/3/tutorial/controlflow.html#defining-functions",
  },
  {
    title: "Pydantic models",
    description: "Official guide to model validation and typed data.",
    url: "https://docs.pydantic.dev/latest/concepts/models/",
  },
  {
    title: "FastAPI path operations",
    description: "Official FastAPI guide to declaring path operations.",
    url: "https://fastapi.tiangolo.com/tutorial/first-steps/",
  },
  {
    title: "pytest getting started",
    description: "Official pytest guide to writing and running tests.",
    url: "https://docs.pytest.org/en/stable/getting-started.html",
  },
];

export function LessonRow({
  title,
  index,
  done,
  onClick,
}: {
  title: string;
  index: number;
  done: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className="h-auto w-full justify-start rounded-2xl border border-border-subtle bg-surface p-4 text-left hover:border-border"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-background-secondary text-xs font-medium text-foreground-muted">
        {done ? (
          <Check className="size-4 text-success" />
        ) : (
          String(index + 1).padStart(2, "0")
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-foreground-muted">
          {curriculum[index].section} · {curriculum[index].duration}
        </span>
        <span className="mt-1 block whitespace-normal text-sm font-medium leading-5">
          {title}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-foreground-subtle" />
    </Button>
  );
}
export function PlanCreator({
  value,
  setValue,
  onCreate,
}: {
  value: string;
  setValue: (s: string) => void;
  onCreate: () => void;
}) {
  return (
    <section className="mt-10 rounded-2xl border border-border-subtle bg-background-secondary p-5">
      <div className="text-xs text-foreground-muted">START WITH A FOCUS</div>
      <h2 className="mt-1 text-base font-semibold">Name a skill to work on</h2>
      <p className="mt-1 text-sm text-foreground-muted">
        This local demo uses its fixed Python curriculum. Your text only changes
        the path label.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Learning path title"
          placeholder="e.g. Python for backend developers"
        />
        <Button onClick={onCreate} disabled={!value.trim()}>
          Create sample plan
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </section>
  );
}
export function TutorPanel({
  tab,
  setTab,
  messages,
  quote,
  clearQuote,
  prompt,
  setPrompt,
  send,
  topic,
  openNote,
  expandConversation,
  showPanelHeader = true,
}: {
  tab: "tutor" | "sources";
  setTab: (v: "tutor" | "sources") => void;
  openNote: () => void;
  expandConversation: () => void;
  showPanelHeader?: boolean;
  messages: Message[];
  quote?: string;
  clearQuote: () => void;
  prompt: string;
  setPrompt: (s: string) => void;
  send: () => void;
  topic: string;
}) {
  return (
    <section className="tutor-panel flex h-full min-h-0 w-full flex-col bg-background">
      {showPanelHeader && (
        <>
          <div className="flex h-13 shrink-0 items-center justify-between border-b border-border-subtle px-4">
            <div>
              <div className="text-sm font-semibold">Tutor</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Sample</Badge>
              <Button
                size="iconSm"
                variant="ghost"
                aria-label="Open full conversation"
                onClick={expandConversation}
              >
                <Expand className="size-4" />
              </Button>
            </div>
          </div>
          <div className="border-b border-border-subtle px-4 py-2 text-xs text-foreground-muted">
            {topic}
          </div>
          <div className="px-4 pt-3 text-xs text-foreground-subtle">
            Sample replies · local demo
          </div>
        </>
      )}
      <div className="border-b border-border-subtle px-4 py-3">
        <SegmentedTabs
          ariaLabel="Tutor and sources"
          items={[
            { id: "tutor", label: "Tutor" },
            { id: "sources", label: "Sources" },
          ]}
          value={tab}
          onChange={setTab}
          size="sm"
        />
      </div>
      {tab === "tutor" ? (
        <>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <div className="rounded-xl border border-border-subtle bg-surface p-3">
              <div className="text-xs font-medium">
                A question is a good next step
              </div>
              <p className="mt-1 text-xs leading-5 text-foreground-muted">
                Ask about the current lesson. Replies are scripted examples for
                this local preview.
              </p>
            </div>
            {quote && (
              <div className="rounded-xl border border-border bg-surface p-3">
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
            {messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl p-3 text-sm leading-6 ${m.role === "learner" ? "ml-5 bg-primary text-primary-foreground" : "mr-3 border border-border-subtle bg-surface text-foreground"}`}
              >
                <div
                  className={`mb-1 text-xs font-medium ${m.role === "learner" ? "opacity-70" : "text-foreground-muted"}`}
                >
                  {m.role === "learner" ? "You" : "Sample tutor reply"}
                </div>
                {m.quote && (
                  <blockquote className="mb-2 border-l-2 border-current pl-2 text-xs opacity-70">
                    {m.quote}
                  </blockquote>
                )}
                {m.text}
              </div>
            ))}
          </div>
          <form
            className="border-t border-border-subtle p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              aria-label="Ask a question about this lesson"
              placeholder="Ask about this lesson…"
              className="min-h-20 text-sm"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-foreground-subtle">
                Select text in the lesson to include a passage.
              </span>
              <Button
                type="submit"
                size="sm"
                disabled={!prompt.trim() && !quote}
                aria-label="Send question"
              >
                <Send className="size-3.5" />
                Ask tutor
              </Button>
            </div>
          </form>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <h3 className="text-xs font-semibold">Lesson references</h3>
          <p className="mt-1 text-xs leading-5 text-foreground-muted">
            Seeded learning notes and supporting documentation.
          </p>
          <div className="mt-4 space-y-3">
            {[
              {
                title: "Lesson note",
                desc: "A concise explanation included in this local curriculum fixture.",
                href: "local-note",
                label: "Local sample content",
              },
              {
                title:
                  referencesByLesson[
                    Math.max(
                      0,
                      curriculum.findIndex((item) => item.title === topic),
                    )
                  ].title,
                desc: referencesByLesson[
                  Math.max(
                    0,
                    curriculum.findIndex((item) => item.title === topic),
                  )
                ].description,
                href: referencesByLesson[
                  Math.max(
                    0,
                    curriculum.findIndex((item) => item.title === topic),
                  )
                ].url,
                label: "Official documentation",
              },
            ].map((x) => (
              <article
                key={x.title}
                className="rounded-xl border border-border-subtle bg-surface p-3"
              >
                <div className="text-xs text-foreground-subtle">{x.label}</div>
                <h4 className="mt-1 text-sm font-medium">{x.title}</h4>
                <p className="mt-1 text-xs leading-5 text-foreground-muted">
                  {x.desc}
                </p>
                {x.href === "local-note" ? (
                  <Button
                    className="mt-2 h-auto min-w-0 p-0 text-xs"
                    variant="link"
                    onClick={openNote}
                  >
                    Preview sample note
                  </Button>
                ) : (
                  <a
                    className="mt-2 inline-block text-xs underline underline-offset-4"
                    href={x.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open reference
                  </a>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
