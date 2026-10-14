import { describe, expect, it } from "vitest";
import { allLessons, roadmaps } from "./catalog";
import { getActivity } from "./activity-catalog";

describe("sample learning content", () => {
  it("keeps the original Python lesson IDs and expands the pathway to twelve lessons", () => {
    const lessons = allLessons(roadmaps.find((roadmap) => roadmap.id === "roadmap-python-backend")!);
    expect(lessons).toHaveLength(12);
    expect(lessons.slice(0, 4).map((lesson) => lesson.id)).toEqual(["py-01", "py-02", "py-03", "py-04"]);
    expect(lessons.reduce((minutes, lesson) => minutes + lesson.duration, 0)).toBe(218);
    expect(roadmaps[0].duration).toBe("About 3.5 hours");
    const firstLessonWords = lessons[0].paragraphs.flatMap(([, body]) => body.split(/\s+/)).length;
    expect(firstLessonWords).toBeGreaterThanOrEqual(800);
  });

  it("provides a topic-specific, grounded check for every catalog lesson", () => {
    for (const roadmap of roadmaps) {
      for (const lesson of allLessons(roadmap)) {
        const activity = getActivity(lesson.id);
        expect(activity.prompt, lesson.id).not.toContain("In one sentence");
        expect(activity.explanation.length, lesson.id).toBeGreaterThan(20);
      }
    }
  });
});
