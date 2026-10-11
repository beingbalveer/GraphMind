import { apiFetch } from "./apiClient";

/** A curated roadmap.sh field offered in the import picker. */
export interface RoadmapImportField {
  slug: string;
  title: string;
  url: string;
  topicCount: number;
}

/** One imported field outcome. */
export interface RoadmapImportResultItem {
  slug: string;
  title: string;
  status: "created" | "existing";
  workspaceId: string;
  roadmapId: string;
  revisionId: string;
  topicCount: number;
}

/** A per-slug failure. */
export interface RoadmapImportError {
  slug: string;
  error: string;
}

/** POST /roadmap/imports response. */
export interface RoadmapImportResponse {
  results: RoadmapImportResultItem[];
  errors: RoadmapImportError[];
}

export async function listRoadmapImportFields(
  signal?: AbortSignal,
): Promise<RoadmapImportField[]> {
  return apiFetch<RoadmapImportField[]>("/roadmap/imports/fields", { signal });
}

export async function createRoadmapImports(slugs: string[]): Promise<RoadmapImportResponse> {
  return apiFetch<RoadmapImportResponse>("/roadmap/imports", {
    method: "POST",
    body: JSON.stringify({ slugs }),
  });
}