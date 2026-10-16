/**
 * @/lib/publicCurriculum.ts — Read-only projection of a public snapshot
 * (LSI-030).
 *
 * The guest course/List/Canvas surfaces reuse the existing curriculum canvas and
 * outline affordances, which are typed against `CurriculumView`. This module
 * projects the frozen public DTO into that shape *without inventing private
 * identity*: `canWrite` is always `false`, the private workspace/anchor ids are
 * empty (so the canvas never touches the protected layout API), progress is
 * empty, and every phase/topic keeps the stable public id from the snapshot so
 * List and Canvas address the same topics.
 */

import type {
  PublicRoadmapDetail,
  PublicSourceReference,
  PublicTopicSummary,
} from "./publicSnapshotApi";
import type {
  CurriculumItemData,
  CurriculumRelationData,
  CurriculumView,
  SourceData,
} from "./roadmapTypes";

/** Deterministic container id for the snapshot root; never a private id. */
export const PUBLIC_ROOT_PREFIX = "pub-root";

export interface PublicTopicEntry {
  topic: PublicTopicSummary;
  phaseId: string;
  phaseTitle: string;
  /** Zero-based position in the whole-roadmap reading order. */
  index: number;
}

/** Whole-roadmap topic reading order (phase order, then topic order). */
export function publicTopicSequence(
  detail: PublicRoadmapDetail,
): PublicTopicEntry[] {
  const entries: PublicTopicEntry[] = [];
  for (const phase of [...detail.phases].sort((a, b) => a.order - b.order)) {
    for (const topic of [...phase.topics].sort((a, b) => a.order - b.order)) {
      entries.push({
        topic,
        phaseId: phase.id,
        phaseTitle: phase.title,
        index: entries.length,
      });
    }
  }
  return entries;
}

function toSourceData(source: PublicSourceReference): SourceData {
  return {
    id: source.id,
    title: source.title,
    url: source.url,
    referenceId: null,
    locator: source.locator,
    verifiedAt: "",
    status: "grounded",
    access: "free",
    kind: source.kind,
    evidence: "",
    provenance: {},
  };
}

/**
 * Project a public roadmap snapshot into a read-only `CurriculumView`.
 *
 * A synthetic `root` item groups the ordered phases (the canvas projects a
 * spine from the root), and prerequisite edges between public topics are
 * preserved so the canvas shows the same dependencies the snapshot was
 * validated with.
 */
export function projectPublicRoadmap(
  detail: PublicRoadmapDetail,
): CurriculumView {
  const rootId = `${PUBLIC_ROOT_PREFIX}:${detail.slug}`;
  const items: CurriculumItemData[] = [
    {
      id: rootId,
      kind: "root",
      title: detail.title,
      brief: detail.summary,
      objectives: [],
      exercise: null,
      format: null,
      order: 0,
      path: "core",
      estimateMinutes: null,
      participation: "active",
    },
  ];
  const relations: CurriculumRelationData[] = [];
  const topics: PublicTopicSummary[] = [];

  for (const phase of [...detail.phases].sort((a, b) => a.order - b.order)) {
    items.push({
      id: phase.id,
      kind: "phase",
      title: phase.title,
      brief: "",
      objectives: [],
      exercise: null,
      format: null,
      order: phase.order,
      path: "core",
      estimateMinutes: null,
      participation: "active",
    });
    relations.push({ sourceId: rootId, targetId: phase.id, kind: "contains" });

    for (const topic of [...phase.topics].sort((a, b) => a.order - b.order)) {
      topics.push(topic);
      items.push({
        id: topic.id,
        kind: "topic",
        title: topic.title,
        brief: topic.brief,
        objectives: [],
        exercise: null,
        format: null,
        order: topic.order,
        path: topic.path,
        estimateMinutes: topic.estimateMinutes,
        participation: "active",
      });
      relations.push({
        sourceId: phase.id,
        targetId: topic.id,
        kind: "contains",
      });
    }
  }

  const topicIds = new Set(topics.map((topic) => topic.id));
  for (const topic of topics) {
    for (const prerequisiteId of topic.prerequisites) {
      if (topicIds.has(prerequisiteId)) {
        relations.push({
          sourceId: prerequisiteId,
          targetId: topic.id,
          kind: "prerequisite",
        });
      }
    }
  }

  const coreMinutes = topics
    .filter((topic) => topic.path === "core")
    .reduce((total, topic) => total + (topic.estimateMinutes ?? 0), 0);

  return {
    roadmapId: detail.id,
    // No private identity crosses into a guest projection.
    workspaceId: "",
    canWrite: false,
    canvasAnchorChatId: "",
    revisionId: detail.snapshotVersion,
    profile: {
      title: detail.title,
      prompt: detail.summary,
      level: detail.level,
      background: null,
      duration: null,
      hoursPerWeek: null,
      studyWeeks: null,
      weeklyMinutes: null,
      outcome: detail.outcomes.join(" "),
      assumptions: detail.prerequisites,
      knownSkills: [],
    },
    candidate: {
      title: detail.title,
      outcome: detail.outcomes.join(" "),
      assumptions: detail.prerequisites,
      items,
      relations,
      choices: [],
      sessions: [],
      resources: [],
    },
    sources: detail.sources.map(toSourceData),
    progress: {},
    validation: {
      valid: true,
      issues: [],
      coreMinutes,
      capacityMinutes: null,
    },
    origins: [],
  };
}
