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
export const buildChatUrl = (
  workspaceId: string,
  chatId: string,
  params?: { branch?: string; node?: string }
): string => {
  const base = `/w/${workspaceId}/chat/${chatId}`;
  if (!params) return base;
  const searchParams = new URLSearchParams();
  if (params.branch) searchParams.set("branch", params.branch);
  if (params.node) searchParams.set("node", params.node);
  const query = searchParams.toString();
  return query ? `${base}?${query}` : base;
};

/** /w/{workspaceId}/chat/{chatId}/canvas — Canvas / graph view */
export const buildCanvasUrl = (
  workspaceId: string,
  chatId: string,
  params?: { node?: string }
): string => {
  const base = `/w/${workspaceId}/chat/${chatId}/canvas`;
  if (!params?.node) return base;
  return `${base}?node=${encodeURIComponent(params.node)}`;
};

/**
 * /w/{workspaceId}/chat/{chatId}?node={nodeId}
 * Deep-link to a specific message node within a chat (scroll-to + highlight).
 */
export const buildNodeUrl = (
  workspaceId: string,
  chatId: string,
  nodeId: string
): string => `/w/${workspaceId}/chat/${chatId}?node=${encodeURIComponent(nodeId)}`;

/**
 * /w/{workspaceId}/chat/{chatId}?branch={branchLeafId}
 * Deep-link to a specific split-pane branch exploration.
 */
export const buildBranchUrl = (
  workspaceId: string,
  chatId: string,
  branchLeafId: string
): string => `/w/${workspaceId}/chat/${chatId}?branch=${encodeURIComponent(branchLeafId)}`;
