import { describe, expect, it } from "vitest";
import { allLessons, roadmaps } from "./catalog";
import {
  currentEnrollment,
  initial,
  reducer,
  scopedKey,
  visibleConversations,
} from "./state";

describe("guest and learner state boundaries", () => {
  it("offers three substantive public roadmaps without requiring sign-in", () => {
    expect(roadmaps).toHaveLength(3);
    expect(roadmaps.every((roadmap) => allLessons(roadmap).length >= 3)).toBe(
      true,
    );
    expect(initial.view).toBe("catalog");
    expect(initial.authOpen).toBe(false);
  });

  it("does not allow guest completion or private messages through reducer actions", () => {
    const guest = {
      ...initial,
      view: "lesson" as const,
      roadmapId: roadmaps[0].id,
      topicId: allLessons(roadmaps[0])[0].id,
    };
    expect(
      reducer(guest, {
        type: "complete-topic",
        roadmapId: guest.roadmapId,
        topicId: guest.topicId,
      }),
    ).toBe(guest);
    expect(
      reducer(guest, {
        type: "send-message",
        message: { id: 1, role: "learner", text: "hello" },
      }),
    ).toBe(guest);
    expect(reducer(guest, { type: "set-draft", value: "private draft" })).toBe(
      guest,
    );
  });

  it("keeps gate cancellation on the public reading context, then saves once on demo sign-in", () => {
    const publicLesson = {
      ...initial,
      view: "lesson" as const,
      roadmapId: roadmaps[1].id,
      topicId: allLessons(roadmaps[1])[1].id,
    };
    const gated = reducer(publicLesson, {
      type: "gate",
      intent: { type: "save", roadmapId: roadmaps[1].id },
    });
    expect(reducer(gated, { type: "dismiss-auth" })).toMatchObject({
      view: "lesson",
      mode: "guest",
      roadmapId: roadmaps[1].id,
      topicId: allLessons(roadmaps[1])[1].id,
    });
    const learner = reducer(gated, { type: "sign-in" });
    expect(learner).toMatchObject({
      mode: "learner",
      view: "my-learning",
      roadmapId: roadmaps[1].id,
    });
    expect(learner.enrollments).toHaveLength(1);
    const duplicate = reducer(learner, {
      type: "save-roadmap",
      roadmapId: roadmaps[1].id,
    });
    expect(duplicate.enrollments).toHaveLength(1);
  });

  it("isolates progress, drafts, quotes, and conversations by enrollment and topic", () => {
    let state = reducer(initial, { type: "sign-in" });
    state = reducer(state, { type: "save-roadmap", roadmapId: roadmaps[0].id });
    const enrollment = state.enrollmentId!;
    state = reducer(state, { type: "set-draft", value: "first draft" });
    state = reducer(state, { type: "set-quote", value: "a passage" });
    state = reducer(state, {
      type: "send-message",
      message: {
        id: 1,
        role: "learner",
        text: "question",
        quote: state.quotes[scopedKey(enrollment, state.topicId)],
      },
    });
    state = reducer(state, { type: "open-roadmap", roadmapId: roadmaps[1].id });
    state = reducer(state, { type: "save-roadmap", roadmapId: roadmaps[1].id });
    expect(state.enrollments).toHaveLength(2);
    expect(visibleConversations(state)).toEqual({});
    state = reducer(state, { type: "sign-out" });
    expect(visibleConversations(state)).toEqual({});
  });

  it("resumes the last unfinished topic after sign-out and sign-in while retaining its draft", () => {
    let state = reducer(initial, { type: "sign-in" });
    state = reducer(state, { type: "save-roadmap", roadmapId: "roadmap-python-backend" });
    const enrollmentId = state.enrollmentId!;
    state = reducer(state, { type: "open-topic", topicId: "py-02" });
    state = reducer(state, { type: "set-draft", value: "I want to revisit runtime validation." });
    state = reducer(state, { type: "sign-out" });
    state = reducer(state, { type: "sign-in" });

    const enrollment = state.enrollments.find((item) => item.id === enrollmentId)!;
    expect(enrollment.lastTopicId).toBe("py-02");
    expect(state.drafts[scopedKey(enrollmentId, "py-02")]).toBe("I want to revisit runtime validation.");
    state = reducer(state, { type: "open-enrollment", enrollmentId, topicId: enrollment.lastTopicId });
    expect(state).toMatchObject({ view: "lesson", enrollmentId, topicId: "py-02" });
  });

  it("adds a generated personal copy only after a valid demo job completes", () => {
    let state = reducer(initial, { type: "sign-in" });
    state = reducer(state, { type: "navigate", view: "generator" });
    const profile = {
      title: "Build a weather API",
      prompt: "Learn how to build a small weather API",
      level: "Beginner" as const,
      background: "Some Python",
      outcome: "Deploy an API with a clear health endpoint",
      hoursPerWeek: 3,
      duration: 5,
      referenceUrl: "",
    };
    for (const [field, value] of Object.entries(profile) as [
      keyof typeof profile,
      string | number,
    ][])
      state = reducer(state, { type: "generator-profile", field, value });
    state = reducer(state, { type: "generator-step", step: "review" });
    state = reducer(state, { type: "generator-job", jobId: 3 });
    const cancelled = reducer(
      { ...state, generatorStep: "review" as const },
      { type: "generator-complete", jobId: 3 },
    );
    expect(cancelled.enrollments).toHaveLength(0);
    const done = reducer(state, { type: "generator-complete", jobId: 3 });
    expect(done.enrollments).toHaveLength(1);
    expect(done.enrollments[0].title).toBe(profile.title);
    expect(done.enrollments[0].templateId).toBe(roadmaps[0].id);
    expect(done.view).toBe("generator");
    expect(done.enrollments[0].generation).toMatchObject({
      hoursPerWeek: 3,
      duration: 5,
    });
  });
});

