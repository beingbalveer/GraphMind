import { describe, expect, it } from "vitest";
import { allLessons, roadmaps } from "./catalog";
import { clearDemoStorage, persistState, restoreState } from "./persistence";
import { initial, reducer, scopedKey } from "./state";

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
