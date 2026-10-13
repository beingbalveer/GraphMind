import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Textarea } from "@/components/ui/textarea";
import { Expand, Send, X } from "lucide-react";
import type { Lesson } from "./catalog";
import type { Message } from "./state";

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
  source,
  localNote,
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
  source: Lesson["source"];
  localNote: string;
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
                desc: localNote,
                href: "local-note",
                label: "Local sample content",
              },
              {
                title: source.title,
                desc: source.description,
                href: source.url,
                label: "Official external documentation",
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