it("transfers public reading position and quoted intent into a private topic on sign-in", () => {
  const topicId = allLessons(roadmaps[0])[0].id;
  const publicState = {
    ...initial,
    view: "lesson" as const,
    roadmapId: roadmaps[0].id,
    topicId,
    readingPositions: { [`public::${roadmaps[0].id}::${topicId}`]: 84 },
  };
  const gated = reducer(publicState, {
    type: "gate",
    intent: {
      type: "tutor",
      roadmapId: roadmaps[0].id,
      topicId,
      quote: "A Python program is a sequence.",
    },
  });
  const learner = reducer(gated, { type: "sign-in" });
  const enrollmentId = learner.enrollmentId!;
  expect(learner.view).toBe("lesson");
  expect(learner.readingPositions[scopedKey(enrollmentId, topicId)]).toBe(84);
  expect(learner.quotes[scopedKey(enrollmentId, topicId)]).toBe(
    "A Python program is a sequence.",
  );
});

it("isolates generated and saved copies that share the same source topic IDs", () => {
  let state = reducer(initial, { type: "sign-in" });
  state = reducer(state, { type: "navigate", view: "generator" });
  const profile = {
    title: "API practice",
    prompt: "Learn to build one small API",
    level: "Beginner" as const,
    background: "Python basics",
    outcome: "Write and test an endpoint",
    hoursPerWeek: 2,
    duration: 4,
    referenceUrl: "",
  };
  for (const [field, value] of Object.entries(profile) as [
    keyof typeof profile,
    string | number,
  ][])
    state = reducer(state, { type: "generator-profile", field, value });
  state = reducer(state, { type: "generator-step", step: "review" });
  state = reducer(state, { type: "generator-job", jobId: 8 });
  state = reducer(state, { type: "generator-complete", jobId: 8 });
  const generatedId = state.enrollmentId!;
  state = reducer(state, { type: "save-roadmap", roadmapId: roadmaps[0].id });
  const generatedTopic = allLessons(roadmaps[0])[0].id;
  state = reducer(state, { type: "complete-topic", roadmapId: roadmaps[0].id, topicId: generatedTopic, enrollmentId: generatedId });
  state = reducer(state, { type: "save-roadmap", roadmapId: roadmaps[0].id });
  const savedId = state.enrollmentId!;
  const sharedTopic = allLessons(roadmaps[0])[0].id;
  expect(generatedId).not.toBe(savedId);
  expect(scopedKey(generatedId, sharedTopic)).not.toBe(
    scopedKey(savedId, sharedTopic),
  );
  expect(
    state.enrollments.find((item) => item.id === generatedId)
      ?.sourceSnapshotRef,
  ).toBe(`${roadmaps[0].id}@${roadmaps[0].snapshotVersion}`);
  expect(state.enrollments.find((item) => item.id === generatedId)?.completedTopicIds).toEqual([sharedTopic]);
  expect(state.enrollments.find((item) => item.id === savedId)?.completedTopicIds).toEqual([]);
  expect(roadmaps[0].title).toBe("Python foundations for backend work");
});

