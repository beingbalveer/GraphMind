import { allLessons, findRoadmap, roadmaps } from "./catalog";
import { initial, type ActivityProgress, type ChatMessage, type ChatThread, type DemoPreferences, type DemoScenario, type Enrollment, type GeneratorProfile, type Message, type State, type View } from "./state";
import type { CanvasLayout } from "@/lib/canvas/types";

const STORAGE_KEY = "graphmind-studio-v2";
const VERSION = 2;
const owns = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const str = (value: unknown, max = 4000): string | undefined => typeof value === "string" && value.length <= max ? value : undefined;
const record = (value: unknown): Record<string, unknown> => owns(value) ? value : {};
const safeProfile = (value: unknown): GeneratorProfile => {
  const source = record(value);
  const levels = ["Beginner", "Intermediate", "Advanced"] as const;
  return {
    title: str(source.title, 120) ?? initial.generatorProfile.title,
    prompt: str(source.prompt, 1200) ?? "",
    level: levels.includes(source.level as (typeof levels)[number]) ? source.level as GeneratorProfile["level"] : "Beginner",
    background: str(source.background, 1000) ?? "",
    outcome: str(source.outcome, 240) ?? "",
    hoursPerWeek: Number.isInteger(source.hoursPerWeek) && Number(source.hoursPerWeek) >= 1 && Number(source.hoursPerWeek) <= 40 ? Number(source.hoursPerWeek) : 4,
    duration: Number.isInteger(source.duration) && Number(source.duration) >= 1 && Number(source.duration) <= 52 ? Number(source.duration) : 6,
    referenceUrl: str(source.referenceUrl, 2048) ?? "",
  };
};
const safePreferences = (value: unknown): DemoPreferences => {
  const source = record(value);
  return {
    displayName: str(source.displayName, 60) ?? initial.preferences.displayName,
    theme: ["light", "dark", "system"].includes(String(source.theme)) ? source.theme as DemoPreferences["theme"] : initial.preferences.theme,
    readingSize: ["standard", "large"].includes(String(source.readingSize)) ? source.readingSize as DemoPreferences["readingSize"] : initial.preferences.readingSize,
    weeklyHours: Number.isInteger(source.weeklyHours) && Number(source.weeklyHours) >= 1 && Number(source.weeklyHours) <= 40 ? Number(source.weeklyHours) : initial.preferences.weeklyHours,
    reducedMotion: source.reducedMotion === true,
    tutorStyle: ["concise", "step-by-step"].includes(String(source.tutorStyle)) ? source.tutorStyle as DemoPreferences["tutorStyle"] : initial.preferences.tutorStyle,
  };
};
const safeMessage = (value: unknown): Message | undefined => {
  if (!owns(value) || !Number.isSafeInteger(value.id) || Number(value.id) < 0 || !["learner", "tutor"].includes(String(value.role))) return undefined;
  const text = str(value.text, 4000);
  if (text === undefined) return undefined;
  const message: Message = { id: Number(value.id), role: value.role as Message["role"], text, ...(str(value.quote, 1000) ? { quote: str(value.quote, 1000) } : {}) };
  if (message.role === "tutor" && ["streaming", "complete", "stopped"].includes(String(value.status))) {
    message.status = value.status === "streaming" ? "stopped" : value.status as Message["status"];
  }
  return message;
};
function sanitizeEnrollments(value: unknown): Enrollment[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  return value.filter(owns).flatMap((item) => {
    const id = str(item.id, 120), templateId = str(item.templateId, 120), roadmap = templateId ? findRoadmap(templateId) : undefined;
    if (!id || !/^[\w-]{1,120}$/.test(id) || ids.has(id) || !roadmap || item.sourceSnapshotRef !== `${roadmap.id}@${roadmap.snapshotVersion}`) return [];
    ids.add(id);
    const validTopics = new Set(allLessons(roadmap).map((lesson) => lesson.id));
    const completedTopicIds = Array.isArray(item.completedTopicIds) ? [...new Set(item.completedTopicIds.filter((topic): topic is string => typeof topic === "string" && validTopics.has(topic)))] : [];
    const enrollment: Enrollment = { id, templateId: roadmap.id, sourceSnapshotRef: `${roadmap.id}@${roadmap.snapshotVersion}`, title: str(item.title, 200) ?? roadmap.title, completedTopicIds };
    if (typeof item.lastTopicId === "string" && validTopics.has(item.lastTopicId)) enrollment.lastTopicId = item.lastTopicId;
    if (item.generatedCopy === true) enrollment.generatedCopy = true;
    if (item.generatedCopy === true && typeof item.generationRunId === "string" && /^[\w-]{1,120}$/.test(item.generationRunId)) enrollment.generationRunId = item.generationRunId;
    if (owns(item.generation)) enrollment.generation = safeProfile(item.generation);
    return [enrollment];
  });
}
function sanitizeScopedRecord<T>(value: unknown, enrollments: Enrollment[], convert: (value: unknown) => T | undefined): Record<string, T> {
  const result: Record<string, T> = {};
  for (const [key, raw] of Object.entries(record(value))) {
    const separator = key.indexOf("::");
    if (separator < 1) continue;
    const enrollment = enrollments.find((item) => item.id === key.slice(0, separator));
    const topicId = key.slice(separator + 2);
    if (!enrollment || !allLessons(findRoadmap(enrollment.templateId)!).some((lesson) => lesson.id === topicId)) continue;
    const safe = convert(raw);
    if (safe !== undefined) result[key] = safe;
  }
  return result;
}
function safeChatMessage(value: unknown): ChatMessage | undefined {
  if (!owns(value) || typeof value.id !== "string" || value.id.length > 120 || !["learner", "tutor"].includes(String(value.role))) return undefined;
  const text = str(value.text, 4000);
  if (text === undefined) return undefined;
  const message: ChatMessage = { id: value.id, role: value.role as ChatMessage["role"], text };
  if (value.role === "tutor" && ["streaming", "complete", "stopped"].includes(String(value.status))) message.status = value.status === "streaming" ? "stopped" : value.status as ChatMessage["status"];
  return message;
}
function sanitizeChats(value: unknown, enrollments: Enrollment[], conversations: Record<string, Message[]>): ChatThread[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  const candidates = value.flatMap((raw): ChatThread[] => {
    if (!owns(raw) || typeof raw.id !== "string" || !/^[\w:-]{1,160}$/.test(raw.id) || ids.has(raw.id)) return [];
    const workspaceId = str(raw.workspaceId, 120);
    if (!workspaceId || (workspaceId !== "personal-workspace" && !enrollments.some((item) => item.id === workspaceId))) return [];
    if (raw.kind !== "general" && raw.kind !== "branch") return [];
    const messages = Array.isArray(raw.messages) ? raw.messages.map(safeChatMessage).filter((item): item is ChatMessage => Boolean(item)) : [];
    const title = str(raw.title, 120)?.trim();
    const quote = str(raw.quote, 1000);
    const thread: ChatThread = { id: raw.id, workspaceId, title: title || "New chat", kind: raw.kind, messages, draft: str(raw.draft, 4000) ?? "", updatedAt: Number.isFinite(raw.updatedAt) && Number(raw.updatedAt) >= 0 ? Number(raw.updatedAt) : 0 };
    const parentThreadId = str(raw.parentThreadId, 160);
    const sourceMessageId = str(raw.sourceMessageId, 120);
    if (raw.topicId !== undefined) {
      const topicId = str(raw.topicId, 120);
      const enrollment = enrollments.find((item) => item.id === workspaceId);
      if (!topicId || !enrollment || !allLessons(findRoadmap(enrollment.templateId)!).some((lesson) => lesson.id === topicId)) return [];
      thread.topicId = topicId;
    }
    if (raw.kind === "branch") {
      if (!parentThreadId || !sourceMessageId || !quote?.trim()) return [];
      thread.parentThreadId = parentThreadId; thread.sourceMessageId = sourceMessageId; thread.quote = quote;
    } else if (parentThreadId || sourceMessageId || quote !== undefined) return [];
    ids.add(raw.id);
    return [thread];
  });
  const byId = new Map(candidates.map((item) => [item.id, item]));
  const valid = new Map<string, ChatThread>();
  const rejected = new Set<string>();
  const resolving = new Set<string>();
  const resolve = (id: string): ChatThread | undefined => {
    if (valid.has(id)) return valid.get(id);
    if (rejected.has(id) || resolving.has(id)) { rejected.add(id); return undefined; }
    const item = byId.get(id);
    if (!item) return undefined;
    resolving.add(id);
    if (item.kind === "branch") {
      const parentId = item.parentThreadId!;
      let parentWorkspace: string | undefined;
      let parentTopicId: string | undefined;
      let parentMessages: { id: string | number; role: string; text: string; status?: string }[] = [];
      if (parentId.startsWith("topic:")) {
        try { const key = decodeURIComponent(parentId.slice(6)); const divider = key.indexOf("::"); parentWorkspace = divider > 0 ? key.slice(0, divider) : undefined; parentTopicId = divider > 0 ? key.slice(divider + 2) : undefined; parentMessages = (conversations[key] ?? []).map((message) => ({ id: message.id, role: message.role, text: message.text, status: message.status })); } catch { parentWorkspace = undefined; }
      } else {
        const parent = resolve(parentId);
        parentWorkspace = parent?.workspaceId;
        parentTopicId = parent?.topicId;
        parentMessages = parent?.messages ?? [];
      }
      if (parentWorkspace !== item.workspaceId || (item.topicId !== undefined && item.topicId !== parentTopicId) || !parentMessages.some((message) => String(message.id) === item.sourceMessageId && message.role === "tutor" && message.status !== "streaming" && Boolean(message.text.trim()) && message.text.includes(item.quote!))) {
        resolving.delete(id); rejected.add(id); return undefined;
      }
      if (parentTopicId) item.topicId = parentTopicId;
    }
    resolving.delete(id); valid.set(id, item); return item;
  };
  candidates.forEach((item) => resolve(item.id));
  return candidates.filter((item) => valid.has(item.id));
}

