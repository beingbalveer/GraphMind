import { describe, expect, it } from "vitest";
import { allLessons, roadmaps } from "./catalog";
import { clearDemoStorage, persistState, restoreState } from "./persistence";
import { initial, reducer, scopedKey, type State } from "./state";

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

describe("versioned demo persistence", () => {
  it("keeps nested branches attached to the validated source message across refresh", () => {
    const storage = new MemoryStorage();
    let state = reducer(initial, { type: "sign-in" });
    state = reducer(state, { type: "chat-create", id: "chat-root", workspaceId: "personal-workspace" });
    state = reducer(state, { type: "chat-message", id: "chat-root", message: { id: "reply-1", role: "tutor", text: "A useful first explanation", status: "complete" } });
    state = reducer(state, { type: "chat-branch", id: "chat-child", parentThreadId: "chat-root", workspaceId: "personal-workspace", sourceMessageId: "reply-1", quote: "first explanation" });
    state = reducer(state, { type: "chat-message", id: "chat-child", message: { id: "reply-2", role: "tutor", text: "A deeper detail", status: "complete" } });
    state = reducer(state, { type: "chat-branch", id: "chat-grandchild", parentThreadId: "chat-child", workspaceId: "personal-workspace", sourceMessageId: "reply-2", quote: "deeper detail" });
    expect(state.chats.map((chat) => chat.id)).toEqual(["chat-grandchild", "chat-child", "chat-root"]);
    expect(persistState(storage, state)).toBe(true);
    const restored = restoreState(storage);
    expect(restored.chats.map((chat) => chat.id)).toEqual(["chat-grandchild", "chat-child", "chat-root"]);
    expect(restored.chats[0]).toMatchObject({ parentThreadId: "chat-child", sourceMessageId: "reply-2", quote: "deeper detail" });
  });

  it("rejects stale, cross-workspace, and non-tutor branch origins", () => {
    let state = reducer(initial, { type: "sign-in" });
    state = reducer(state, { type: "chat-create", id: "chat-root", workspaceId: "personal-workspace" });
    const stale = reducer(state, { type: "chat-branch", id: "stale", parentThreadId: "chat-root", workspaceId: "personal-workspace", sourceMessageId: "missing", quote: "missing source" });
    const mismatch = reducer(state, { type: "chat-branch", id: "mismatch", parentThreadId: "chat-root", workspaceId: "another-workspace", sourceMessageId: "missing", quote: "source" });
    expect(stale.chats).toHaveLength(1);
    expect(mismatch.chats).toHaveLength(1);
    state = reducer(state, { type: "chat-message", id: "chat-root", message: { id: "question", role: "learner", text: "Question" } });
    expect(reducer(state, { type: "chat-branch", id: "learner-origin", parentThreadId: "chat-root", workspaceId: "personal-workspace", sourceMessageId: "question", quote: "Question" }).chats).toHaveLength(1);
  });

  it("recovers an interrupted chat stream and ignores late output after sign-out", () => {
    const storage = new MemoryStorage();
    let state = reducer(initial, { type: "sign-in" });
    state = reducer(state, { type: "chat-create", id: "chat-root", workspaceId: "personal-workspace" });
    state = reducer(state, { type: "chat-message", id: "chat-root", message: { id: "question", role: "learner", text: "Explain labels" } });
    state = reducer(state, { type: "chat-message", id: "chat-root", message: { id: "answer", role: "tutor", text: "A label is", status: "streaming" } });
    expect(persistState(storage, state)).toBe(true);
    const restored = restoreState(storage);
    expect(restored.chats[0].messages[1]).toMatchObject({ status: "stopped", text: "A label is" });
    expect(restored.chatErrors["chat-root"]).toMatch(/interrupted.*retry/i);
    const signedOut = reducer(state, { type: "sign-out" });
    expect(reducer(signedOut, { type: "chat-message", id: "chat-root", message: { id: "late", role: "tutor", text: "Late response" } })).toBe(signedOut);
  });

  it("reuses a stopped reply on retry, keeping one tutor bubble and existing branch origins", () => {
    const storage = new MemoryStorage();
    let state = reducer(initial, { type: "sign-in" });
    state = reducer(state, { type: "chat-create", id: "chat-root", workspaceId: "personal-workspace" });
    state = reducer(state, { type: "chat-message", id: "chat-root", message: { id: "question", role: "learner", text: "Explain labels", status: "complete" } });
    state = reducer(state, { type: "chat-message", id: "chat-root", message: { id: "answer-stopped", role: "tutor", text: "Let’s explore Explain labels.", status: "stopped" } });
    state = reducer(state, { type: "chat-branch", id: "chat-branch", parentThreadId: "chat-root", workspaceId: "personal-workspace", sourceMessageId: "answer-stopped", quote: "Explain labels" });
    state = reducer(state, { type: "chat-error", id: "chat-root", value: "Response stopped; retry is available." });
    state = reducer(state, { type: "chat-error", id: "chat-root" });
    state = reducer(state, { type: "chat-message", id: "chat-root", message: { id: "answer-stopped", role: "tutor", text: "Let’s explore Explain labels. Start with the simplest useful model.", status: "complete" } });
    persistState(storage, state);
    const restored = restoreState(storage);
    expect(restored.chatErrors["chat-root"]).toBeUndefined();
    const restoredRoot = restored.chats.find((chat) => chat.id === "chat-root")!;
    expect(restoredRoot.messages.filter((message) => message.role === "tutor")).toHaveLength(1);
    expect(restoredRoot.messages.at(-1)).toMatchObject({ id: "answer-stopped", status: "complete", text: expect.stringContaining("Explain labels") });
    expect(restored.chats.find((chat) => chat.id === "chat-branch")).toMatchObject({ sourceMessageId: "answer-stopped", quote: "Explain labels" });
  });

  it("restores safe learner work while dropping auth intent and in-flight jobs", () => {
    const storage = new MemoryStorage();
    const topicId = allLessons(roadmaps[0])[1].id;
    let state = reducer(initial, { type: "sign-in" });
    state = reducer(state, { type: "enable-practice", roadmapId: roadmaps[0].id, topicId });
    const key = scopedKey(state.enrollmentId!, topicId);
    state = { ...state, view: "lesson", drafts: { [key]: "A saved question" }, authOpen: true, pendingIntent: { type: "practice", roadmapId: roadmaps[0].id, topicId }, generatorStep: "generating", saveJobs: { [key]: "pending" } };
    expect(persistState(storage, state)).toBe(true);
    const restored = restoreState(storage);
    expect(restored).toMatchObject({ mode: "learner", view: "lesson", topicId, authOpen: false, pendingIntent: undefined, generatorStep: "form", saveJobs: {}, drafts: { [key]: "A saved question" } });
  });

  it("keeps a signed-in learner's valid public reading context without inventing an enrollment", () => {
    const storage = new MemoryStorage();
    const topicId = allLessons(roadmaps[1])[2].id;
    persistState(storage, { ...initial, mode: "learner", view: "lesson", roadmapId: roadmaps[1].id, topicId });
    expect(restoreState(storage)).toMatchObject({ mode: "learner", view: "lesson", roadmapId: roadmaps[1].id, topicId, enrollmentId: undefined, enrollments: [] });
  });

  it("restores one coherent course scope and drops an active chat from another enrollment", () => {
    const storage = new MemoryStorage();
    let state = reducer(initial, { type: "sign-in" });
    state = reducer(state, { type: "save-roadmap", roadmapId: roadmaps[0].id });
    const firstEnrollment = state.enrollmentId!;
    state = reducer(state, { type: "save-roadmap", roadmapId: roadmaps[1].id });
    const secondEnrollment = state.enrollmentId!;
    state = reducer(state, { type: "open-enrollment", enrollmentId: secondEnrollment, topicId: allLessons(roadmaps[1])[1].id });
    state = reducer(state, { type: "course-chat-create", id: "course-b-chat" });
    state = { ...state, courseScopeId: firstEnrollment, roadmapId: roadmaps[1].id, topicId: allLessons(roadmaps[1])[1].id, view: "lesson" };
    persistState(storage, state);
    const restored = restoreState(storage);
    expect(restored).toMatchObject({ courseScopeId: firstEnrollment, roadmapId: roadmaps[0].id, topicId: allLessons(roadmaps[0])[0].id, enrollmentId: firstEnrollment, activeChatId: undefined });
  });

  it("resumes the same public course topic when a guest signs in", () => {
    const storage = new MemoryStorage();
    const topicId = allLessons(roadmaps[2])[1].id;
    let state: State = { ...initial, view: "lesson", roadmapId: roadmaps[2].id, topicId, courseScopeId: `public:${roadmaps[2].id}` };
    state = reducer(state, { type: "gate", intent: { type: "signin", roadmapId: roadmaps[2].id, topicId } });
    state = reducer(state, { type: "sign-in" });
    persistState(storage, state);
    expect(restoreState(storage)).toMatchObject({ mode: "learner", view: "lesson", roadmapId: roadmaps[2].id, topicId, courseScopeId: state.enrollmentId, enrollmentId: state.enrollmentId });
  });

  it("restores an interrupted tutor stream as stopped and retryable with its question intact", () => {
    const storage = new MemoryStorage();
    const topicId = allLessons(roadmaps[0])[0].id;
    let state = reducer(initial, { type: "sign-in" });
    state = reducer(state, { type: "enable-practice", roadmapId: roadmaps[0].id, topicId });
    const key = scopedKey(state.enrollmentId!, topicId);
    state = { ...state, view: "conversation", conversations: { [key]: [
      { id: 41, role: "learner", text: "Why does this return a new value?" },
      { id: 42, role: "tutor", text: "A function returns", status: "streaming" },
    ] } };
    persistState(storage, state);
    const restored = restoreState(storage);
    expect(restored.conversations[key]).toEqual([
      { id: 41, role: "learner", text: "Why does this return a new value?" },
      { id: 42, role: "tutor", text: "A function returns", status: "stopped" },
    ]);
    expect(restored.tutorErrors[key]).toMatch(/refreshed.*retry/i);
  });

  it("drops copies whose saved source snapshot no longer matches the published curriculum", () => {
    const storage = new MemoryStorage();
    let state = reducer(initial, { type: "sign-in" });
    state = reducer(state, { type: "save-roadmap", roadmapId: roadmaps[0].id });
    state = { ...state, enrollments: state.enrollments.map((item) => ({ ...item, sourceSnapshotRef: `${roadmaps[0].id}@stale` })) };
    persistState(storage, state);
    expect(restoreState(storage).enrollments).toEqual([]);
  });

  it("falls back safely for malformed JSON and sanitizes structurally wrong records", () => {
    const storage = new MemoryStorage();
    storage.setItem("graphmind-studio-v2", "not json");
    expect(restoreState(storage)).toEqual(initial);
    storage.setItem("graphmind-studio-v2", JSON.stringify({ version: 2, state: { mode: "learner", view: "lesson", roadmapId: roadmaps[0].id, topicId: "not-a-topic", enrollmentId: "missing", enrollments: {}, conversations: null, drafts: "bad", quotes: [], readingPositions: { "bad::key": "far" }, preferences: { theme: "neon", weeklyHours: 900 }, tutorErrors: "leak", activity: [] } }));
    const restored = restoreState(storage);
    expect(restored.mode).toBe("learner");
    expect(restored.view).toBe("catalog");
    expect(restored.topicId).toBe(allLessons(roadmaps[0])[0].id);
    expect(restored.enrollments).toEqual([]);
    expect(restored.conversations).toEqual({});
    expect(restored.drafts).toEqual({});
    expect(restored.readingPositions).toEqual({});
    expect(restored.preferences).toEqual(initial.preferences);
  });

  it("clears only GraphMind-owned browser keys", () => {
    const storage = new MemoryStorage();
    storage.setItem("graphmind-studio-v2", "demo");
    storage.setItem("graphmind-studio-v1", "old demo");
    storage.setItem("unrelated-app", "keep");
    clearDemoStorage(storage);
    expect(storage.getItem("graphmind-studio-v2")).toBeNull();
    expect(storage.getItem("graphmind-studio-v1")).toBeNull();
    expect(storage.getItem("unrelated-app")).toBe("keep");
  });
});

