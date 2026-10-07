import type { CurriculumView, CurriculumItemData } from "@/lib/roadmapTypes";
export function curriculumFixture(): CurriculumView {
  const item = (
    id: string,
    kind: CurriculumItemData["kind"],
    order: number,
    path: "core" | "further" = "core",
  ): CurriculumItemData => ({
    id,
    kind,
    order,
    path,
    title: id,
    brief: `Learn ${id}`,
    objectives: [`Explain ${id}`],
    exercise: "Practice",
    format: "concepts",
    estimateMinutes: kind === "topic" ? 60 : null,
    participation: "active",
  });
  const items = [
    item("root", "root", 0),
    item("phase1", "phase", 0),
    item("phase2", "phase", 1),
    item("group", "group", 0),
    item("topic1", "topic", 0),
    item("choice", "choice", 1),
    item("chosen", "topic", 0),
    item("other", "topic", 1),
    item("topic2", "topic", 0),
    item("further", "group", 2, "further"),
    item("extra", "topic", 0, "further"),
  ];
  const contains = (sourceId: string, targetId: string) => ({
    sourceId,
    targetId,
    kind: "contains" as const,
  });
  return {
    roadmapId: "roadmap",
    workspaceId: "ws",
    canvasAnchorChatId: "anchor",
    revisionId: "revision",
    profile: {
      title: "Drawing",
      prompt: "Learn drawing",
      level: "beginner",
      background: null,
      duration: null,
      hoursPerWeek: null,
      studyWeeks: null,
      weeklyMinutes: null,
      outcome: "Draw from observation",
      assumptions: [],
      knownSkills: [],
    },
    candidate: {
      title: "Drawing",
      outcome: "Draw from observation",
      assumptions: [],
      items,
      relations: [
        contains("root", "phase1"),
        contains("root", "phase2"),
        contains("phase1", "group"),
        contains("group", "topic1"),
        contains("phase1", "choice"),
        contains("choice", "chosen"),
        contains("choice", "other"),
        contains("phase2", "topic2"),
        contains("root", "further"),
        contains("further", "extra"),
        { sourceId: "topic1", targetId: "topic2", kind: "prerequisite" },
      ],
      choices: [
        {
          choiceId: "choice",
          selectedId: "chosen",
          rationale: "Fits your goal",
        },
      ],
      sessions: [],
      resources: [],
    },
    sources: [],
    progress: {
      topic1: {
        topicId: "topic1",
        status: "completed",
        completedAt: "2026-10-08T00:00:00Z",
      },
    },
    validation: {
      valid: true,
      issues: [],
      coreMinutes: 180,
      capacityMinutes: null,
    },
  };
}
