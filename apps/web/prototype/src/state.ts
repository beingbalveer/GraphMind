import { allLessons, findRoadmap, roadmaps, type Roadmap } from "./catalog";

export type Message = {
  id: number;
  role: "learner" | "tutor";
  text: string;
  quote?: string;
  status?: "streaming" | "complete" | "stopped";
};
export type Enrollment = {
  id: string;
  templateId: string;
  sourceSnapshotRef: string;
  title: string;
  completedTopicIds: string[];
  lastTopicId?: string;
  generation?: GeneratorProfile;
  generatedCopy?: boolean;
  generationRunId?: string;
};
export type DemoPreferences = {
  displayName: string;
  theme: "light" | "dark" | "system";
  readingSize: "standard" | "large";
  weeklyHours: number;
  reducedMotion: boolean;
  tutorStyle: "concise" | "step-by-step";
};
export type DemoScenario = "normal" | "generation-clarification" | "generation-error" | "tutor-error" | "save-error";
export type ActivityProgress = { draft: string; selectedAnswer?: string; attempts: number; submitted: boolean; correct?: boolean; feedback?: string };
export type GeneratorProfile = {
  title: string;
  prompt: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  background: string;
  outcome: string;
  hoursPerWeek: number;
  duration: number;
  referenceUrl: string;
};
export type PendingIntent =
  | { type: "save"; roadmapId: string }
  | { type: "tutor"; roadmapId: string; topicId: string; quote?: string }
  | { type: "complete"; roadmapId: string; topicId: string }
  | { type: "practice"; roadmapId: string; topicId: string }
  | { type: "generator" }
  | { type: "signin" };
export type View =
  | "catalog"
  | "overview"
  | "lesson"
  | "home"
  | "my-learning"
  | "generator"
  | "conversation"
  | "library"
  | "settings";
export type State = {
  mode: "guest" | "learner";
  view: View;
  roadmapId: string;
  topicId: string;
  enrollmentId?: string;
  enrollments: Enrollment[];
  conversations: Record<string, Message[]>;
  drafts: Record<string, string>;
  quotes: Record<string, string | undefined>;
  readingPositions: Record<string, number>;
  pendingIntent?: PendingIntent;
  authOpen: boolean;
  notice?: string;
  catalogQuery: string;
  catalogCategory: string;
  catalogLevel: string;
  generatorStep: "form" | "review" | "generating" | "result";
  generatorProfile: GeneratorProfile;
  generatorTemplateId: string;
  generatorJobId: number;
  dark: boolean;
  preferences: DemoPreferences;
  scenario: DemoScenario;
  activity: Record<string, ActivityProgress>;
  tutorErrors: Record<string, string>;
  saveJobs: Record<string, "pending" | "error">;
};

export const defaultPreferences: DemoPreferences = {
  displayName: "Alex Morgan", theme: "system", readingSize: "standard",
  weeklyHours: 4, reducedMotion: false, tutorStyle: "step-by-step",
};

export const blankProfile: GeneratorProfile = {
  title: "",
  prompt: "",
  level: "Beginner",
  background: "",
  outcome: "",
  hoursPerWeek: 4,
  duration: 6,
  referenceUrl: "",
};
export const initial: State = {
  mode: "guest",
  view: "catalog",
  roadmapId: roadmaps[0].id,
  topicId: allLessons(roadmaps[0])[0].id,
  enrollments: [],
  conversations: {},
  drafts: {},
  quotes: {},
  readingPositions: {},
  authOpen: false,
  catalogQuery: "",
  catalogCategory: "All topics",
  catalogLevel: "All levels",
  generatorStep: "form",
  generatorProfile: blankProfile,
  generatorTemplateId: roadmaps[0].id,
  generatorJobId: 0,
  dark: false,
  preferences: defaultPreferences,
  scenario: "normal",
  activity: {},
  tutorErrors: {},
  saveJobs: {},
};

