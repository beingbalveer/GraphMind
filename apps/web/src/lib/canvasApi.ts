import { apiFetch } from "./apiClient";
import type { CanvasLayout } from "./canvas/types";

export type CanvasKind = "conversation" | "curriculum";
export interface StoredCanvasLayout { layout: CanvasLayout | null; revision: number }
const endpoint = (workspaceId: string, chatId: string, kind: CanvasKind) =>
  `/workspaces/${encodeURIComponent(workspaceId)}/chats/${encodeURIComponent(chatId)}/canvas-layout?kind=${kind}`;

export function readCanvasLayout(workspaceId: string, chatId: string, kind: CanvasKind) {
  return apiFetch<StoredCanvasLayout>(endpoint(workspaceId, chatId, kind));
}

export function writeCanvasLayout(workspaceId: string, chatId: string, kind: CanvasKind,
  baseRevision: number, layout: CanvasLayout) {
  const body = JSON.stringify({ baseRevision, layout });
  return apiFetch<StoredCanvasLayout>(endpoint(workspaceId, chatId, kind), {
    // Fetch keepalive has a 64KiB budget; large layouts retain the local recovery draft.
    method: "PUT", body, keepalive: new TextEncoder().encode(body).byteLength < 60000,
  });
}
