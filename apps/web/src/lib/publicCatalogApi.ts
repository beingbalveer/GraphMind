/**
 * @/lib/publicCatalogApi.ts — Anonymous public learning catalog client (LSI-029).
 *
 * Reads the frozen LSI-026 catalog contract (`GET /api/v1/public/roadmaps`): a
 * searchable, category/level-filtered, paginated list of published roadmap
 * cards. The endpoint is genuinely anonymous, so this module never sends or
 * requires a private identity. It is the only catalog dependency of the public
 * `/learn` page — no workspace, curriculum, or progress call may be added here,
 * because a guest has no private session to authorize one.
 */

import { apiFetch } from "./apiClient";

export type PublicRoadmapLevel = "beginner" | "intermediate" | "advanced";

const PUBLIC_LEVELS: readonly PublicRoadmapLevel[] = [
  "beginner",
  "intermediate",
  "advanced",
];

/** Narrowing guard so a URL/query value can be trusted as a catalog level. */
export function isPublicRoadmapLevel(value: unknown): value is PublicRoadmapLevel {
  return (
    typeof value === "string" &&
    (PUBLIC_LEVELS as readonly string[]).includes(value)
  );
}

/** Catalog card. Mirrors the server's `PublicRoadmapSummary` camelCase aliases. */
export interface PublicRoadmapSummary {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  level: PublicRoadmapLevel;
  estimatedWeeks: number;
  hoursPerWeek: number;
  topicCount: number;
  snapshotVersion: string;
  tags: string[];
  updatedAt: string;
}

/** Paginated envelope mirroring the server's `PublicRoadmapSummaryList`. */
export interface PublicRoadmapSummaryList {
  items: PublicRoadmapSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface PublicCatalogQuery {
  query?: string;
  category?: string;
  level?: PublicRoadmapLevel;
  limit?: number;
  offset?: number;
}

/** Server-enforced ceiling on `limit` (LSI-026 query validation). */
export const PUBLIC_CATALOG_MAX_LIMIT = 100;

/**
 * Canonical query string for a catalog request. Unset/blank filters are omitted
 * entirely so the request stays deterministic and cache-friendly, and every
 * value is URL-encoded by `URLSearchParams`.
 */
export function buildPublicCatalogQuery(params: PublicCatalogQuery = {}): string {
  const search = new URLSearchParams();
  const query = params.query?.trim();
  if (query) search.set("query", query);
  const category = params.category?.trim();
  if (category) search.set("category", category);
  if (params.level) search.set("level", params.level);
  if (typeof params.limit === "number") search.set("limit", String(params.limit));
  if (typeof params.offset === "number") search.set("offset", String(params.offset));
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}

/** List published roadmap cards for the anonymous public catalog. */
export function listPublicRoadmaps(
  params: PublicCatalogQuery = {},
  signal?: AbortSignal,
): Promise<PublicRoadmapSummaryList> {
  return apiFetch<PublicRoadmapSummaryList>(
    `/public/roadmaps${buildPublicCatalogQuery(params)}`,
    { signal },
  );
}