export const scopedKey = (enrollmentId: string, topicId: string) =>
  `${enrollmentId}::${topicId}`;
export const currentRoadmap = (state: State) =>
  getRoadmap(state.roadmapId) ?? roadmaps[0];
export const currentLessons = (state: State) =>
  allLessons(currentRoadmap(state));
export { allLessons };
export type { Roadmap };
export const currentLesson = (state: State) =>
  currentLessons(state).find((item) => item.id === state.topicId) ??
  currentLessons(state)[0];
export const activeEnrollment = (state: State) =>
  state.enrollments.find((item) => item.id === state.enrollmentId);
export const currentEnrollment = (state: State) => {
  if (state.mode !== "learner") return undefined;
  const active = activeEnrollment(state);
  return active?.templateId === state.roadmapId ? active : undefined;
};
export const enrollmentFor = (state: State, roadmapId: string) =>
  state.enrollments.find(
    (item) => item.templateId === roadmapId && !item.generatedCopy,
  );
export const privateKey = (state: State) =>
  state.enrollmentId ? scopedKey(state.enrollmentId, state.topicId) : undefined;
export const visibleConversations = (state: State) => {
  if (state.mode !== "learner" || !state.enrollmentId) return {};
  const prefix = `${state.enrollmentId}::`;
  return Object.fromEntries(
    Object.entries(state.conversations).filter(([key]) =>
      key.startsWith(prefix),
    ),
  );
};
function resolvePrivateKey(state: State, key: string) {
  const divider = key.indexOf("::");
  if (divider < 1) return undefined;
  const enrollment = state.enrollments.find((item) => item.id === key.slice(0, divider));
  const topicId = key.slice(divider + 2);
  const roadmap = enrollment && findRoadmap(enrollment.templateId);
  return roadmap && allLessons(roadmap).some((lesson) => lesson.id === topicId) ? { enrollment, topicId } : undefined;
}

export type Action =
  | { type: "navigate"; view: View }
  | { type: "open-roadmap"; roadmapId: string; topicId?: string }
  | { type: "open-topic"; topicId: string }
  | { type: "conversation-topic"; topicId: string }
  | { type: "open-tutor"; roadmapId: string; topicId: string; quote?: string }
  | { type: "enable-practice"; roadmapId: string; topicId: string }
  | { type: "open-enrollment"; enrollmentId: string; topicId?: string }
  | { type: "gate"; intent: PendingIntent }
  | { type: "dismiss-auth" }
  | { type: "sign-in" }
  | { type: "sign-out" }
  | { type: "save-roadmap"; roadmapId: string }
  | {
      type: "complete-topic";
      roadmapId: string;
      topicId: string;
      enrollmentId?: string;
    }
  | { type: "set-quote"; value?: string }
  | { type: "set-draft"; value: string }
  | { type: "send-message"; message: Message }
  | { type: "tutor-upsert"; key: string; message: Message }
  | { type: "tutor-remove"; key: string; messageId: number }
  | { type: "reading-position"; key: string; value: number }
  | {
      type: "catalog-filter";
      field: "catalogQuery" | "catalogCategory" | "catalogLevel";
      value: string;
    }
  | {
      type: "generator-profile";
      field: keyof GeneratorProfile;
      value: string | number;
    }
  | { type: "generator-template"; roadmapId: string }
  | { type: "generator-step"; step: State["generatorStep"] }
  | { type: "generator-job"; jobId: number }
  | { type: "generator-complete"; jobId: number }
  | { type: "notice"; value?: string }
  | { type: "theme"; dark: boolean }
  | { type: "preferences"; value: Partial<DemoPreferences> }
  | { type: "scenario"; value: DemoScenario }
  | { type: "activity"; key: string; value: ActivityProgress }
  | { type: "save-start"; key: string }
  | { type: "save-fail"; key: string }
  | { type: "save-retry"; key: string }
  | { type: "save-finish"; key: string }
  | { type: "tutor-error"; key: string; value?: string }
  | { type: "generator-create"; runId: string; profile: GeneratorProfile; templateId: string }
  | { type: "reset" };

