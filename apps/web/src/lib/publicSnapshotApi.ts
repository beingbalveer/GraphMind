/**
 * @/lib/publicSnapshotApi.ts — Anonymous public roadmap/lesson reads (LSI-030).
 *
 * Reads the frozen LSI-027 public boundary: `GET /api/v1/public/roadmaps/{slug}`
 * and `GET /api/v1/public/roadmaps/{slug}/topics/{topicSlug}`. Both endpoints are
 * anonymous, served from immutable published snapshots, and return stable public
 * ids (`pub_topic_…` / `pub_src_…`) that never map back to private identity.
 *
 * Missing, stale, superseded, and unpublished content all collapse to the same
 * neutral `404`; callers treat any `404` as an honest "not available" state.
 */

import { apiFetch } from "./apiClient";
import type { PublicRoadmapLevel } from "./publicCatalogApi";

export interface PublicSourceReference {
  id: string;
  title: string;
  url: string | null;
  locator: string | null;
  kind: string;
}

export interface PublicTopicSummary {
  id: string;
  slug: string;
  title: string;
  brief: string;
  order: number;
  path: "core" | "further";
  estimateMinutes: number | null;
  prerequisites: string[];
}

export interface PublicPhaseDetail {
  id: string;
  title: string;
  order: number;
  topics: PublicTopicSummary[];
}

export interface PublicRoadmapDetail {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  level: PublicRoadmapLevel;
  snapshotVersion: string;
  outcomes: string[];
  prerequisites: string[];
  phases: PublicPhaseDetail[];
  sources: PublicSourceReference[];
}

export type PublicLessonFormat = "concepts" | "practice" | "project";

export interface PublicLessonDetail {
  templateId: string;
  snapshotVersion: string;
  topicId: string;
  topicSlug: string;
  title: string;
  brief: string;
  objectives: string[];
  contentMarkdown: string | null;
  exercise: string | null;
  format: PublicLessonFormat | null;
  estimateMinutes: number | null;
  sources: PublicSourceReference[];
}

const publicRoadmapPath = (slug: string) =>
  `/public/roadmaps/${encodeURIComponent(slug)}`;

/** Read the newest (or a pinned) published snapshot of one public roadmap. */
export function readPublicRoadmap(
  slug: string,
  signal?: AbortSignal,
): Promise<PublicRoadmapDetail> {
  return apiFetch<PublicRoadmapDetail>(publicRoadmapPath(slug), { signal });
}

/** Read one authored lesson body. `topicSlug` also resolves the public topic id. */
export function readPublicLesson(
  slug: string,
  topicSlug: string,
  signal?: AbortSignal,
): Promise<PublicLessonDetail> {
  return apiFetch<PublicLessonDetail>(
    `${publicRoadmapPath(slug)}/topics/${encodeURIComponent(topicSlug)}`,
    { signal },
  );
}