describe("private progress and action guards", () => {
  const topicId = allLessons(roadmaps[0])[0].id;
  it("gates guest practice then enables the same topic after demo sign-in", () => {
    const guest = { ...initial, view: "lesson" as const, roadmapId: roadmaps[0].id, topicId };
    const pending = reducer(guest, { type: "gate", intent: { type: "practice", roadmapId: guest.roadmapId, topicId } });
    const learner = reducer(pending, { type: "sign-in" });
    expect(learner).toMatchObject({ mode: "learner", view: "lesson", topicId });
    expect(learner.enrollmentId).toBeTruthy();
  });

  it("requires a valid learner-owned pending save before completion mutates progress", () => {
    const key = "unknown::py-01";
    expect(reducer(initial, { type: "save-finish", key })).toBe(initial);
    let learner = reducer(initial, { type: "sign-in" });
    learner = reducer(learner, { type: "enable-practice", roadmapId: roadmaps[0].id, topicId });
    const validKey = scopedKey(learner.enrollmentId!, topicId);
    const invalid = reducer(learner, { type: "save-start", key: "unknown::py-01" });
    expect(invalid).toBe(learner);
    learner = reducer(learner, { type: "save-start", key: validKey });
    learner = reducer(learner, { type: "save-fail", key: validKey });
    expect(learner.enrollments[0].completedTopicIds).toEqual([]);
    learner = reducer(learner, { type: "save-retry", key: validKey });
    learner = reducer(learner, { type: "save-finish", key: validKey });
    expect(learner.enrollments[0].completedTopicIds).toEqual([topicId]);
  });

  it("creates one generated copy per successful run and rejects a late callback", () => {
    let learner = reducer(initial, { type: "sign-in" });
    learner = reducer(learner, { type: "navigate", view: "generator" });
    const profile = { ...initial.generatorProfile, title: "API Basics", prompt: "Learn to build a small API", outcome: "Ship a working endpoint" };
    const action = { type: "generator-create" as const, runId: "run-1", profile, templateId: roadmaps[0].id };
    learner = reducer(learner, action);
    learner = reducer(learner, action);
    expect(learner.enrollments).toHaveLength(1);
    const elsewhere = reducer(learner, { type: "navigate", view: "home" });
    expect(reducer(elsewhere, { ...action, runId: "run-2" }).enrollments).toHaveLength(1);
  });
});