function createEnrollment(
  state: State,
  roadmapId: string,
  title?: string,
  generation?: GeneratorProfile,
) {
  if (!findRoadmap(roadmapId))
    return { enrollment: undefined, enrollments: state.enrollments };
  const existing = enrollmentFor(state, roadmapId);
  if (existing) return { enrollment: existing, enrollments: state.enrollments };
  const enrollment: Enrollment = {
    id: `demo-enrollment-${state.enrollments.length + 1}`,
    templateId: roadmapId,
    sourceSnapshotRef: `${roadmapId}@${findRoadmap(roadmapId)?.snapshotVersion ?? "unknown"}`,
    title: title ?? findRoadmap(roadmapId)?.title ?? "Learning path",
    completedTopicIds: [],
    generation,
  };
  return { enrollment, enrollments: [...state.enrollments, enrollment] };
}
function activateRoadmap(state: State, roadmapId: string, topicId?: string) {
  const roadmap = findRoadmap(roadmapId) ?? roadmaps[0];
  return {
    roadmapId: roadmap.id,
    topicId: topicId ?? allLessons(roadmap)[0].id,
  };
}
function complete(
  state: State,
  roadmapId: string,
  topicId: string,
  requestedEnrollmentId?: string,
) {
  const roadmap = findRoadmap(roadmapId);
  if (
    state.mode !== "learner" ||
    !roadmap ||
    !allLessons(roadmap).some((lesson) => lesson.id === topicId)
  )
    return state;
  let enrollments = state.enrollments;
  let enrollment = requestedEnrollmentId
    ? enrollments.find(
        (item) =>
          item.id === requestedEnrollmentId && item.templateId === roadmapId,
      )
    : activeEnrollment(state)?.templateId === roadmapId
      ? activeEnrollment(state)
      : enrollmentFor(state, roadmapId);
  if (!enrollment) {
    const created = createEnrollment(state, roadmapId);
    if (!created.enrollment) return state;
    enrollment = created.enrollment;
    enrollments = created.enrollments;
  }
  const completedTopicIds = enrollment.completedTopicIds.includes(topicId)
    ? enrollment.completedTopicIds
    : [...enrollment.completedTopicIds, topicId];
  return {
    ...state,
    enrollmentId: enrollment.id,
    enrollments: enrollments.map((item) =>
      item.id === enrollment.id ? { ...item, completedTopicIds } : item,
    ),
  };
}
function fulfillIntent(state: State, intent?: PendingIntent): State {
  if (!intent) return state;
  state = { ...state, pendingIntent: undefined };
  if (intent.type === "generator")
    return { ...state, view: "generator", generatorStep: "form" };
  if (intent.type === "signin") return { ...state, view: "home" };
  const { roadmapId } = intent;
  const { enrollment, enrollments } = createEnrollment(state, roadmapId);
  if (!enrollment) return state;
  if (
    intent.type !== "save" &&
    !allLessons(findRoadmap(roadmapId)!).some(
      (lesson) => lesson.id === intent.topicId,
    )
  )
    return state;
  const publicPositionKey = `public::${roadmapId}::${intent.type === "save" ? "" : intent.topicId}`;
  const learnerPositionKey =
    intent.type === "save" ? "" : scopedKey(enrollment.id, intent.topicId);
  const shouldTransferPosition =
    learnerPositionKey &&
    (state.mode === "guest" ||
      state.readingPositions[learnerPositionKey] === undefined);
  const readingPositions =
    learnerPositionKey &&
    shouldTransferPosition &&
    state.readingPositions[publicPositionKey] !== undefined
      ? {
          ...state.readingPositions,
          [learnerPositionKey]: state.readingPositions[publicPositionKey],
        }
      : state.readingPositions;
  let next: State = {
    ...state,
    readingPositions,
    ...activateRoadmap(
      state,
      roadmapId,
      intent.type === "save" ? undefined : intent.topicId,
    ),
    enrollmentId: enrollment.id,
    enrollments,
  };
  if (intent.type === "save")
    next = {
      ...next,
      view: "my-learning",
      notice: enrollmentFor(state, roadmapId)
        ? "This roadmap is already in My learning."
        : "Saved to My learning.",
    };
  if (intent.type === "tutor")
    next = {
      ...next,
      view: "lesson",
      quotes: {
        ...next.quotes,
        [scopedKey(enrollment.id, intent.topicId)]: intent.quote,
      },
    };
  if (intent.type === "practice")
    next = { ...next, view: "lesson", topicId: intent.topicId };
  return next;
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "navigate":
      return state.mode === "guest" &&
        !["catalog", "overview", "lesson"].includes(action.view)
        ? state
        : {
            ...state,
            view: action.view,
            authOpen: false,
            generatorStep:
              state.generatorStep === "generating" &&
              action.view !== "generator"
                ? "review"
                : state.generatorStep,
          };
    case "open-roadmap": {
      if (!findRoadmap(action.roadmapId)) return state;
      return {
        ...state,
        ...activateRoadmap(state, action.roadmapId, action.topicId),
        enrollmentId: undefined,
        view: action.topicId ? "lesson" : "overview",
        generatorStep:
          state.generatorStep === "generating" ? "review" : state.generatorStep,
      };
    }
    case "open-enrollment": {
      const enrollment = state.enrollments.find(
        (item) => item.id === action.enrollmentId,
      );
      if (!enrollment || state.mode !== "learner") return state;
      return {
        ...state,
        ...activateRoadmap(state, enrollment.templateId, action.topicId),
        enrollments: action.topicId && allLessons(findRoadmap(enrollment.templateId)!).some((lesson) => lesson.id === action.topicId)
          ? state.enrollments.map((item) => item.id === enrollment.id ? { ...item, lastTopicId: action.topicId } : item)
          : state.enrollments,
        enrollmentId: enrollment.id,
        view: action.topicId ? "lesson" : "overview",
        generatorStep:
          state.generatorStep === "generating" ? "review" : state.generatorStep,
      };
    }
    case "open-topic":
      return currentLessons(state).some((lesson) => lesson.id === action.topicId)
        ? { ...state, topicId: action.topicId, view: "lesson", ...(state.enrollmentId ? { enrollments: state.enrollments.map((item) => item.id === state.enrollmentId ? { ...item, lastTopicId: action.topicId } : item) } : {}) }
        : state;
    case "conversation-topic":
      return state.mode === "learner" &&
        currentLessons(state).some((lesson) => lesson.id === action.topicId)
        ? { ...state, topicId: action.topicId, view: "conversation", ...(state.enrollmentId ? { enrollments: state.enrollments.map((item) => item.id === state.enrollmentId ? { ...item, lastTopicId: action.topicId } : item) } : {}) }
        : state;
    case "open-tutor": {
      if (state.mode !== "learner") return state;
      const roadmap = findRoadmap(action.roadmapId);
      if (
        !roadmap ||
        !allLessons(roadmap).some((lesson) => lesson.id === action.topicId)
      )
        return state;
      const active = activeEnrollment(state);
      const existing =
        active?.templateId === roadmap.id
          ? active
          : enrollmentFor(state, roadmap.id);
      const created = existing
        ? { enrollment: existing, enrollments: state.enrollments }
        : createEnrollment(state, roadmap.id);
      if (!created.enrollment) return state;
      const contextKey = scopedKey(created.enrollment.id, action.topicId);
      const readingKey = `public::${roadmap.id}::${action.topicId}`;
      const shouldTransferPosition =
        !state.enrollmentId || state.readingPositions[contextKey] === undefined;
      const readingPositions =
        !shouldTransferPosition ||
        state.readingPositions[readingKey] === undefined
          ? state.readingPositions
          : {
              ...state.readingPositions,
              [contextKey]: state.readingPositions[readingKey],
            };
      return {
        ...state,
        ...activateRoadmap(state, roadmap.id, action.topicId),
        enrollmentId: created.enrollment.id,
        enrollments: created.enrollments.map((item) => item.id === created.enrollment!.id ? { ...item, lastTopicId: action.topicId } : item),
        readingPositions,
        quotes: { ...state.quotes, [contextKey]: action.quote },
        view: "lesson",
      };
    }
    case "enable-practice": {
      if (state.mode !== "learner") return state;
      const roadmap = findRoadmap(action.roadmapId);
      if (!roadmap || !allLessons(roadmap).some((item) => item.id === action.topicId)) return state;
      const existing = activeEnrollment(state)?.templateId === roadmap.id ? activeEnrollment(state) : enrollmentFor(state, roadmap.id);
      const created = existing ? { enrollment: existing, enrollments: state.enrollments } : createEnrollment(state, roadmap.id);
      return created.enrollment ? { ...state, ...activateRoadmap(state, roadmap.id, action.topicId), enrollmentId: created.enrollment.id, enrollments: created.enrollments.map((item) => item.id === created.enrollment!.id ? { ...item, lastTopicId: action.topicId } : item), view: "lesson" } : state;
    }
    case "gate":
      return state.mode === "guest"
        ? { ...state, pendingIntent: action.intent, authOpen: true }
        : state;
    case "dismiss-auth":
      return { ...state, pendingIntent: undefined, authOpen: false };
    case "sign-in":
      return fulfillIntent(
        { ...state, mode: "learner", authOpen: false },
        state.pendingIntent,
      );
    case "sign-out":
      return {
        ...state,
        mode: "guest",
        view: "catalog",
        enrollmentId: undefined,
        authOpen: false,
        pendingIntent: undefined,
        generatorStep: "form",
        saveJobs: {},
        notice: undefined,
      };
    case "save-roadmap": {
      if (state.mode !== "learner" || !findRoadmap(action.roadmapId))
        return state;
      const { enrollment, enrollments } = createEnrollment(
        state,
        action.roadmapId,
      );
      if (!enrollment) return state;
      return {
        ...state,
        enrollments,
        ...activateRoadmap(state, action.roadmapId),
        enrollmentId: enrollment.id,
        view: "my-learning",
        notice: enrollmentFor(state, action.roadmapId)
          ? "This roadmap is already in My learning."
          : "Saved to My learning.",
      };
    }
    case "complete-topic":
      return complete(
        state,
        action.roadmapId,
        action.topicId,
        action.enrollmentId,
      );
    case "set-quote": {
      if (state.mode !== "learner" || !state.enrollmentId) return state;
      const key = scopedKey(state.enrollmentId, state.topicId);
      return { ...state, quotes: { ...state.quotes, [key]: action.value } };
    }
    case "set-draft": {
      if (state.mode !== "learner" || !state.enrollmentId) return state;
      const key = scopedKey(state.enrollmentId, state.topicId);
      return { ...state, drafts: { ...state.drafts, [key]: action.value } };
    }
    case "send-message": {
      if (state.mode !== "learner" || !state.enrollmentId) return state;
      const key = scopedKey(state.enrollmentId, state.topicId);
      return {
        ...state,
        conversations: {
          ...state.conversations,
          [key]: [...(state.conversations[key] ?? []), action.message],
        },
        quotes: { ...state.quotes, [key]: undefined },
        drafts: { ...state.drafts, [key]: "" },
      };
    }
    case "tutor-upsert": {
      if (state.mode !== "learner") return state;
      const activeKey = state.enrollmentId ? scopedKey(state.enrollmentId, state.topicId) : undefined;
      if (!activeKey || activeKey !== action.key || !["lesson", "conversation"].includes(state.view)) return state;
      const messages = state.conversations[action.key] ?? [];
      const exists = messages.some((message) => message.id === action.message.id);
      return { ...state, conversations: { ...state.conversations, [action.key]: exists ? messages.map((message) => message.id === action.message.id ? action.message : message) : [...messages, action.message] } };
    }
    case "tutor-remove": {
      if (state.mode !== "learner" || !resolvePrivateKey(state, action.key)) return state;
      const messages = state.conversations[action.key] ?? [];
      const filtered = messages.filter((message) => message.id !== action.messageId);
      return filtered.length === messages.length ? state : { ...state, conversations: { ...state.conversations, [action.key]: filtered } };
    }
    case "reading-position":
      return {
        ...state,
        readingPositions: {
          ...state.readingPositions,
          [action.key]: action.value,
        },
      };
    case "catalog-filter":
      return { ...state, [action.field]: action.value };
    case "generator-profile":
      return state.mode === "learner" && state.view === "generator"
        ? {
            ...state,
            generatorProfile: {
              ...state.generatorProfile,
              [action.field]: action.value,
            },
          }
        : state;
    case "generator-template":
      return state.mode === "learner" && findRoadmap(action.roadmapId)
        ? { ...state, generatorTemplateId: action.roadmapId }
        : state;
    case "generator-step":
      if (state.mode !== "learner" || state.view !== "generator") return state;
      if (action.step === "generating" || action.step === "result")
        return state;
      return { ...state, generatorStep: action.step };
    case "generator-job":
      if (
        state.mode !== "learner" ||
        state.view !== "generator" ||
        state.generatorStep !== "review" ||
        !validGeneratorProfile(state.generatorProfile)
      )
        return state;
      return {
        ...state,
        generatorJobId: action.jobId,
        generatorStep: "generating",
      };
    case "generator-complete": {
      if (
        state.mode !== "learner" ||
        state.view !== "generator" ||
        state.generatorStep !== "generating" ||
        state.generatorJobId !== action.jobId ||
        !validGeneratorProfile(state.generatorProfile)
      )
        return state;
      const profile = state.generatorProfile;
      const template = findRoadmap(state.generatorTemplateId) ?? roadmaps[0];
      const enrollment: Enrollment = {
        id: `demo-enrollment-${state.enrollments.length + 1}`,
        templateId: template.id,
        sourceSnapshotRef: `${template.id}@${template.snapshotVersion}`,
        title: profile.title.trim() || profile.prompt.trim(),
        completedTopicIds: [],
        generation: profile,
        generatedCopy: true,
      };
      return {
        ...state,
        enrollments: [...state.enrollments, enrollment],
        roadmapId: template.id,
        enrollmentId: enrollment.id,
        topicId: allLessons(template)[0].id,
        view: "generator",
        generatorStep: "result",
        notice: "Demo copy added to My learning.",
      };
    }
    case "notice":
      return { ...state, notice: action.value };
    case "theme":
      return { ...state, dark: action.dark, preferences: { ...state.preferences, theme: action.dark ? "dark" : "light" } };
    case "preferences":
      {
        const patch = { ...action.value };
        if (patch.displayName !== undefined) patch.displayName = typeof patch.displayName === "string" ? patch.displayName.slice(0, 60) : state.preferences.displayName;
        if (patch.theme !== undefined && !["light", "dark", "system"].includes(patch.theme)) delete patch.theme;
        if (patch.readingSize !== undefined && !["standard", "large"].includes(patch.readingSize)) delete patch.readingSize;
        if (patch.weeklyHours !== undefined && (!Number.isInteger(patch.weeklyHours) || patch.weeklyHours < 1 || patch.weeklyHours > 40)) delete patch.weeklyHours;
        if (patch.tutorStyle !== undefined && !["concise", "step-by-step"].includes(patch.tutorStyle)) delete patch.tutorStyle;
        if (patch.reducedMotion !== undefined && typeof patch.reducedMotion !== "boolean") delete patch.reducedMotion;
        const preferences = { ...state.preferences, ...patch };
        return { ...state, preferences, generatorProfile: patch.weeklyHours === undefined ? state.generatorProfile : { ...state.generatorProfile, hoursPerWeek: patch.weeklyHours }, dark: preferences.theme === "dark" };
      }
    case "scenario":
      return { ...state, scenario: action.value };
    case "activity":
      if (state.mode !== "learner" || !state.enrollmentId || action.key !== scopedKey(state.enrollmentId, state.topicId) || !resolvePrivateKey(state, action.key)) return state;
      return { ...state, activity: { ...state.activity, [action.key]: action.value } };
    case "save-start":
      return state.mode === "learner" && resolvePrivateKey(state, action.key) && state.saveJobs[action.key] !== "pending" ? { ...state, saveJobs: { ...state.saveJobs, [action.key]: "pending" } } : state;
    case "save-fail":
      return state.mode === "learner" && resolvePrivateKey(state, action.key) && state.saveJobs[action.key] === "pending" ? { ...state, saveJobs: { ...state.saveJobs, [action.key]: "error" } } : state;
    case "save-retry":
      return state.mode === "learner" && resolvePrivateKey(state, action.key) && state.saveJobs[action.key] === "error" ? { ...state, saveJobs: { ...state.saveJobs, [action.key]: "pending" }, scenario: "normal" } : state;
    case "save-finish": {
      if (state.mode !== "learner" || state.saveJobs[action.key] !== "pending") return state;
      const target = resolvePrivateKey(state, action.key);
      if (!target) return state;
      const { [action.key]: _removed, ...saveJobs } = state.saveJobs;
      return { ...state, saveJobs, enrollments: state.enrollments.map((item) => item.id === target.enrollment.id ? { ...item, completedTopicIds: item.completedTopicIds.includes(target.topicId) ? item.completedTopicIds : [...item.completedTopicIds, target.topicId] } : item) };
    }
    case "tutor-error": {
      if (state.mode !== "learner" || !state.enrollmentId || !resolvePrivateKey(state, action.key)) return state;
      if (!action.value) { const { [action.key]: _removed, ...tutorErrors } = state.tutorErrors; return { ...state, tutorErrors }; }
      return { ...state, tutorErrors: { ...state.tutorErrors, [action.key]: action.value } };
    }
    case "generator-create": {
      if (state.mode !== "learner" || state.view !== "generator" || !validGeneratorProfile(action.profile)) return state;
      const existing = state.enrollments.find((item) => item.generationRunId === action.runId);
      if (existing) return { ...state, enrollmentId: existing.id, view: "generator", generatorStep: "result" };
      const template = findRoadmap(action.templateId);
      if (!template) return state;
      const enrollment: Enrollment = { id: `demo-generated-${action.runId}`, templateId: template.id, sourceSnapshotRef: `${template.id}@${template.snapshotVersion}`, title: action.profile.title.trim() || action.profile.prompt.trim(), completedTopicIds: [], generation: action.profile, generatedCopy: true, generationRunId: action.runId };
      return { ...state, enrollments: [...state.enrollments, enrollment], roadmapId: template.id, enrollmentId: enrollment.id, topicId: allLessons(template)[0].id, view: "generator", generatorStep: "result", notice: "Demo copy added to My learning." };
    }
    case "reset":
      return initial;
    default:
      return state;
  }
}

export function getRoadmap(id: string) {
  return findRoadmap(id);
}
export const allAvailableRoadmaps = () => roadmaps;
export function validGeneratorProfile(profile: GeneratorProfile) {
  return (
    profile.title.trim().length > 1 &&
    profile.prompt.trim().length > 9 &&
    profile.outcome.trim().length > 5 &&
    Number.isInteger(profile.hoursPerWeek) &&
    profile.hoursPerWeek >= 1 &&
    profile.hoursPerWeek <= 40 &&
    Number.isInteger(profile.duration) &&
    profile.duration >= 1 &&
    profile.duration <= 52 &&
    (!profile.referenceUrl || isHttpUrl(profile.referenceUrl))
  );
}
export function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}
