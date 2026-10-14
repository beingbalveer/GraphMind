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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
  Settings,
  List,
  MessageSquare,
} from "lucide-react";
import { roadmaps, allLessons } from "./catalog";
import {
  CatalogView,
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
  type State,
  type View,
} from "./state";
import { TutorPanel } from "./studio-components";
import { Home, MyLearning, Conversation, LibraryView, LearningLesson } from "./learner-views";
import { restoreState, persistState, clearDemoStorage, exportState } from "./persistence";
import { GeneratorFlow } from "./generator-flow";
import { SettingsView } from "./settings-view";
import { Appearance, Brand, RoadmapOutline } from "./studio-chrome";
import { ChatsView } from "./chats-view";
import { chatWorkspace, type ChatMessage } from "./state";

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
  const [state, dispatch] = useReducer(reducer, initial, () => restoreState(readStorage()));
  const [tutorOpen, setTutorOpen] = useState(false);
  const [tutorTab, setTutorTab] = useState<"tutor" | "sources">("tutor");
  const [mobileNav, setMobileNav] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [mobileOutlineOpen, setMobileOutlineOpen] = useState(false);
  const [effectiveDark, setEffectiveDark] = useState(false);
  const readingRef = useRef<HTMLElement>(null);
  const skipNextPersist = useRef(false);
  const tutorTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const tutorJob = useRef<{ key: string; messageId: number; question: string; quote?: string } | undefined>(undefined);
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const nextMessageId = useRef(Math.max(0, ...Object.values(state.conversations).flat().map((message) => message.id)) + 1);
  const [tutorBusy, setTutorBusy] = useState(false);
  const [chatBusy, setChatBusy] = useState<Record<string, boolean>>({});
  const chatJobs = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; id: string; text: string; offset: number }>());
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
  const tutorLocation = useRef({ key: localPositionKey, view: state.view });

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = state.preferences.theme === "dark" || (state.preferences.theme === "system" && media?.matches);
      document.documentElement.classList.toggle("dark", Boolean(dark));
      setEffectiveDark(Boolean(dark));
    };
    apply();
    media?.addEventListener("change", apply);
    return () => media?.removeEventListener("change", apply);
  }, [state.preferences.theme, state.dark]);
  useEffect(() => {
    if (skipNextPersist.current) { skipNextPersist.current = false; return; }
    persistState(readStorage(), state);
  }, [state]);
  useLayoutEffect(() => {
    if (state.view === "lesson" && readingRef.current)
      readingRef.current.scrollTop =
        state.readingPositions[localPositionKey] ?? 0;
  }, [state.view, state.topicId, state.roadmapId, state.enrollmentId]);
  useEffect(
    () => () => {
      if (tutorTimer.current) clearTimeout(tutorTimer.current);
      saveTimers.current.forEach(clearTimeout);
    },
    [],
  );
  useEffect(() => {
    const previous = tutorLocation.current;
    const canContinue = previous.key === localPositionKey && ["lesson", "conversation"].includes(previous.view) && ["lesson", "conversation"].includes(state.view);
    if (!canContinue && tutorTimer.current) {
      clearTimeout(tutorTimer.current);
      tutorTimer.current = undefined;
      const job = tutorJob.current;
      if (job) {
        dispatch({ type: "tutor-remove", key: job.key, messageId: job.messageId });
        dispatch({ type: "tutor-error", key: job.key, value: "Response paused because you left this topic. Return to the conversation to retry the same question." });
      }
      tutorJob.current = undefined;
      setTutorBusy(false);
    }
    tutorLocation.current = { key: localPositionKey, view: state.view };
  }, [localPositionKey, state.view]);
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
  const scheduleSave = (saveKey: string, retry: boolean) => {
    if (state.saveJobs[saveKey] === "pending") return;
    if (retry) dispatch({ type: "save-retry", key: saveKey });
    else dispatch({ type: "save-start", key: saveKey });
    const existingTimer = saveTimers.current.get(saveKey);
    if (existingTimer) clearTimeout(existingTimer);
    const failOnce = !retry && state.scenario === "save-error";
    if (failOnce) dispatch({ type: "scenario", value: "normal" });
    const timer = setTimeout(() => {
      if (failOnce) dispatch({ type: "save-fail", key: saveKey });
      else dispatch({ type: "save-finish", key: saveKey });
      saveTimers.current.delete(saveKey);
    }, 500);
    saveTimers.current.set(saveKey, timer);
  };
  const completion = () => {
    if (state.mode !== "learner") return gate({ type: "complete", roadmapId: state.roadmapId, topicId: state.topicId });
    const targetEnrollment = enrollment ?? enrollmentFor(state, state.roadmapId);
    const enrollmentId = targetEnrollment?.id ?? `demo-enrollment-${state.enrollments.length + 1}`;
    const saveKey = scopedKey(enrollmentId, state.topicId);
    if (!targetEnrollment) dispatch({ type: "enable-practice", roadmapId: state.roadmapId, topicId: state.topicId });
    scheduleSave(saveKey, state.saveJobs[saveKey] === "error");
  };
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
  const runTutor = (key: string, question: string, passage?: string) => {
    if (tutorTimer.current) clearTimeout(tutorTimer.current);
    const answerId = nextMessageId.current++;
    tutorJob.current = { key, messageId: answerId, question, quote: passage };
    dispatch({ type: "tutor-error", key });
    if (state.scenario === "tutor-error") {
      dispatch({ type: "scenario", value: "normal" });
      tutorTimer.current = setTimeout(() => {
        dispatch({ type: "tutor-error", key, value: "The sample tutor could not finish this request. Your question is saved; retry when ready." });
        tutorJob.current = undefined;
        setTutorBusy(false);
      }, 450);
      setTutorBusy(true);
      return;
    }
    const lessonContext = lesson;
    const detail = state.preferences.tutorStyle === "concise"
      ? `${lessonContext.title} focuses on: ${lessonContext.objective} For your question “${question}”, apply that objective to one small example${passage ? `, using the selected passage “${passage.slice(0, 100)}”` : ""}.`
      : `In ${lessonContext.title}, the goal is to ${lessonContext.objective.toLowerCase()} Start with the idea in “${lessonContext.paragraphs[0]?.[0] ?? lessonContext.section}”. ${passage ? `The selected passage says “${passage.slice(0, 120)}”. ` : ""}Try a small example: write down the starting value, apply the rule described in the lesson, and check whether the result meets its objective. What part of that example is unclear in your question: ${question}`;
    const reply = detail;
    setTutorBusy(true);
    let position = 0;
    const stream = () => {
      position = Math.min(position + 12, reply.length);
      dispatch({ type: "tutor-upsert", key, message: { id: answerId, role: "tutor", text: reply.slice(0, position), quote: passage, status: position < reply.length ? "streaming" : "complete" } });
      if (position < reply.length) tutorTimer.current = setTimeout(stream, 28);
      else { setTutorBusy(false); tutorJob.current = undefined; }
    };
    tutorTimer.current = setTimeout(stream, 100);
  };
  const send = () => {
    if (!canUsePrivate || (!prompt.trim() && !quote) || tutorBusy || !key) return;
    const text = prompt.trim() || "Can you explain this passage?";
    dispatch({ type: "send-message", message: { id: nextMessageId.current++, role: "learner", text, quote } });
    runTutor(key, text, quote);
  };
  const retryTutor = () => {
    if (!key || tutorBusy) return;
    const prior = [...messages].reverse().find((message) => message.role === "learner");
    if (prior) runTutor(key, prior.text, prior.quote);
  };
  const stopTutor = () => {
    if (tutorTimer.current) clearTimeout(tutorTimer.current);
    tutorTimer.current = undefined;
    const job = tutorJob.current;
    if (job) {
      dispatch({ type: "tutor-remove", key: job.key, messageId: job.messageId });
      dispatch({ type: "tutor-error", key: job.key, value: "Response stopped. Your question is saved; retry to continue the sample response." });
    }
    tutorJob.current = undefined;
    setTutorBusy(false);
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
  const resumeTopic = (item: { templateId: string; completedTopicIds: string[]; lastTopicId?: string }, current?: string) => {
    const valid = allLessons(getRoadmap(item.templateId) ?? roadmaps[0]);
    const available = (id?: string) => id && valid.some((lesson) => lesson.id === id) && !item.completedTopicIds.includes(id) ? id : undefined;
    return available(current) ?? available(item.lastTopicId) ?? firstIncomplete(item.templateId, item.completedTopicIds);
  };
  const startGenerator = () => {
    if (state.mode === "guest") return gate({ type: "generator" });
    navigate("generator");
    dispatch({ type: "generator-step", step: "form" });
  };
  const reset = () => {
    if (tutorTimer.current) clearTimeout(tutorTimer.current);
    tutorJob.current = undefined;
    setTutorBusy(false);
      saveTimers.current.forEach(clearTimeout);
    setTutorOpen(false);
    setMobileNav(false);
    setNoteOpen(false);
    skipNextPersist.current = true;
    dispatch({ type: "reset" });
  };
  const signIn = () => {
    const intent = state.pendingIntent;
    dispatch({ type: "sign-in" });
    if (intent?.type === "complete") {
      const targetEnrollmentId = enrollmentFor(state, intent.roadmapId)?.id ?? `demo-enrollment-${state.enrollments.length + 1}`;
      scheduleSave(scopedKey(targetEnrollmentId, intent.topicId), false);
    }
    if (intent?.type === "tutor") {
      setTutorTab("tutor");
      setTutorOpen(true);
    }
  };
  const signOut = () => {
    setTutorOpen(false);
    setMobileNav(false);
    if (tutorTimer.current) clearTimeout(tutorTimer.current);
    tutorJob.current = undefined;
    setTutorBusy(false);
    saveTimers.current.forEach(clearTimeout);
    chatJobs.current.forEach((job, id) => {
      clearTimeout(job.timer);
      dispatch({ type: "chat-message", id, message: { id: job.id, role: "tutor", text: job.text.slice(0, job.offset), status: "stopped" } });
      dispatch({ type: "chat-error", id, value: "Response interrupted when you signed out. Your question is saved; retry after signing in again." });
    });
    chatJobs.current.clear();
    setChatBusy({});
    dispatch({ type: "sign-out" });
  };
  const createChat = () => {
    const activeWorkspace = state.view === "chats" && state.activeChatId ? chatWorkspace(state, state.activeChatId) : undefined;
    const workspaceId = activeWorkspace ?? enrollment?.id ?? "personal-workspace";
    dispatch({ type: "chat-create", id: `chat-${crypto.randomUUID()}`, workspaceId });
    setMobileNav(false);
  };
  const openChat = (id: string) => {
    if (id.startsWith("topic:")) {
      try {
        const topicKey = decodeURIComponent(id.slice(6));
        const separator = topicKey.indexOf("::");
        if (separator > 0) {
          const topicId = topicKey.slice(separator + 2);
          const owner = state.enrollments.find((item) => item.id === topicKey.slice(0, separator));
          if (owner) { rememberPosition(); dispatch({ type: "open-enrollment", enrollmentId: owner.id, topicId }); }
        }
      } catch { /* corrupted local key is ignored */ }
    }
    dispatch({ type: "chat-open", id });
  };
  const startChatReply = (id: string, prompt: string, reuseAnswerId?: string) => {
    const thread = state.chats.find((item) => item.id === id);
    if (!thread || chatJobs.current.has(id) || state.mode !== "learner") return;
    dispatch({ type: "chat-error", id });
    if (state.scenario === "tutor-error") {
      dispatch({ type: "scenario", value: "normal" });
      dispatch({ type: "chat-error", id, value: "The sample response could not finish. Your question is saved; retry when ready." });
      return;
    }
    const answerId = reuseAnswerId ?? crypto.randomUUID();
    const reply = (thread.quote
      ? `Let’s focus on “${thread.quote.slice(0, 140)}”. A useful next step is to identify the claim in that passage, then test it with one concrete example. Your question was: ${prompt}`
      : `Let’s explore ${prompt}. Start with the simplest useful model: name the main idea, connect it to one familiar example, and then check where that model stops being accurate. Which part would you like to unpack first?`).slice(0, 4000);
    setChatBusy((current) => ({ ...current, [id]: true }));
    let offset = 0;
    if (reuseAnswerId) dispatch({ type: "chat-message", id, message: { id: answerId, role: "tutor", text: "", status: "streaming" } });
    const stream = () => {
      if (state.mode !== "learner" || !state.chats.some((item) => item.id === id)) { chatJobs.current.delete(id); setChatBusy((current) => ({ ...current, [id]: false })); return; }
      offset = Math.min(offset + 14, reply.length);
      dispatch({ type: "chat-message", id, message: { id: answerId, role: "tutor", text: reply.slice(0, offset), status: offset < reply.length ? "streaming" : "complete" } });
      if (offset < reply.length) {
        const timer = setTimeout(stream, 26);
        chatJobs.current.set(id, { timer, id: answerId, text: reply, offset });
      } else { chatJobs.current.delete(id); setChatBusy((current) => ({ ...current, [id]: false })); }
    };
    const timer = setTimeout(stream, 150);
    chatJobs.current.set(id, { timer, id: answerId, text: reply, offset });
  };
  const sendChat = (id: string) => {
    const thread = state.chats.find((item) => item.id === id);
    if (!thread || !thread.draft.trim() || chatJobs.current.size > 0 || state.mode !== "learner") return;
    const prompt = thread.draft.trim();
    dispatch({ type: "chat-message", id, message: { id: crypto.randomUUID(), role: "learner", text: prompt, status: "complete" } });
    startChatReply(id, prompt);
  };
  const retryChat = (id: string) => {
    if (chatJobs.current.size > 0) return;
    const thread = state.chats.find((item) => item.id === id);
    const lastQuestion = thread?.messages.findLast((message) => message.role === "learner");
    if (!thread || !lastQuestion) return;
    const questionIndex = thread.messages.findIndex((message) => message.id === lastQuestion.id);
    const interruptedReply = thread.messages.slice(questionIndex + 1).findLast((message) => message.role === "tutor" && message.status === "stopped");
    startChatReply(id, lastQuestion.text, interruptedReply?.id);
  };
  const stopChat = (id: string) => {
    const job = chatJobs.current.get(id);
    if (!job) return;
    clearTimeout(job.timer);
    dispatch({ type: "chat-message", id, message: { id: job.id, role: "tutor", text: job.text.slice(0, job.offset), status: "stopped" } });
    dispatch({ type: "chat-error", id, value: "Response stopped. Your question is saved; retry to continue the sample response." });
    chatJobs.current.delete(id);
    setChatBusy((current) => ({ ...current, [id]: false }));
  };
  const branchChat = (parentThreadId: string, message: ChatMessage, quote: string) => {
    const workspaceId = chatWorkspace(state, parentThreadId);
    if (!workspaceId || message.role !== "tutor") return;
    dispatch({ type: "chat-branch", id: `chat-${crypto.randomUUID()}`, parentThreadId, workspaceId, sourceMessageId: message.id, quote });
  };
  const lastActiveChat = useRef(state.activeChatId);
  useEffect(() => {
    const previous = lastActiveChat.current;
    if (previous !== state.activeChatId || state.view !== "chats") {
      for (const id of [...chatJobs.current.keys()]) stopChat(id);
    }
    lastActiveChat.current = state.activeChatId;
  }, [state.activeChatId, state.view]);
  useEffect(() => () => { chatJobs.current.forEach((job) => clearTimeout(job.timer)); chatJobs.current.clear(); }, []);
  const goNext = () => {
    const index = lessons.findIndex((item) => item.id === state.topicId);
    if (index === lessons.length - 1) {
      navigate(state.mode === "learner" ? "my-learning" : "overview");
      return;
    }
    openTopic(lessons[index + 1].id);
  };

  return (
    <div className={`studio-shell ${state.preferences.readingSize === "large" ? "reading-large" : ""} ${state.preferences.reducedMotion ? "reduced-motion" : ""} flex h-dvh min-h-0 overflow-hidden bg-background text-foreground`}>
      {state.mode === "learner" && state.view !== "chats" && (
        <aside className="studio-nav fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-border-subtle bg-background px-3 py-4">
          <Brand />
          <div className="mb-2 px-2 text-2xs font-medium uppercase tracking-wider text-foreground-subtle">
            Learning
          </div>
          <nav aria-label="Main navigation" className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {navItem("chats", "Chats", <MessageSquare />)}
            {navItem("home", "Home", <Compass />)}
            {navItem("my-learning", "My learning", <BookOpen />)}
            {navItem("catalog", "Browse roadmaps", <Compass />)}
            {navItem("generator", "Create roadmap", <GraduationCap />)}
            {navItem("library", "Library", <Library />)}
            {navItem("settings", "Settings", <Settings />)}
            {(state.view === "lesson" ||
              state.view === "overview" ||
              state.view === "conversation") && (
              <RoadmapOutline roadmap={roadmap} topicId={state.topicId} completedIds={enrollment?.completedTopicIds ?? []} open={outlineOpen} onOpenChange={setOutlineOpen} onTopic={openTopic} onRoadmap={() => navigate("overview")} />
            )}
          </nav>
          <div className="mt-auto shrink-0 space-y-1 border-t border-border-subtle pt-3">
            <Appearance
              dark={effectiveDark}
              toggle={() => dispatch({ type: "preferences", value: { theme: effectiveDark ? "light" : "dark" } })}
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
              onClick={() => setResetOpen(true)}
            >
              <RotateCcw className="size-4" />
              Reset demo
            </Button>
          </div>
        </aside>
      )}
      <div
        className={`studio-main ${state.mode === "learner" && state.view !== "chats" ? "ml-60" : ""} flex h-dvh min-h-0 min-w-0 flex-1 flex-col`}
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
            {state.view === "lesson" && (small || state.mode === "guest") && <Button variant="ghost" size="iconSm" aria-label="Open course outline" onClick={() => { setOutlineOpen(true); setMobileOutlineOpen(true); }}><List className="size-4" /></Button>}
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
                    effectiveDark
                      ? "Switch to light appearance"
                      : "Switch to dark appearance"
                  }
                  onClick={() => dispatch({ type: "preferences", value: { theme: effectiveDark ? "light" : "dark" } })}
                >
                  {effectiveDark ? (
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
              <LearningLesson
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
                activity={key ? state.activity[key] : undefined}
                onActivityChange={(progress) => key && dispatch({ type: "activity", key, value: progress })}
                onEnablePractice={() => {
                  if (state.mode === "guest") gate({ type: "practice", roadmapId: state.roadmapId, topicId: state.topicId });
                  else dispatch({ type: "enable-practice", roadmapId: state.roadmapId, topicId: state.topicId });
                }}
              />
            )}
            {state.view === "home" && (
              <Home
                state={state}
                displayName={state.preferences.displayName}
                activeEnrollment={
                  enrollment ?? state.enrollments[state.enrollments.length - 1]
                }
                onResume={() => {
                  const chosen =
                    enrollment ??
                    state.enrollments[state.enrollments.length - 1];
                  if (!chosen) return navigate("catalog");
                  const id = resumeTopic(chosen, state.enrollmentId === chosen.id ? state.topicId : undefined);
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
                  const topicId = resumeTopic(enrollment, state.enrollmentId === id ? state.topicId : undefined);
                  dispatch({
                    type: "open-enrollment",
                    enrollmentId: id,
                    topicId,
                  });
                }}
                onBrowse={() => navigate("catalog")}
              />
            )}
            {state.view === "generator" && (
              <GeneratorFlow
                profile={state.generatorProfile}
                selectedTemplate={state.generatorTemplateId}
                onProfile={(field, value) =>
                  dispatch({ type: "generator-profile", field, value })
                }
                onTemplate={(id) =>
                  dispatch({ type: "generator-template", roadmapId: id })
                }
                onCreate={(profile, templateId, runId) => dispatch({ type: "generator-create", profile, templateId, runId })}
                scenario={state.scenario}
                onScenarioConsumed={() => dispatch({ type: "scenario", value: "normal" })}
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
                onShowCollection={() => navigate("my-learning")}
              />
            )}
            {state.view === "settings" && <SettingsView
              preferences={state.preferences}
              onChange={(value) => dispatch({ type: "preferences", value })}
              scenario={state.scenario}
              onScenarioChange={(value) => dispatch({ type: "scenario", value })}
              onExport={() => downloadExport(state)}
              onResetRequest={() => setResetOpen(true)}
              roadmapCount={state.enrollments.length}
              completedCount={state.enrollments.reduce((count, item) => count + item.completedTopicIds.length, 0)}
            />}
            {state.view === "conversation" && (
              <>
              <Conversation
                state={state}
                messages={messages}
                prompt={prompt}
                setPrompt={(value) => dispatch({ type: "set-draft", value })}
                send={send}
                busy={tutorBusy}
                onStop={stopTutor}
                onReturn={() => navigate("lesson")}
                onTopic={(topicId) =>
                  dispatch({ type: "conversation-topic", topicId })
                }
                quote={quote}
                clearQuote={() =>
                  dispatch({ type: "set-quote", value: undefined })
                }
                error={key ? state.tutorErrors[key] : undefined}
                onRetry={retryTutor}
              />
              </>
            )}
            {state.view === "chats" && <ChatsView state={state} small={small} onCreate={createChat} onOpen={openChat} onRename={(id, title) => dispatch({ type: "chat-rename", id, title })} onDraft={(id, value) => dispatch({ type: "chat-draft", id, value })} onSend={sendChat} onStop={stopChat} onRetry={retryChat} onBranch={branchChat} onHome={() => navigate("home")} onContinueTopic={(id) => { openChat(id); dispatch({ type: "navigate", view: "conversation" }); }} busyId={Object.keys(chatBusy).find((id) => chatBusy[id])} />}
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
                busy={tutorBusy}
                error={key ? state.tutorErrors[key] : undefined}
                onRetry={retryTutor}
                onStop={stopTutor}
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
        {(state.notice || (key && state.saveJobs[key])) && (
          <div
            role="status"
            className="fixed bottom-5 right-5 z-30 flex max-w-sm items-start gap-3 rounded-xl border border-border bg-surface p-4 text-sm shadow-lg"
          >
            <p>{key && state.saveJobs[key] === "error" ? "Progress could not be saved. Retry to mark this lesson complete." : key && state.saveJobs[key] === "pending" ? "Saving lesson progress…" : state.notice}</p>
            {key && state.saveJobs[key] === "error" && <Button size="sm" onClick={completion}>Retry save</Button>}
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
              busy={tutorBusy}
              error={key ? state.tutorErrors[key] : undefined}
              onRetry={retryTutor}
              onStop={stopTutor}
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
                  dark={effectiveDark}
                  toggle={() => dispatch({ type: "preferences", value: { theme: effectiveDark ? "light" : "dark" } })}
                />
              </>
            ) : (
              <>
                {navItem("chats", "Chats", <MessageSquare />)}
                {navItem("home", "Home", <Compass />)}
                {navItem("my-learning", "My learning", <BookOpen />)}
                {navItem("catalog", "Browse roadmaps", <Compass />)}
                {navItem("generator", "Create roadmap", <GraduationCap />)}
                {navItem("library", "Library", <Library />)}
                {navItem("settings", "Settings", <Settings />)}
              </>
            )}
          </nav>
          <div className="mt-auto shrink-0 space-y-1 border-t border-border-subtle p-3">
            <Appearance
              dark={effectiveDark}
              toggle={() => dispatch({ type: "preferences", value: { theme: effectiveDark ? "light" : "dark" } })}
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
                  onClick={() => setResetOpen(true)}
                >
                  <RotateCcw className="size-4" />
                  Reset demo
                </Button>
              </>
            )}
          </div>
        </Drawer>
        <Drawer
          isOpen={mobileOutlineOpen && state.view === "lesson"}
          onClose={() => setMobileOutlineOpen(false)}
          title="Course outline"
          description={roadmap.title}
          widthClassName="w-[320px]"
        >
          <div className="p-3">
            <RoadmapOutline roadmap={roadmap} topicId={state.topicId} completedIds={enrollment?.completedTopicIds ?? []} open={outlineOpen} onOpenChange={setOutlineOpen} onTopic={(id) => { openTopic(id); setMobileOutlineOpen(false); }} onRoadmap={() => { navigate("overview"); setMobileOutlineOpen(false); }} />
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
        <ConfirmDialog
          isOpen={resetOpen}
          onClose={() => setResetOpen(false)}
          onConfirm={() => { clearDemoStorage(readStorage()); reset(); }}
          title="Reset local demo?"
          description="This clears saved lessons, progress, preferences, and demo conversations from this browser."
          confirmText="Reset demo"
        />
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

function readStorage(): Storage | undefined {
  try { return typeof window === "undefined" ? undefined : window.localStorage; }
  catch { return undefined; }
}
function downloadExport(state: State) {
  try {
    const blob = new Blob([exportState(state)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "graphmind-demo-export.json";
    anchor.click();
    URL.revokeObjectURL(href);
  } catch {
    // Browser download APIs can be unavailable in embedded previews.
  }
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
    chats: "Chats",
    library: "Library",
    settings: "Settings",
  }[view];
}