it("cancels generator publication when navigation leaves the generator and rejects invalid URLs", () => {
  let state = reducer(initial, { type: "sign-in" });
  state = reducer(state, { type: "navigate", view: "generator" });
  state = reducer(state, {
    type: "generator-profile",
    field: "title",
    value: "A valid roadmap",
  });
  state = reducer(state, {
    type: "generator-profile",
    field: "prompt",
    value: "Learn backend request handling",
  });
  state = reducer(state, {
    type: "generator-profile",
    field: "outcome",
    value: "Build and test a service",
  });
  state = reducer(state, {
    type: "generator-profile",
    field: "referenceUrl",
    value: "https://",
  });
  state = reducer(state, { type: "generator-step", step: "review" });
  expect(
    reducer(state, { type: "generator-job", jobId: 1 }).generatorStep,
  ).toBe("review");
  state = reducer(state, {
    type: "generator-profile",
    field: "referenceUrl",
    value: "",
  });
  state = reducer(state, { type: "generator-job", jobId: 2 });
  state = reducer(state, { type: "navigate", view: "home" });
  expect(state.generatorStep).toBe("review");
  expect(
    reducer(state, { type: "generator-complete", jobId: 2 }).enrollments,
  ).toHaveLength(0);
});

it("does not expose a private enrollment or conversation selector after sign-out", () => {
  let learner = reducer(initial, { type: "sign-in" });
  learner = reducer(learner, {
    type: "save-roadmap",
    roadmapId: roadmaps[0].id,
  });
  const topicId = allLessons(roadmaps[0])[0].id;
  learner = reducer(learner, {
    type: "send-message",
    message: { id: 44, role: "learner", text: "private" },
  });
  const guest = reducer(learner, { type: "sign-out" });
  expect(currentEnrollment(guest)).toBeUndefined();
  expect(visibleConversations(guest)).toEqual({});
  expect(guest.view).toBe("catalog");
  expect(guest.notice).toBeUndefined();
  expect(guest.enrollments[0].completedTopicIds).toEqual([]);
  expect(scopedKey(guest.enrollments[0].id, topicId)).toContain(
    guest.enrollments[0].id,
  );
});

it("resumes a generated copy by enrollment identity, independent of its source template", () => {
  let state = reducer(initial, { type: "sign-in" });
  state = reducer(state, { type: "navigate", view: "generator" });
  const profile = {
    title: "Generated Python copy",
    prompt: "Learn practical Python for APIs",
    level: "Beginner" as const,
    background: "Variables and functions",
    outcome: "Write a small endpoint",
    hoursPerWeek: 2,
    duration: 3,
    referenceUrl: "",
  };
  for (const [field, value] of Object.entries(profile) as [
    keyof typeof profile,
    string | number,
  ][])
    state = reducer(state, { type: "generator-profile", field, value });
  state = reducer(state, { type: "generator-step", step: "review" });
  state = reducer(state, { type: "generator-job", jobId: 9 });
  state = reducer(state, { type: "generator-complete", jobId: 9 });
  const generated = state.enrollments[0];
  const topicId = allLessons(roadmaps[0])[1].id;
  state = reducer(state, {
    type: "complete-topic",
    roadmapId: roadmaps[0].id,
    topicId,
    enrollmentId: generated.id,
  });
  state = reducer(state, {
    type: "open-enrollment",
    enrollmentId: generated.id,
    topicId,
  });
  expect(state.enrollmentId).toBe(generated.id);
  expect(currentEnrollment(state)?.title).toBe("Generated Python copy");
  expect(currentEnrollment(state)?.completedTopicIds).toEqual([topicId]);
});