/** Reads only the versioned demo state and drops unsafe transient state. */
export function restoreState(storage: Storage | undefined): State {
  if (!storage) return initial;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return initial;
    const envelope: unknown = JSON.parse(raw);
    if (!owns(envelope) || envelope.version !== VERSION || !owns(envelope.state)) return initial;
    const saved = record(envelope.state);
    const mode = saved.mode === "learner" ? "learner" : "guest";
    const enrollments = sanitizeEnrollments(saved.enrollments);
    const preferences = safePreferences(saved.preferences);
    const conversations = sanitizeScopedRecord(saved.conversations, enrollments, (items) => Array.isArray(items) ? items.map(safeMessage).filter((item): item is Message => Boolean(item)) : undefined);
    const chats = sanitizeChats(saved.chats, enrollments, conversations);
    const chatErrors: Record<string, string> = {};
    for (const [id, message] of Object.entries(record(saved.chatErrors))) if (chats.some((thread) => thread.id === id) && typeof message === "string" && message.length <= 1000) chatErrors[id] = message;
    for (const thread of chats) {
      const lastMessage = thread.messages[thread.messages.length - 1];
      if ((lastMessage?.role === "learner" || lastMessage?.status === "stopped") && !chatErrors[thread.id]) chatErrors[thread.id] = "The response was interrupted when this preview was refreshed. Your question is saved; retry to continue the sample response.";
    }
    const drafts = sanitizeScopedRecord(saved.drafts, enrollments, (value) => str(value, 4000));
    const quotes = sanitizeScopedRecord(saved.quotes, enrollments, (value) => value === undefined ? undefined : str(value, 1000));
    const readingPositions: Record<string, number> = {};
    for (const [key, value] of Object.entries(record(saved.readingPositions))) {
      if (key.startsWith("public::")) {
        const [, roadmapId, topicId] = key.split("::");
        const roadmap = findRoadmap(roadmapId);
        if (key.split("::").length === 3 && roadmap && allLessons(roadmap).some((lesson) => lesson.id === topicId) && Number.isFinite(value) && Number(value) >= 0 && Number(value) <= 10_000_000) readingPositions[key] = Number(value);
      } else if (Number.isFinite(value) && Number(value) >= 0 && Number(value) <= 10_000_000) {
        const scoped = sanitizeScopedRecord({ [key]: value }, enrollments, (position) => typeof position === "number" && Number.isFinite(position) && position >= 0 ? position : undefined);
        Object.assign(readingPositions, scoped);
      }
    }
    const activity = sanitizeScopedRecord(saved.activity, enrollments, (value) => {
      if (!owns(value) || !Number.isInteger(value.attempts) || Number(value.attempts) < 0 || Number(value.attempts) > 1000 || typeof value.draft !== "string" || value.draft.length > 2000 || typeof value.submitted !== "boolean") return undefined;
      const progress: ActivityProgress = { draft: value.draft, attempts: Number(value.attempts), submitted: value.submitted };
      if (typeof value.selectedAnswer === "string" && value.selectedAnswer.length <= 200) progress.selectedAnswer = value.selectedAnswer;
      if (typeof value.correct === "boolean") progress.correct = value.correct;
      if (typeof value.feedback === "string" && value.feedback.length <= 1000) progress.feedback = value.feedback;
      return progress;
    });
    const requestedRoadmapId = str(saved.roadmapId, 120);
    const roadmap = requestedRoadmapId ? findRoadmap(requestedRoadmapId) : undefined;
    let roadmapId = roadmap?.id ?? initial.roadmapId;
    const validTopics = allLessons(findRoadmap(roadmapId)!);
    let enrollmentId = mode === "learner" && typeof saved.enrollmentId === "string" && enrollments.some((item) => item.id === saved.enrollmentId && item.templateId === roadmapId) ? saved.enrollmentId : undefined;
    const savedTopicIsValid = typeof saved.topicId === "string" && validTopics.some((lesson) => lesson.id === saved.topicId);
    let topicId = savedTopicIsValid ? saved.topicId as string : validTopics[0].id;
    let view = (typeof saved.view === "string" && ["catalog", "overview", "lesson", "home", "my-learning", "generator", "conversation", "chats", "library", "settings"].includes(saved.view) ? saved.view : "catalog") as View;
    if (mode === "guest" && !["catalog", "overview", "lesson"].includes(view)) view = "catalog";
    if (view === "conversation" && (!enrollmentId || mode !== "learner")) view = "lesson";
    let activeChatId = typeof saved.activeChatId === "string" && (chats.some((thread) => thread.id === saved.activeChatId) || (() => { try { return saved.activeChatId.startsWith("topic:") && Boolean(conversations[decodeURIComponent(saved.activeChatId.slice(6))]); } catch { return false; } })()) ? saved.activeChatId : undefined;
    if (mode !== "learner" && view === "chats") view = "catalog";
    if (view === "chats" && !activeChatId && !chats.length && !Object.keys(conversations).length) view = "home";
    if (view === "lesson" && !savedTopicIsValid) view = "catalog";
    if (view === "catalog" || view === "home" || view === "my-learning" || view === "settings") enrollmentId = undefined;
    const scopeCandidate = str(saved.courseScopeId, 140);
    let courseScopeId = scopeCandidate && scopeCandidate.startsWith("public:") && findRoadmap(scopeCandidate.slice(7)) ? scopeCandidate : scopeCandidate && mode === "learner" && enrollments.some((item) => item.id === scopeCandidate) ? scopeCandidate : undefined;
    if (!courseScopeId && mode === "learner" && enrollmentId && ["overview", "lesson", "conversation", "chats", "settings"].includes(view)) courseScopeId = enrollmentId;
    if (!courseScopeId && mode === "guest" && ["overview", "lesson"].includes(view)) courseScopeId = `public:${roadmapId}`;
    if (view === "chats" && activeChatId) {
      const activeThread = chats.find((thread) => thread.id === activeChatId);
      let workspaceId = activeThread?.workspaceId;
      if (!workspaceId && activeChatId.startsWith("topic:")) { try { workspaceId = decodeURIComponent(activeChatId.slice(6)).split("::", 1)[0]; } catch { workspaceId = undefined; } }
      if (courseScopeId && workspaceId !== courseScopeId) activeChatId = undefined;
      else if (!courseScopeId && workspaceId && workspaceId !== "personal-workspace" && enrollments.some((item) => item.id === workspaceId)) courseScopeId = workspaceId;
    }
    if (!["overview", "lesson", "conversation", "chats", "settings"].includes(view)) courseScopeId = undefined;
    if (courseScopeId?.startsWith("public:") && ["overview", "lesson"].includes(view)) {
      roadmapId = courseScopeId.slice(7);
      const publicLessons = allLessons(findRoadmap(roadmapId)!);
      if (!publicLessons.some((lesson) => lesson.id === topicId)) topicId = publicLessons[0].id;
      enrollmentId = undefined;
    } else if (courseScopeId && !courseScopeId.startsWith("public:")) {
      const scopedEnrollment = enrollments.find((item) => item.id === courseScopeId);
      if (scopedEnrollment) {
        roadmapId = scopedEnrollment.templateId;
        const scopedLessons = allLessons(findRoadmap(roadmapId)!);
        if (!scopedLessons.some((lesson) => lesson.id === topicId)) topicId = scopedLessons[0].id;
        if (mode === "learner" && ["overview", "lesson", "conversation", "chats", "settings"].includes(view)) enrollmentId = scopedEnrollment.id;
        if (activeChatId && view === "chats") {
          const activeThread = chats.find((thread) => thread.id === activeChatId);
          if (activeThread && activeThread.workspaceId !== scopedEnrollment.id) activeChatId = undefined;
        }
      } else courseScopeId = undefined;
    }
    if (activeChatId && courseScopeId && !courseScopeId.startsWith("public:")) {
      const activeThread = chats.find((thread) => thread.id === activeChatId);
      let activeWorkspace = activeThread?.workspaceId;
      if (!activeWorkspace && activeChatId.startsWith("topic:")) { try { activeWorkspace = decodeURIComponent(activeChatId.slice(6)).split("::", 1)[0]; } catch { activeWorkspace = undefined; } }
      if (activeWorkspace !== courseScopeId) activeChatId = undefined;
    }
    const validCourseScopes = new Set([...enrollments.map((item) => item.id), ...roadmaps.map((roadmap) => `public:${roadmap.id}`)]);
    const courseLayouts: Record<string, CanvasLayout> = {};
    for (const [scopeId, value] of Object.entries(record(saved.courseLayouts))) {
      if (!validCourseScopes.has(scopeId) || !owns(value) || value.version !== "spine-v1" || !owns(value.positions)) continue;
      const positions: CanvasLayout["positions"] = {};
      for (const [id, point] of Object.entries(value.positions).slice(0, 1500)) if (owns(point) && Number.isFinite(point.x) && Number.isFinite(point.y) && Math.abs(Number(point.x)) <= 1_000_000 && Math.abs(Number(point.y)) <= 1_000_000) positions[id] = { x: Number(point.x), y: Number(point.y) };
      const viewport = owns(value.viewport) && Number.isFinite(value.viewport.x) && Number.isFinite(value.viewport.y) && Number.isFinite(value.viewport.zoom) && Number(value.viewport.zoom) > 0 && Number(value.viewport.zoom) <= 4 ? { x: Number(value.viewport.x), y: Number(value.viewport.y), zoom: Number(value.viewport.zoom) } : null;
      courseLayouts[scopeId] = { version: "spine-v1", positions, viewport, topologyKey: str(value.topologyKey, 4000) ?? "" };
    }
    const courseViewModes: Record<string, "list" | "canvas"> = {};
    for (const [scopeId, value] of Object.entries(record(saved.courseViewModes))) if (validCourseScopes.has(scopeId) && (value === "list" || value === "canvas")) courseViewModes[scopeId] = value;
    const catalogField = (key: string, max: number, fallback: string) => str(saved[key], max) ?? fallback;
    const scenarioValues: DemoScenario[] = ["normal", "generation-clarification", "generation-error", "tutor-error", "save-error"];
    const tutorErrors = sanitizeScopedRecord(saved.tutorErrors, enrollments, (value) => str(value, 1000));
    for (const [key, items] of Object.entries(conversations)) {
      if (items.some((message) => message.role === "tutor" && message.status === "stopped") && !tutorErrors[key]) {
        tutorErrors[key] = "A response was interrupted when this preview was refreshed. Your question is saved; retry to continue the sample response.";
      }
    }
    const generatorTemplateId = str(saved.generatorTemplateId, 120) && findRoadmap(String(saved.generatorTemplateId)) ? String(saved.generatorTemplateId) : initial.generatorTemplateId;
    return {
      ...initial, mode, view, roadmapId, topicId, enrollmentId, courseScopeId, courseLayouts, courseViewModes, enrollments, conversations, chats, activeChatId, chatErrors, drafts, quotes, readingPositions, activity, tutorErrors, saveJobs: {},
      catalogQuery: catalogField("catalogQuery", 200, ""), catalogCategory: catalogField("catalogCategory", 100, "All topics"), catalogLevel: catalogField("catalogLevel", 80, "All levels"),
      generatorProfile: safeProfile(saved.generatorProfile), generatorTemplateId, generatorStep: saved.generatorStep === "result" ? "result" : "form", generatorJobId: Number.isSafeInteger(saved.generatorJobId) && Number(saved.generatorJobId) >= 0 ? Number(saved.generatorJobId) : 0,
      preferences, dark: preferences.theme === "dark", scenario: scenarioValues.includes(saved.scenario as DemoScenario) ? saved.scenario as DemoScenario : "normal", notice: str(saved.notice, 240), authOpen: false, pendingIntent: undefined,
    };
  } catch {
    return initial;
  }
}

export function persistState(storage: Storage | undefined, state: State): boolean {
  if (!storage) return false;
  try {
    const safe: State = { ...state, authOpen: false, pendingIntent: undefined, generatorStep: state.generatorStep === "generating" ? "review" : state.generatorStep, saveJobs: {} };
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, state: safe }));
    return true;
  } catch {
    return false;
  }
}

export function clearDemoStorage(storage: Storage | undefined): void {
  if (!storage) return;
  try {
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter((key): key is string => Boolean(key) && key!.startsWith("graphmind-studio-"));
    keys.forEach((key) => storage.removeItem(key));
  } catch {
    // Restricted storage must not prevent a local reset.
  }
}

export function exportState(state: State): string {
  const safe = { ...state, authOpen: false, pendingIntent: undefined, generatorStep: state.generatorStep === "generating" ? "review" : state.generatorStep, saveJobs: {}, tutorErrors: {} };
  return JSON.stringify({ version: VERSION, exportedAt: new Date().toISOString(), state: safe }, null, 2);
}
