/**
 * @/lib/searchApi.ts — Inventory-backed workspace search client.
 *
 * Wraps the exposed `POST /workspaces/{id}/search` endpoint, which reuses the
 * existing graph (pgvector node) and hybrid (RAG file chunk) retrieval services
 * under a single authorized workspace scope. Results never cross workspace
 * boundaries: the server enforces read membership before returning anything.
 *
 * Every result carries enough identity to open its canonical context:
 * - a node hit carries its conversation root (`chatId`) for `?node=` deep links,
 * - a file hit carries its file id for the workspace library route.
 */

import { apiFetch } from "./apiClient";
import { buildLibraryUrl, buildNodeUrl } from "./urls";

export interface SearchNodeHit {
  nodeId: string;
  /** Conversation root the node belongs to (canonical chat identity). */
  chatId: string;
  role: string;
  content: string;
  highlightedContext?: string | null;
  similarityScore: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface SearchFileHit {
  fileId: string;
  filename: string;
  chunkId: string;
  chunkIndex: number;
  snippet: string;
  pageNumber?: number | null;
  sectionHeader?: string | null;
  score: number;
}

export interface WorkspaceSearchResponse {
  workspaceId: string;
  query: string;
  nodes: SearchNodeHit[];
  files: SearchFileHit[];
  totalNodes: number;
  totalFiles: number;
}

export interface SearchWorkspaceOptions {
  topK?: number;
  minSimilarity?: number;
  signal?: AbortSignal;
}

/**
 * Run a permission-scoped graph + hybrid search for one workspace.
 *
 * Rejects on failure so callers can distinguish "no matches" from "could not
 * search" and offer a retry, mirroring `listWorkspaceChats`.
 */
export async function searchWorkspace(
  workspaceId: string,
  query: string,
  options: SearchWorkspaceOptions = {}
): Promise<WorkspaceSearchResponse> {
  return apiFetch<WorkspaceSearchResponse>(`/workspaces/${workspaceId}/search`, {
    method: "POST",
    body: JSON.stringify({
      query,
      topK: options.topK ?? 8,
      minSimilarity: options.minSimilarity ?? 0.0,
    }),
    signal: options.signal,
  });
}

/** Canonical `/w/{workspaceId}/chat/{chatId}?node={nodeId}` deep link. */
export function searchNodeResultUrl(workspaceId: string, hit: SearchNodeHit): string {
  return buildNodeUrl(workspaceId, hit.chatId, hit.nodeId);
}

/** Canonical `/w/{workspaceId}/library?file={fileId}` context for a file hit. */
export function searchFileResultUrl(workspaceId: string, hit: SearchFileHit): string {
  return buildLibraryUrl(workspaceId, { file: hit.fileId });
}
