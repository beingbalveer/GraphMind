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
import {
  BookOpen,
  Compass,
  GraduationCap,
  Library,
  Menu,
  Moon,
  RotateCcw,
  Sun,
  X,
  ChevronRight,
  PanelRight,
  Expand,
} from "lucide-react";
import { roadmaps, allLessons } from "./catalog";
import {
  CatalogView,
  Generator,
  LessonReader,
  RoadmapOverview,
} from "./studio-views";
import {
  initial,
  reducer,
  getRoadmap,
  activeEnrollment,
  enrollmentFor,
  currentEnrollment,
  privateKey,
  scopedKey,
  validGeneratorProfile,
  type State,
  type View,
} from "./state";
import { TutorPanel } from "./studio-components";
import { Home, MyLearning, Conversation, LibraryView } from "./learner-views";

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
  const [tutorTab, setTutorTab] = useState<"tutor" | "sources">("tutor");
  const [mobileNav, setMobileNav] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const readingRef = useRef<HTMLElement>(null);
  const jobTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const nextMessageId = useRef(1);
  const small = useSmallScreen();
  const roadmap = getRoadmap(state.roadmapId) ?? roadmaps[0];
  const lessons = allLessons(roadmap);
  const lesson =
    lessons.find((item) => item.id === state.topicId) ?? lessons[0];
  const enrollment = currentEnrollment(state);
  const key = privateKey(state);
  const quote = key ? state.quotes[key] : undefined;
  const prompt = key ? (state.drafts[key] ?? "") : "";
  const messages = key ? (state.conversations[key] ?? []) : [];
  const canUsePrivate = state.mode === "learner" && Boolean(enrollment);
  const localPositionKey =
    key ?? `public::${state.roadmapId}::${state.topicId}`;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", state.dark);
  }, [state.dark]);
  useLayoutEffect(() => {
    if (state.view === "lesson" && readingRef.current)
      readingRef.current.scrollTop =
        state.readingPositions[localPositionKey] ?? 0;
  }, [state.view, state.topicId, state.roadmapId, state.enrollmentId]);
  useEffect(
    () => () => {
      if (jobTimer.current) clearTimeout(jobTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (state.generatorStep !== "generating") return;
    const jobId = state.generatorJobId;
    jobTimer.current = setTimeout(
      () => dispatch({ type: "generator-complete", jobId }),
      650,
    );
    return () => {
      if (jobTimer.current) clearTimeout(jobTimer.current);
    };
  }, [state.generatorStep, state.generatorJobId]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !state.authOpen &&
        !noteOpen &&
        !mobileNav &&
        !small
      )
        setTutorOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.authOpen, noteOpen, mobileNav, small]);

  const rememberPosition = () => {
    if (state.view === "lesson" && readingRef.current)
      dispatch({
        type: "reading-position",
        key: localPositionKey,
        value: readingRef.current.scrollTop,
      });
  };
  const navigate = (view: View) => {
    rememberPosition();
    dispatch({ type: "navigate", view });
    setTutorOpen(false);
    setMobileNav(false);
  };
  const openRoadmap = (roadmapId: string) => {
    dispatch({ type: "open-roadmap", roadmapId });
    setTutorOpen(false);
  };
  const openTopic = (topicId: string) => {
    rememberPosition();
    dispatch({ type: "open-topic", topicId });
    setTutorOpen(false);
  };
  const openConversations = () => {
    rememberPosition();
    if (state.mode === "learner" && !enrollment) {
      dispatch({
        type: "open-tutor",
        roadmapId: state.roadmapId,
        topicId: state.topicId,
      });
    }
    dispatch({ type: "navigate", view: "conversation" });
    setTutorOpen(false);
    setMobileNav(false);
  };
  const gate = (
    intent: Parameters<typeof reducer>[1] extends never
      ? never
      : import("./state").PendingIntent,
  ) => dispatch({ type: "gate", intent });
  const save = () =>
    state.mode === "learner"
      ? dispatch({ type: "save-roadmap", roadmapId: state.roadmapId })
      : gate({ type: "save", roadmapId: state.roadmapId });
  const completion = () =>
    state.mode === "learner"
      ? dispatch({
          type: "complete-topic",
          roadmapId: state.roadmapId,
          topicId: state.topicId,
          enrollmentId: enrollment?.id,
        })
      : gate({
          type: "complete",
          roadmapId: state.roadmapId,
          topicId: state.topicId,
        });
  const askTutor = (selectedQuote?: string) => {
    if (state.mode === "guest") {
      gate({
        type: "tutor",
        roadmapId: state.roadmapId,
        topicId: state.topicId,
        quote: selectedQuote,
      });
      return;
    }
    dispatch({
      type: "open-tutor",
      roadmapId: state.roadmapId,
      topicId: state.topicId,
      quote: selectedQuote,
    });
    setTutorTab("tutor");
    setTutorOpen(true);
  };
  const send = () => {
    if (!canUsePrivate || (!prompt.trim() && !quote)) return;
    const text = prompt.trim() || "Can you explain this passage?";
    dispatch({
      type: "send-message",
      message: { id: nextMessageId.current++, role: "learner", text, quote },
    });
    dispatch({
      type: "send-message",
      message: {
        id: nextMessageId.current++,
        role: "tutor",
        text: `Sample tutor reply: In ${lesson.title}, follow the idea one step at a time. Notice what enters, what the code guarantees, and what the caller receives.`,
      },
    });
  };
  const navItem = (view: View, label: string, icon: React.ReactNode) => (
    <NavigationItem
      key={view}
      active={state.view === view}
      icon={icon}
      onClick={() => navigate(view)}
    >
      {label}
    </NavigationItem>
  );
  const firstIncomplete = (roadmapId: string, completedIds: string[]) =>
    allLessons(getRoadmap(roadmapId) ?? roadmaps[0]).find(
      (item) => !completedIds.includes(item.id),
    )?.id ?? allLessons(getRoadmap(roadmapId) ?? roadmaps[0])[0].id;
  const startGenerator = () => {
    if (state.mode === "guest") return gate({ type: "generator" });
    navigate("generator");
    dispatch({ type: "generator-step", step: "form" });
  };
  const reset = () => {
    if (jobTimer.current) clearTimeout(jobTimer.current);
    setTutorOpen(false);
    setMobileNav(false);
    setNoteOpen(false);
    dispatch({ type: "reset" });
  };
  const signIn = () => {
    const intent = state.pendingIntent;
    dispatch({ type: "sign-in" });
    if (intent?.type === "tutor") {
      setTutorTab("tutor");
      setTutorOpen(true);
    }
  };
  const signOut = () => {
    if (jobTimer.current) clearTimeout(jobTimer.current);
    setTutorOpen(false);
    setMobileNav(false);
    dispatch({ type: "sign-out" });
  };
  const startGeneration = () => {
    if (!validGeneratorProfile(state.generatorProfile)) return;
    const jobId = state.generatorJobId + 1;
    dispatch({ type: "generator-job", jobId });
  };
  const goNext = () => {
    const index = lessons.findIndex((item) => item.id === state.topicId);
    if (index === lessons.length - 1) {
      navigate(state.mode === "learner" ? "my-learning" : "overview");
      return;
    }
    openTopic(lessons[index + 1].id);
  };

  return (
    <div className="studio-shell flex h-dvh min-h-0 overflow-hidden bg-background text-foreground">
      {state.mode === "learner" && (
        <aside className="studio-nav fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-border-subtle bg-background px-3 py-4">
          <Brand />
          <div className="mb-2 px-2 text-2xs font-medium uppercase tracking-wider text-foreground-subtle">
            Learning
          </div>
          <nav aria-label="Main navigation" className="space-y-1">
            {navItem("home", "Home", <Compass />)}
            {navItem("my-learning", "My learning", <BookOpen />)}
            {navItem("catalog", "Browse roadmaps", <Compass />)}
            {navItem("generator", "Create roadmap", <GraduationCap />)}
            {navItem("library", "Library", <Library />)}
            {(state.view === "lesson" ||
              state.view === "overview" ||
              state.view === "conversation") && (
              <div className="ml-4 mt-4 border-l border-border-subtle pl-3">
                <div className="mb-2 text-xs text-foreground-subtle">
                  Active roadmap
                </div>
                <NavigationItem
                  active={state.view === "overview" || state.view === "lesson"}
                  icon={<span className="size-1.5 rounded-full bg-primary" />}
                  onClick={() => navigate("overview")}
                >
                  Roadmap
                </NavigationItem>
                <NavigationItem
                  active={state.view === "conversation"}
                  icon={
                    <span className="size-1.5 rounded-full border border-foreground-subtle" />
                  }
                  onClick={openConversations}
                >
                  Conversations
                </NavigationItem>
              </div>
            )}
          </nav>
          <div className="mt-auto space-y-1 border-t border-border-subtle pt-3">
            <Appearance
              dark={state.dark}
              toggle={() => dispatch({ type: "theme", dark: !state.dark })}
            />
            <Button
              variant="ghost"
              className="w-full justify-start gap-2"
              onClick={signOut}
            >
              Sign out
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-foreground-muted"
              onClick={reset}
            >
              <RotateCcw className="size-4" />
              Reset demo
            </Button>
          </div>
        </aside>
      )}
      <div
        className={`studio-main ${state.mode === "learner" ? "ml-60" : ""} flex h-dvh min-h-0 min-w-0 flex-1 flex-col`}
      >
        <header className="flex h-13 shrink-0 items-center justify-between border-b border-border-subtle bg-background/95 px-5 backdrop-blur">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              className="mobile-nav-trigger hidden"
              variant="ghost"
              size="iconSm"
              aria-label="Open navigation"
              onClick={() => setMobileNav(true)}
            >
              <Menu className="size-4" />
            </Button>
            {state.mode === "guest" ? (
              <Brand compact />
            ) : (
              <>
                <span className="studio-title-prefix text-xs text-foreground-muted">
                  Learning studio
                </span>
                <ChevronRight className="size-3 text-foreground-muted" />
                <span className="min-w-0 truncate text-sm">
                  {state.view === "lesson"
                    ? lesson.title
                    : viewTitle(state.view)}
                </span>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="secondary">
              {state.mode === "guest" ? "Guest preview" : "Local demo"}
            </Badge>
            {state.mode === "guest" ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden sm:inline-flex"
                  onClick={() => navigate("catalog")}
                >
                  Browse roadmaps
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden sm:inline-flex"
                  onClick={startGenerator}
                >
                  Create roadmap
                </Button>
                <Button
                  variant="ghost"
                  size="iconSm"
                  aria-label={
                    state.dark
                      ? "Switch to light appearance"
                      : "Switch to dark appearance"
                  }
                  onClick={() => dispatch({ type: "theme", dark: !state.dark })}
                >
                  {state.dark ? (
                    <Sun className="size-4" />
                  ) : (
                    <Moon className="size-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => gate({ type: "signin" })}
                >
                  Sign in
                </Button>
              </>
            ) : (
              state.view === "lesson" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTutorOpen((open) => !open)}
                >
                  <PanelRight className="size-4" />
                  Tutor
                </Button>
              )
            )}
          </div>
        </header>
        <div className="studio-content flex min-h-0 min-w-0 flex-1">
          <main
            ref={readingRef}
            className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto"
            onScroll={(event) => {
              if (state.view === "lesson")
                dispatch({
                  type: "reading-position",
                  key: localPositionKey,
                  value: event.currentTarget.scrollTop,
                });
            }}
          >
            {state.view === "catalog" && (
              <CatalogView
                state={state}
                onFilter={(field, value) =>
                  dispatch({ type: "catalog-filter", field, value })
                }
                onOpen={openRoadmap}
              />
            )}
            {state.view === "overview" && (
              <RoadmapOverview
                roadmapId={state.roadmapId}
                enrollment={currentEnrollment(state)}
                onLesson={openTopic}
                onSave={save}
                onGate={startGenerator}
                onBack={() => navigate("catalog")}
              />
            )}
            {state.view === "lesson" && (
              <LessonReader
                roadmapId={state.roadmapId}
                topicId={state.topicId}
                enrollment={enrollment}
                guest={!canUsePrivate}
                onPrev={() => {
                  const index = lessons.findIndex(
                    (item) => item.id === state.topicId,
                  );
                  if (index > 0) openTopic(lessons[index - 1].id);
                }}
                onRoadmap={() => navigate("overview")}
                onNext={goNext}
                onComplete={completion}
                onAsk={askTutor}
                onQuote={(value) => {
                  if (state.mode === "learner") askTutor(value);
                  else
                    gate({
                      type: "tutor",
                      roadmapId: state.roadmapId,
                      topicId: state.topicId,
                      quote: value,
                    });
                }}
                quote={quote}
                note={false}
                onNote={setNoteOpen}
              />
            )}
            {state.view === "home" && (
              <Home
                state={state}
                activeEnrollment={
                  enrollment ?? state.enrollments[state.enrollments.length - 1]
                }
                onResume={() => {
                  const chosen =
                    enrollment ??
                    state.enrollments[state.enrollments.length - 1];
                  if (!chosen) return navigate("catalog");
                  const id = firstIncomplete(
                    chosen.templateId,
                    chosen.completedTopicIds,
                  );
                  dispatch({
                    type: "open-enrollment",
                    enrollmentId: chosen.id,
                    topicId: id,
                  });
                }}
                onBrowse={() => navigate("catalog")}
                onCreate={startGenerator}
              />
            )}
            {state.view === "my-learning" && (
              <MyLearning
                state={state}
                onOpen={(id) => {
                  const enrollment = state.enrollments.find(
                    (item) => item.id === id,
                  )!;
                  dispatch({
                    type: "open-enrollment",
                    enrollmentId: id,
                    topicId: firstIncomplete(
                      enrollment.templateId,
                      enrollment.completedTopicIds,
                    ),
                  });
                }}
                onBrowse={() => navigate("catalog")}
              />
            )}
            {state.view === "generator" && (
              <Generator
                profile={state.generatorProfile}
                step={state.generatorStep}
                selectedTemplate={state.generatorTemplateId}
                onProfile={(field, value) =>
                  dispatch({ type: "generator-profile", field, value })
                }
                onStep={(step) => dispatch({ type: "generator-step", step })}
                onTemplate={(id) =>
                  dispatch({ type: "generator-template", roadmapId: id })
                }
                onGenerate={startGeneration}
                onCancel={() => {
                  if (jobTimer.current) clearTimeout(jobTimer.current);
                  dispatch({ type: "generator-step", step: "review" });
                }}
                onDone={() => navigate("my-learning")}
                onStartLearning={() => {
                  const generated = state.enrollments.find(
                    (item) => item.id === state.enrollmentId,
                  );
                  if (generated)
                    dispatch({
                      type: "open-enrollment",
                      enrollmentId: generated.id,
                      topicId: firstIncomplete(
                        generated.templateId,
                        generated.completedTopicIds,
                      ),
                    });
                }}
              />
            )}
            {state.view === "conversation" && (
              <Conversation
                state={state}
                messages={messages}
                prompt={prompt}
                setPrompt={(value) => dispatch({ type: "set-draft", value })}
                send={send}
                onReturn={() => navigate("lesson")}
                onTopic={(topicId) =>
                  dispatch({ type: "conversation-topic", topicId })
                }
                quote={quote}
                clearQuote={() =>
                  dispatch({ type: "set-quote", value: undefined })
                }
              />
            )}
            {state.view === "library" && <LibraryView />}
          </main>
          {state.view === "lesson" && tutorOpen && !small && canUsePrivate && (
            <aside className="desktop-tutor min-h-0 w-[360px] shrink-0 border-l border-border-subtle">
              <TutorPanel
                tab={tutorTab}
                setTab={setTutorTab}
                messages={messages}
                quote={quote}
                clearQuote={() =>
                  dispatch({ type: "set-quote", value: undefined })
                }
                prompt={prompt}
                setPrompt={(value) => dispatch({ type: "set-draft", value })}
                send={send}
                topic={lesson.title}
                source={lesson.source}
                localNote={lesson.note}
                openNote={() => setNoteOpen(true)}
                expandConversation={() => {
                  rememberPosition();
                  navigate("conversation");
                  setTutorOpen(false);
                }}
              />
            </aside>
          )}
        </div>
        {state.notice && (
          <div
            role="status"
            className="fixed bottom-5 right-5 z-30 flex max-w-sm items-start gap-3 rounded-xl border border-border bg-surface p-4 text-sm shadow-lg"
          >
            <p>{state.notice}</p>
            <Button
              variant="ghost"
              size="iconSm"
              aria-label="Dismiss message"
              onClick={() => dispatch({ type: "notice" })}
            >
              <X className="size-4" />
            </Button>
          </div>
        )}
        {small && state.mode === "learner" && (
          <Drawer
            isOpen={tutorOpen && state.view === "lesson" && canUsePrivate}
            onClose={() => setTutorOpen(false)}
            title="Tutor"
            description={lesson.title}
            headerActions={
              <Button
                variant="ghost"
                size="iconSm"
                aria-label="Open full conversation"
                onClick={() => {
                  rememberPosition();
                  navigate("conversation");
                }}
              >
                <Expand className="size-4" />
              </Button>
            }
            widthClassName="h-full w-full sm:w-[420px]"
          >
            <TutorPanel
              showPanelHeader={false}
              tab={tutorTab}
              setTab={setTutorTab}
              messages={messages}
              quote={quote}
              clearQuote={() =>
                dispatch({ type: "set-quote", value: undefined })
              }
              prompt={prompt}
              setPrompt={(value) => dispatch({ type: "set-draft", value })}
              send={send}
              topic={lesson.title}
              source={lesson.source}
              localNote={lesson.note}
              openNote={() => setNoteOpen(true)}
              expandConversation={() => {
                rememberPosition();
                navigate("conversation");
              }}
            />
          </Drawer>
        )}
        <Drawer
          isOpen={mobileNav}
          onClose={() => setMobileNav(false)}
          title={state.mode === "learner" ? "Learning studio" : "GraphMind"}
          description="Navigation"
          widthClassName="w-[320px]"
        >
          <nav aria-label="Mobile navigation" className="space-y-1 p-3">
            {state.mode === "guest" ? (
              <>
                <NavigationItem
                  active={state.view === "catalog"}
                  icon={<Compass />}
                  onClick={() => navigate("catalog")}
                >
                  Browse roadmaps
                </NavigationItem>
                <Button
                  className="mt-3 w-full"
                  onClick={() => {
                    setMobileNav(false);
                    gate({ type: "generator" });
                  }}
                >
                  Create roadmap
                </Button>
                <Button
                  variant="outline"
                  className="mt-2 w-full"
                  onClick={() => {
                    setMobileNav(false);
                    gate({ type: "signin" });
                  }}
                >
                  Sign in
                </Button>
                <Appearance
                  dark={state.dark}
                  toggle={() => dispatch({ type: "theme", dark: !state.dark })}
                />
              </>
            ) : (
              <>
                {navItem("home", "Home", <Compass />)}
                {navItem("my-learning", "My learning", <BookOpen />)}
                {navItem("catalog", "Browse roadmaps", <Compass />)}
                {navItem("generator", "Create roadmap", <GraduationCap />)}
                {navItem("library", "Library", <Library />)}
                {(state.view === "lesson" ||
                  state.view === "overview" ||
                  state.view === "conversation") && (
                  <div className="mt-4 border-t border-border-subtle pt-3">
                    <div className="mb-2 px-2 text-xs text-foreground-subtle">
                      Active roadmap
                    </div>
                    <NavigationItem
                      active={
                        state.view === "overview" || state.view === "lesson"
                      }
                      icon={<BookOpen />}
                      onClick={() => navigate("overview")}
                    >
                      Roadmap
                    </NavigationItem>
                    <NavigationItem
                      active={state.view === "conversation"}
                      icon={<BookOpen />}
                      onClick={openConversations}
                    >
                      Conversations
                    </NavigationItem>
                  </div>
                )}
              </>
            )}
          </nav>
          <div className="mt-auto space-y-1 border-t border-border-subtle p-3">
            <Appearance
              dark={state.dark}
              toggle={() => dispatch({ type: "theme", dark: !state.dark })}
            />
            {state.mode === "learner" && (
              <>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={signOut}
                >
                  Sign out
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={reset}
                >
                  <RotateCcw className="size-4" />
                  Reset demo
                </Button>
              </>
            )}
          </div>
        </Drawer>
        <Modal
          isOpen={state.authOpen}
          onClose={() => dispatch({ type: "dismiss-auth" })}
          ariaLabel="Demo sign in"
        >
          <ModalHeader
            title="Continue as a demo learner"
            description="Sign-in is simulated for this local preview. No credentials are collected."
            onClose={() => dispatch({ type: "dismiss-auth" })}
          />
          <ModalBody>
            <p className="text-sm leading-6 text-foreground-muted">
              Your public lesson stays open. Continuing will return to the same
              roadmap and carry out the action you selected.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => dispatch({ type: "dismiss-auth" })}
            >
              Keep browsing
            </Button>
            <Button onClick={signIn}>Continue as demo learner</Button>
          </ModalFooter>
        </Modal>
        <Modal
          isOpen={noteOpen}
          onClose={() => setNoteOpen(false)}
          ariaLabel="Lesson source note"
        >
          <ModalHeader
            title="Lesson source note"
            description={lesson.title}
            onClose={() => setNoteOpen(false)}
          />
          <ModalBody>
            <p className="text-sm leading-6 text-foreground-muted">
              {lesson.note}
            </p>
            <a
              className="mt-4 inline-block text-xs underline underline-offset-4"
              href={lesson.source.url}
              target="_blank"
              rel="noreferrer"
            >
              {lesson.source.title} · official external reference
            </a>
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => setNoteOpen(false)}>Done</Button>
          </ModalFooter>
        </Modal>
      </div>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <GraduationCap className="size-4" />
      </div>
      <div>
        <div className="text-sm font-semibold">GraphMind</div>
        {!compact && (
          <div className="text-xs text-foreground-muted">Learning studio</div>
        )}
      </div>
    </div>
  );
}
function Appearance({ dark, toggle }: { dark: boolean; toggle: () => void }) {
  return (
    <Button
      variant="ghost"
      className="w-full justify-start gap-2"
      onClick={toggle}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      {dark ? "Light appearance" : "Dark appearance"}
    </Button>
  );
}
function viewTitle(view: View) {
  return {
    home: "Home",
    "my-learning": "My learning",
    catalog: "Browse roadmaps",
    overview: "Roadmap",
    lesson: "Lesson",
    generator: "Create roadmap",
    conversation: "Conversations",
    library: "Library",
  }[view];
}
