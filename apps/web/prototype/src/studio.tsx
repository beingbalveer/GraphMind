import {
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { NavigationItem } from "@/components/ui/navigation-item";
import { Textarea } from "@/components/ui/textarea";
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Compass,
  Expand,
  GraduationCap,
  Library,
  Menu,
  Moon,
  PanelRight,
  RotateCcw,
  Send,
  Sun,
  X,
} from "lucide-react";

import { curriculum } from "./curriculum";
export { curriculum } from "./curriculum";

import { initial, reducer, type State } from "./state";
import { LessonRow, PlanCreator, TutorPanel } from "./studio-components";

function useSmallScreen() {
  const [small, setSmall] = useState(
    () => window.matchMedia?.("(max-width: 1279px)").matches ?? true,
  );
  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia("(max-width: 1279px)");
    const update = () => setSmall(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return small;
}

export function LearningStudio() {
  const [state, dispatch] = useReducer(reducer, initial);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [tab, setTab] = useState<"tutor" | "sources">("tutor");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [titleInput, setTitleInput] = useState(initial.title);
  const [dark, setDark] = useState(false);
  const [notice, setNotice] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const readingPosition = useRef<Record<string, number>>({});
  const mainRef = useRef<HTMLElement>(null);
  const messageId = useRef(Date.now());
  const small = useSmallScreen();
  const lesson = curriculum[state.lesson];
  const prompt = drafts[lesson.id] ?? "";
  const setPrompt = (value: string) =>
    setDrafts((current) => ({ ...current, [lesson.id]: value }));
  const lessonArticleRef = useRef<HTMLElement>(null);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  useLayoutEffect(() => {
    if (state.view === "lesson" && mainRef.current) {
      mainRef.current.scrollTop = readingPosition.current[lesson.id] ?? 0;
    }
  }, [state.view, state.lesson, lesson.id]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !noteOpen && !mobileNav && !small)
        setTutorOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNav, noteOpen, small]);
  const messages = state.conversations[lesson.id] ?? [];
  const done = state.completed.includes(lesson.id);
  const progress = Math.round(
    (state.completed.length / curriculum.length) * 100,
  );
  const resetDemo = () => {
    dispatch({ type: "reset" });
    setDrafts({});
    readingPosition.current = {};
    setTutorOpen(false);
    setMobileNav(false);
    setNoteOpen(false);
    setTab("tutor");
    setTitleInput(initial.title);
    setNotice(
      "Demo reset. Your sample progress and conversations are cleared.",
    );
  };
  const send = () => {
    const text = prompt.trim();
    if (!text && !state.quote) return;
    dispatch({
      type: "message",
      topicId: lesson.id,
      message: {
        id: messageId.current++,
        role: "learner",
        text: text || "Can you explain this passage?",
        quote: state.quote,
      },
    });
    dispatch({
      type: "message",
      topicId: lesson.id,
      message: {
        id: messageId.current++,
        role: "tutor",
        text: `Sample tutor reply: In ${lesson.title}, follow the data through one step at a time. Identify what enters, what the code guarantees, and what the caller receives.`,
      },
    });
    dispatch({ type: "quote", value: undefined });
    setDrafts((current) => ({ ...current, [lesson.id]: "" }));
  };
  const selection = () => {
    const selected = window.getSelection();
    if (!selected || !selected.rangeCount) return;
    const range = selected.getRangeAt(0);
    if (!lessonArticleRef.current?.contains(range.commonAncestorContainer))
      return;
    const value = selected.toString().trim();
    if (value) {
      dispatch({ type: "quote", value });
      setTutorOpen(true);
      setTab("tutor");
    }
  };
  const goNext = () => {
    if (state.lesson === curriculum.length - 1) {
      dispatch({ type: "view", view: "home" });
      setNotice(
        "You reached the end of this sample path. Completion reflects the lessons you marked complete.",
      );
      return;
    }
    dispatch({ type: "lesson", index: state.lesson + 1 });
  };
  const leaveLesson = () => {
    if (state.view === "lesson" && mainRef.current)
      readingPosition.current[lesson.id] = mainRef.current.scrollTop;
  };
  const openView = (view: State["view"]) => {
    leaveLesson();
    dispatch({ type: "view", view });
    setTutorOpen(false);
    setMobileNav(false);
  };
  const nav = (view: State["view"], label: string, icon: React.ReactNode) => (
    <NavigationItem
      active={state.view === view}
      icon={icon}
      onClick={() => openView(view)}
    >
      {label}
    </NavigationItem>
  );
  return (
    <div className="studio-shell flex h-dvh min-h-0 overflow-hidden bg-background text-foreground">
      <aside className="studio-nav fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-border-subtle bg-background px-3 py-4">
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="size-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">GraphMind</div>
            <div className="text-xs text-foreground-muted">Learning studio</div>
          </div>
        </div>
        <div className="mb-2 px-2 text-2xs font-medium uppercase tracking-wider text-foreground-subtle">
          Workspace
        </div>
        <nav aria-label="Main navigation" className="space-y-1">
          {nav("home", "Home", <Compass />)}
          {nav("roadmap", "My learning", <BookOpen />)}
          {nav("library", "Library", <Library />)}
          <div className="ml-4 mt-4 border-l border-border-subtle pl-3">
            <div className="mb-2 text-xs text-foreground-subtle">
              Current path
            </div>
            <NavigationItem
              active={state.view === "lesson" || state.view === "roadmap"}
              icon={<span className="size-1.5 rounded-full bg-primary" />}
              onClick={() => openView("roadmap")}
            >
              Roadmap
            </NavigationItem>
            <NavigationItem
              active={state.view === "conversation"}
              icon={
                <span className="size-1.5 rounded-full border border-foreground-subtle" />
              }
              onClick={() => openView("conversation")}
            >
              Conversations
            </NavigationItem>
          </div>
        </nav>
        <div className="mt-auto space-y-1 border-t border-border-subtle pt-3">
          <div className="px-2 pb-2 text-xs text-foreground-subtle">
            Demo preferences
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={() => setDark(!dark)}
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {dark ? "Light appearance" : "Dark appearance"}
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-foreground-muted"
            onClick={resetDemo}
          >
            <RotateCcw className="size-4" />
            Reset demo
          </Button>
        </div>
      </aside>
      <div className="studio-main ml-60 flex h-dvh min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-13 shrink-0 items-center justify-between border-b border-border-subtle bg-background/95 px-6 backdrop-blur">
          <div className="flex items-center gap-2 text-xs text-foreground-muted">
            <Button
              className="mobile-nav-trigger hidden"
              variant="ghost"
              size="iconSm"
              aria-label="Open navigation"
              onClick={() => {
                setTutorOpen(false);
                setMobileNav(true);
              }}
            >
              <Menu className="size-4" />
            </Button>
            <span className="studio-title-prefix">Learning studio</span>
            <ChevronRight className="size-3" />
            <span className="studio-title-current min-w-0 truncate text-foreground">
              {state.view === "lesson"
                ? lesson.title
                : state.view === "conversation"
                  ? "Conversations"
                  : state.view === "library"
                    ? "Library"
                    : state.view === "roadmap"
                      ? "My learning"
                      : "Home"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="rounded-md">
              <span className="demo-label-desktop">Local demo</span>
              <span className="demo-label-mobile">Demo</span>
            </Badge>
            {state.view === "lesson" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMobileNav(false);
                  setTutorOpen(!tutorOpen);
                }}
              >
                <PanelRight className="size-3.5" /> Tutor
              </Button>
            )}
          </div>
        </header>
        <div className="studio-content flex min-h-0 min-w-0 flex-1">
          <main
            ref={mainRef}
            className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto"
            onScroll={(e) => {
              if (state.view === "lesson")
                readingPosition.current[lesson.id] = e.currentTarget.scrollTop;
            }}
          >
            {state.view === "home" && (
              <div className="mx-auto max-w-5xl px-8 py-12">
                <div className="mb-10">
                  <div className="mb-3 flex items-center gap-2 text-xs text-foreground-muted">
                    <span className="size-2 rounded-full bg-success" />
                    Your learning space
                  </div>
                  <h1 className="max-w-2xl text-xl font-semibold tracking-tight">
                    Make room for a little learning.
                  </h1>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-foreground-muted">
                    Pick up where you left off, or shape a focused path around a
                    skill you want to build.
                  </p>
                </div>
                <section className="grid gap-5 lg:grid-cols-[1.35fr_0.9fr]">
                  <article className="rounded-2xl border border-border-subtle bg-surface p-6 shadow-2xs">
                    <div className="mb-5 flex items-center justify-between">
                      <Badge
                        variant={
                          state.completed.length === curriculum.length
                            ? "success"
                            : "outline"
                        }
                      >
                        {state.completed.length === curriculum.length
                          ? "PATH COMPLETE"
                          : "IN PROGRESS"}
                      </Badge>
                      <span className="text-xs text-foreground-muted">
                        {state.completed.length} of {curriculum.length} lessons
                      </span>
                    </div>
                    <div className="mb-2 text-xs text-foreground-muted">
                      YOUR CURRENT PATH
                    </div>
                    <h2 className="text-xl font-semibold">{state.title}</h2>
                    <p className="mt-2 max-w-lg text-sm leading-6 text-foreground-muted">
                      A practical route from Python fundamentals to reliable
                      backend endpoints and tests.
                    </p>
                    <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-foreground-muted">
                      <span>{progress}% complete</span>
                      <span>
                        {curriculum.length - state.completed.length} lessons to
                        go
                      </span>
                    </div>
                    <Button
                      className="mt-6 gap-2"
                      onClick={() =>
                        dispatch({
                          type: "lesson",
                          index: Math.max(
                            0,
                            curriculum.findIndex(
                              (item) => !state.completed.includes(item.id),
                            ),
                          ),
                        })
                      }
                    >
                      {state.completed.length === curriculum.length
                        ? "Review lessons"
                        : "Continue learning"}
                      <ChevronRight className="size-4" />
                    </Button>
                  </article>
                  <article className="rounded-2xl border border-border-subtle bg-background-secondary p-6">
                    <div className="mb-4 flex size-9 items-center justify-center rounded-xl border border-border-subtle bg-surface">
                      <Clock3 className="size-4 text-foreground-muted" />
                    </div>
                    <h2 className="text-base font-semibold">
                      A steady pace works
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-foreground-muted">
                      Four short lessons, about an hour in total. Stop and
                      return whenever you like; your place stays here for this
                      demo session.
                    </p>
                    <Button
                      variant="ghost"
                      className="mt-4 px-0"
                      onClick={() =>
                        dispatch({ type: "view", view: "roadmap" })
                      }
                    >
                      View the roadmap
                      <ChevronRight className="size-4" />
                    </Button>
                  </article>
                </section>
                <section className="mt-10">
                  <div className="mb-4 flex items-end justify-between">
                    <div>
                      <div className="text-xs text-foreground-muted">
                        YOUR NEXT STEPS
                      </div>
                      <h2 className="mt-1 text-lg font-semibold">
                        A path with a clear destination
                      </h2>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        dispatch({ type: "view", view: "roadmap" })
                      }
                    >
                      See all
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {curriculum.slice(0, 2).map((item, i) => (
                      <LessonRow
                        key={item.id}
                        title={item.title}
                        index={i}
                        done={state.completed.includes(item.id)}
                        onClick={() => dispatch({ type: "lesson", index: i })}
                      />
                    ))}
                  </div>
                </section>
                <PlanCreator
                  value={titleInput}
                  setValue={setTitleInput}
                  onCreate={() => {
                    dispatch({ type: "title", value: titleInput });
                    dispatch({ type: "view", view: "roadmap" });
                    setNotice(
                      "Showing the fixed sample curriculum. The title is a local label; no custom plan was generated.",
                    );
                  }}
                />
              </div>
            )}
            {state.view === "roadmap" && (
              <div className="mx-auto max-w-4xl px-8 py-10">
                <div className="mb-8">
                  <Badge variant="secondary">SAMPLE CURRICULUM</Badge>
                  <h1 className="mt-4 text-xl font-semibold">{state.title}</h1>
                  <p className="mt-2 text-sm leading-6 text-foreground-muted">
                    A four-part introduction to the habits behind dependable
                    Python services.
                  </p>
                </div>
                <div className="mb-8 rounded-2xl border border-border-subtle bg-surface p-5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Course progress</span>
                    <span className="text-foreground-muted">
                      {state.completed.length}/{curriculum.length} lessons
                      complete
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  {curriculum.map((item, i) => (
                    <LessonRow
                      key={item.id}
                      title={item.title}
                      index={i}
                      done={state.completed.includes(item.id)}
                      onClick={() => dispatch({ type: "lesson", index: i })}
                    />
                  ))}
                </div>
              </div>
            )}
            {state.view === "lesson" && (
              <div className="lesson-layout mx-auto w-full max-w-[1280px]">
                <article
                  ref={lessonArticleRef}
                  className="lesson-reading min-w-0 flex-1 px-8 pb-20 pt-8 lg:px-14"
                  onMouseUp={selection}
                >
                  <div className="mx-auto max-w-2xl">
                    <div className="mb-5 flex items-center gap-2 text-xs text-foreground-muted">
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto min-w-0 p-0 text-xs"
                        onClick={() =>
                          dispatch({ type: "view", view: "roadmap" })
                        }
                      >
                        Roadmap
                      </Button>
                      <ChevronRight className="size-3" />
                      <span>{lesson.section}</span>
                    </div>
                    <div className="mb-3 flex items-center gap-2">
                      <Badge variant="secondary">
                        LESSON {String(state.lesson + 1).padStart(2, "0")}
                      </Badge>
                      <span className="flex items-center gap-1 text-xs text-foreground-muted">
                        <Clock3 className="size-3" />
                        {lesson.duration}
                      </span>
                    </div>
                    <h1 className="text-xl font-semibold leading-tight tracking-tight">
                      {lesson.title}
                    </h1>
                    <p className="mt-3 text-sm leading-6 text-foreground-muted">
                      Build a clear foundation, then connect it to the kind of
                      code you will write in a real service.
                    </p>
                    <div className="my-7 flex items-center gap-3 rounded-xl border border-border-subtle bg-background-secondary px-4 py-3">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-surface text-foreground-muted">
                        <BookOpen className="size-4" />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-medium">Learning goal</div>
                        <div className="mt-0.5 text-xs text-foreground-muted">
                          Explain the idea, then recognize where it fits in a
                          backend service.
                        </div>
                      </div>
                      <CircleHelp className="size-4 text-foreground-subtle" />
                    </div>
                    <div className="space-y-6" onDoubleClick={selection}>
                      {lesson.paragraphs.map(([heading, body]) => (
                        <section key={heading}>
                          <h2 className="mb-2 text-base font-semibold">
                            {heading}
                          </h2>
                          <p className="reading-text text-foreground-muted">
                            {body}
                          </p>
                        </section>
                      ))}
                    </div>
                    <div className="my-6 overflow-hidden rounded-xl border border-border-subtle bg-code-bg">
                      <div className="flex h-9 items-center justify-between border-b border-border-subtle bg-code-header-bg px-3">
                        <span className="text-xs text-code-foreground">
                          python
                        </span>
                        <span className="text-xs text-code-foreground">
                          Example
                        </span>
                      </div>
                      <pre className="overflow-x-auto p-4 text-xs leading-6 text-code-foreground">
                        <code>{lesson.code}</code>
                      </pre>
                    </div>
                    <div className="rounded-xl border border-border-subtle bg-background-secondary p-4">
                      <div className="text-xs font-medium">
                        Try this as you read
                      </div>
                      <p className="mt-1.5 text-sm leading-6 text-foreground-muted">
                        Select a sentence that feels unclear, then ask a
                        question with that passage attached.
                      </p>
                      <Button
                        className="mt-3"
                        variant="outline"
                        size="sm"
                        onPointerDown={(event) => event.preventDefault()}
                        onClick={selection}
                      >
                        Ask about selected text
                      </Button>
                    </div>
                    <div className="mt-10 flex flex-col gap-3 border-t border-border-subtle pt-5 sm:flex-row sm:items-center sm:justify-between">
                      <Button
                        variant="ghost"
                        disabled={state.lesson === 0}
                        onClick={() =>
                          dispatch({ type: "lesson", index: state.lesson - 1 })
                        }
                      >
                        <ChevronLeft className="size-4" />
                        Previous
                      </Button>
                      <div className="flex flex-wrap justify-end gap-2">
                        {!done && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              dispatch({ type: "complete" });
                              setNotice(
                                "Lesson marked complete. This records your choice; it does not measure mastery.",
                              );
                            }}
                          >
                            <Check className="size-4" />
                            Mark complete
                          </Button>
                        )}
                        <Button onClick={goNext}>
                          {state.lesson === curriculum.length - 1
                            ? "Finish path"
                            : "Next lesson"}
                          <ChevronRight className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            )}
            {state.view === "conversation" && (
              <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-6 py-8">
                <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-xs text-foreground-muted">
                      THIS LEARNING PATH
                    </div>
                    <h1 className="mt-2 text-xl font-semibold">
                      {lesson.title}
                    </h1>
                    <p className="mt-2 text-sm text-foreground-muted">
                      Conversation for lesson {state.lesson + 1} · replies are
                      local samples.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      dispatch({ type: "lesson", index: state.lesson })
                    }
                  >
                    Return to lesson
                  </Button>
                </div>
                <div
                  className="mb-5 flex gap-2 overflow-x-auto pb-1"
                  aria-label="Choose a lesson conversation"
                >
                  {curriculum.map((item, index) => (
                    <Button
                      key={item.id}
                      size="sm"
                      variant={index === state.lesson ? "secondary" : "ghost"}
                      onClick={() =>
                        dispatch({ type: "conversation-topic", index })
                      }
                    >
                      {item.title}
                    </Button>
                  ))}
                </div>
                <div className="min-h-40 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border-subtle bg-surface p-4">
                  {messages.length ? (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`max-w-[90%] rounded-xl p-3 text-sm leading-6 ${message.role === "learner" ? "ml-auto bg-primary text-primary-foreground" : "border border-border-subtle bg-background-secondary"}`}
                      >
                        <div className="mb-1 text-xs font-medium">
                          {message.role === "learner"
                            ? "You"
                            : "Sample tutor reply"}
                        </div>
                        {message.quote && (
                          <blockquote className="mb-2 border-l-2 border-current pl-3 text-xs italic opacity-80">
                            {message.quote}
                          </blockquote>
                        )}
                        {message.text}
                      </div>
                    ))
                  ) : (
                    <div className="flex h-full min-h-32 flex-col items-center justify-center text-center">
                      <BookOpen className="size-5 text-foreground-subtle" />
                      <p className="mt-2 text-sm font-medium">
                        No messages for this lesson yet
                      </p>
                      <p className="mt-1 text-xs text-foreground-muted">
                        Ask a question here or return to the lesson to select a
                        passage.
                      </p>
                    </div>
                  )}
                </div>
                <form
                  className="mt-3 rounded-2xl border border-border-subtle bg-surface p-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    send();
                  }}
                >
                  {state.quote && (
                    <div className="mb-3 rounded-xl border border-border-subtle bg-background-secondary p-3">
                      <div className="mb-1 flex items-center justify-between text-xs font-medium">
                        Selected passage
                        <Button
                          type="button"
                          size="iconSm"
                          variant="ghost"
                          aria-label="Remove quoted passage"
                          onClick={() =>
                            dispatch({ type: "quote", value: undefined })
                          }
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                      <blockquote className="border-l-2 border-border-strong pl-3 text-xs leading-5 text-foreground-muted">
                        {state.quote}
                      </blockquote>
                    </div>
                  )}
                  <Textarea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    aria-label="Write a message in this lesson conversation"
                    placeholder="Ask a question about this lesson…"
                    className="min-h-20 border-0 bg-transparent shadow-none"
                  />
                  <div className="mt-2 flex justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!prompt.trim() && !state.quote}
                    >
                      <Send className="size-3.5" />
                      Send message
                    </Button>
                  </div>
                </form>
              </div>
            )}
            {state.view === "library" && (
              <div className="mx-auto max-w-4xl px-8 py-10">
                <Badge variant="secondary">REFERENCE LIBRARY</Badge>
                <h1 className="mt-4 text-xl font-semibold">
                  Read alongside your lessons
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground-muted">
                  Short notes from this demo curriculum and real documentation
                  links that support the concepts.
                </p>
                <div className="mt-7 grid gap-4 md:grid-cols-2">
                  {[
                    {
                      name: "Python functions",
                      kind: "Demo reference · lesson 1",
                      summary:
                        "Functions bundle a named operation with parameters and a return value.",
                      ref: "Python tutorial: defining functions",
                      url: "https://docs.python.org/3/tutorial/controlflow.html#defining-functions",
                    },
                    {
                      name: "Pydantic models",
                      kind: "Demo reference · lesson 2",
                      summary:
                        "Models parse and validate data into typed objects at application boundaries.",
                      ref: "Pydantic models documentation",
                      url: "https://docs.pydantic.dev/latest/concepts/models/",
                    },
                    {
                      name: "FastAPI path operations",
                      kind: "Demo reference · lesson 3",
                      summary:
                        "Path operations connect a URL and HTTP method to a Python function.",
                      ref: "FastAPI first steps",
                      url: "https://fastapi.tiangolo.com/tutorial/first-steps/",
                    },
                    {
                      name: "pytest assertions",
                      kind: "Demo reference · lesson 4",
                      summary:
                        "Readable assertions make expected behavior explicit in a test.",
                      ref: "pytest getting started",
                      url: "https://docs.pytest.org/en/stable/getting-started.html",
                    },
                  ].map((x) => (
                    <article
                      key={x.name}
                      className="rounded-2xl border border-border-subtle bg-surface p-5"
                    >
                      <div className="flex items-center gap-2 text-xs text-foreground-muted">
                        <Library className="size-3.5" />
                        {x.kind}
                      </div>
                      <h2 className="mt-3 text-base font-semibold">{x.name}</h2>
                      <p className="mt-2 text-sm leading-6 text-foreground-muted">
                        {x.summary}
                      </p>
                      <div className="mt-4 border-t border-border-subtle pt-3">
                        <a
                          href={x.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium underline underline-offset-4"
                        >
                          {x.ref}
                        </a>
                        <p className="mt-1 text-xs text-foreground-subtle">
                          External documentation · opens in a new tab
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </main>
          {state.view === "lesson" && tutorOpen && !small && (
            <aside className="desktop-tutor min-h-0 w-[360px] shrink-0 border-l border-border-subtle">
              <TutorPanel
                tab={tab}
                setTab={setTab}
                openNote={() => setNoteOpen(true)}
                expandConversation={() => {
                  readingPosition.current[lesson.id] =
                    mainRef.current?.scrollTop ?? 0;
                  dispatch({ type: "view", view: "conversation" });
                  setTutorOpen(false);
                }}
                messages={messages}
                quote={state.quote}
                clearQuote={() => dispatch({ type: "quote", value: undefined })}
                prompt={prompt}
                setPrompt={setPrompt}
                send={send}
                topic={lesson.title}
              />
            </aside>
          )}
        </div>
        {notice && (
          <div
            role="status"
            className="fixed bottom-5 right-5 z-30 flex max-w-sm items-start gap-3 rounded-xl border border-border bg-surface p-4 text-sm shadow-lg"
          >
            <p className="text-foreground-muted">{notice}</p>
            <Button
              variant="ghost"
              size="iconSm"
              aria-label="Dismiss message"
              onClick={() => setNotice("")}
            >
              <X className="size-4" />
            </Button>
          </div>
        )}
        {small && (
          <Drawer
            isOpen={tutorOpen && state.view === "lesson"}
            onClose={() => setTutorOpen(false)}
            title="Tutor"
            description={lesson.title}
            headerActions={
              <Button
                variant="ghost"
                size="iconSm"
                aria-label="Open full conversation"
                onClick={() => {
                  leaveLesson();
                  dispatch({ type: "view", view: "conversation" });
                  setTutorOpen(false);
                }}
              >
                <Expand className="size-4" />
              </Button>
            }
            widthClassName="w-full sm:w-[420px]"
          >
            <TutorPanel
              showPanelHeader={false}
              tab={tab}
              setTab={setTab}
              openNote={() => setNoteOpen(true)}
              expandConversation={() => {
                readingPosition.current[lesson.id] =
                  mainRef.current?.scrollTop ?? 0;
                dispatch({ type: "view", view: "conversation" });
                setTutorOpen(false);
              }}
              messages={messages}
              quote={state.quote}
              clearQuote={() => dispatch({ type: "quote", value: undefined })}
              prompt={prompt}
              setPrompt={setPrompt}
              send={send}
              topic={lesson.title}
            />
          </Drawer>
        )}
        <Drawer
          isOpen={mobileNav}
          onClose={() => setMobileNav(false)}
          title="Learning studio"
          description="Navigation"
          widthClassName="w-[300px]"
        >
          <nav aria-label="Mobile navigation" className="space-y-1 p-3">
            {(["home", "roadmap", "library"] as const).map((view, i) => (
              <NavigationItem
                key={view}
                active={state.view === view}
                icon={[<Compass />, <BookOpen />, <Library />][i]}
                onClick={() => openView(view)}
              >
                {["Home", "My learning", "Library"][i]}
              </NavigationItem>
            ))}
            <div className="mt-4 border-t border-border-subtle pt-3">
              <div className="px-2 pb-2 text-xs text-foreground-muted">
                Current path
              </div>
              <NavigationItem
                active={state.view === "lesson" || state.view === "roadmap"}
                icon={<BookOpen />}
                onClick={() => openView("roadmap")}
              >
                Roadmap
              </NavigationItem>
              <NavigationItem
                active={state.view === "conversation"}
                icon={<BookOpen />}
                onClick={() => openView("conversation")}
              >
                Conversations
              </NavigationItem>
            </div>
          </nav>
          <div className="mt-auto border-t border-border-subtle p-3">
            <div className="mb-2 px-2 text-xs text-foreground-subtle">
              Demo preferences
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2"
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              {dark ? "Light appearance" : "Dark appearance"}
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-foreground-muted"
              onClick={resetDemo}
            >
              <RotateCcw className="size-4" />
              Reset demo
            </Button>
          </div>
        </Drawer>
        <Modal
          isOpen={noteOpen}
          onClose={() => setNoteOpen(false)}
          ariaLabel="Local lesson note"
        >
          <ModalHeader
            title="Local lesson note"
            description={lesson.title}
            onClose={() => setNoteOpen(false)}
          />
          <ModalBody>
            <p className="text-sm leading-6 text-foreground-muted">
              This reference preview is seeded with the local curriculum. Follow
              each value through the code: inputs enter at a clear boundary, a
              focused operation transforms them, and callers receive an explicit
              result.
            </p>
            <p className="mt-4 text-xs text-foreground-subtle">
              Local sample content · no external source
            </p>
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => setNoteOpen(false)}>Done</Button>
          </ModalFooter>
        </Modal>
      </div>
    </div>
  );
}
