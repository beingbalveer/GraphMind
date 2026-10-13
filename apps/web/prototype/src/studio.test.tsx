import { describe, expect, it } from "vitest";
import { curriculum } from "./curriculum";
import { reducer } from "./state";

describe("learning studio local journey", () => {
  it("records learner completion separately from moving to the next lesson", () => {
    const completed = reducer(
      reducer(
        {
          view: "lesson",
          lesson: 0,
          completed: [],
          title: "Python",
          conversations: {},
        },
        { type: "complete" },
      ),
      { type: "lesson", index: 1 },
    );
    expect(completed.completed).toEqual([curriculum[0].id]);
    expect(completed.lesson).toBe(1);
    expect(completed.view).toBe("lesson");
    expect(completed.completed).not.toContain(curriculum[1].id);
  });

  it("keeps quoted tutor exchanges with their lesson when the learner changes topic", () => {
    const inFirst = reducer(
      {
        view: "lesson",
        lesson: 0,
        completed: [],
        title: "Python",
        conversations: {},
      },
      { type: "quote", value: "A function names one transformation." },
    );
    const asked = reducer(inFirst, {
      type: "message",
      topicId: curriculum[0].id,
      message: {
        id: 1,
        role: "learner",
        text: "Why name it?",
        quote: inFirst.quote,
      },
    });
    const moved = reducer(asked, { type: "lesson", index: 1 });
    const returned = reducer(moved, { type: "lesson", index: 0 });
    expect(returned.conversations[curriculum[0].id]?.[0].quote).toBe(
      "A function names one transformation.",
    );
    expect(returned.conversations[curriculum[1].id]).toBeUndefined();
  });

  it("reset clears only local sample progress and messages back to the fixed fixture", () => {
    const changed = reducer(
      {
        view: "lesson",
        lesson: 2,
        completed: [curriculum[0].id],
        title: "Custom label",
        conversations: {
          [curriculum[0].id]: [{ id: 2, role: "learner", text: "hello" }],
        },
      },
      { type: "reset" },
    );
    expect(changed.title).toBe("Python for backend developers");
    expect(changed.completed).toEqual([]);
    expect(changed.conversations).toEqual({});
    expect(changed.lesson).toBe(0);
  });
});
