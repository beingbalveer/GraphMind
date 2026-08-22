/**
 * @/lib/urls.ts — Canonical URL helpers for GraphMind.
 *
 * RULE: Every URL constructed in the app MUST go through these helpers.
 * Never hardcode URL strings in components. See docs/URL_DESIGN.md.
 */

/** /w/{workspaceId} — Workspace landing (resolves to most recent chat) */
export const buildWorkspaceUrl = (workspaceId: string): string =>
  `/w/${workspaceId}`;

/** /w/{workspaceId}/chat/{chatId} — Chat / thread view */
export const buildChatUrl = (workspaceId: string, chatId: string): string =>
  `/w/${workspaceId}/chat/${chatId}`;

/** /w/{workspaceId}/chat/{chatId}/canvas — Canvas / graph view */
export const buildCanvasUrl = (workspaceId: string, chatId: string): string =>
  `/w/${workspaceId}/chat/${chatId}/canvas`;

/**
 * /w/{workspaceId}/chat/{chatId}?node={nodeId}
 * Deep-link to a specific message node within a chat (scroll-to + highlight).
 */
export const buildNodeUrl = (
  workspaceId: string,
  chatId: string,
  nodeId: string
): string => `/w/${workspaceId}/chat/${chatId}?node=${nodeId}`;
