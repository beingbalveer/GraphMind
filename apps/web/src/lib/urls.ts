/**
 * @/lib/urls.ts — Canonical URL helpers for GraphMind.
 *
 * RULE: Every URL constructed in the app MUST go through these helpers.
 * Never hardcode URL strings in components. See docs/URL_DESIGN.md.
 */

/** /w/{workspaceId} — Workspace landing (resolves to most recent chat) */
export const buildWorkspaceUrl = (workspaceId: string): string =>
  `/w/${workspaceId}`;

/** /w/{workspaceId}/library — Full-page Workspace File Library */
export const buildLibraryUrl = (workspaceId: string): string =>
  `/w/${workspaceId}/library`;

/** /w/{workspaceId}/settings — Workspace settings */
export const buildSettingsUrl = (workspaceId: string): string =>
  `/w/${workspaceId}/settings`;

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

/** Curriculum navigation uses the published anchor, never a guessed chat ID. */
export function roadmapRouteMode(pathname: string, view: import("./roadmapTypes").CurriculumView|null): "page"|"canvas"|null {
  if (!view) return null;
  if (pathname === buildWorkspaceUrl(view.workspaceId)) return "page";
  if (pathname === buildCanvasUrl(view.workspaceId,view.canvasAnchorChatId)) return "canvas";
  return null;
}

/** /learn — Public learning catalog landing */
export const buildPublicCatalogUrl = (): string => `/learn`;

/** /learn/{slug} — Public published roadmap detail */
export const buildPublicRoadmapUrl = (slug: string): string =>
  `/learn/${encodeURIComponent(slug)}`;

/** /learn/{slug}/lessons/{topicSlug} — Public published lesson reader */
export const buildPublicLessonUrl = (slug: string, topicSlug: string): string =>
  `/learn/${encodeURIComponent(slug)}/lessons/${encodeURIComponent(topicSlug)}`;

/**
 * Validate and sanitize return redirects to strictly prevent open-redirect vulnerabilities.
 * Hostile returns (e.g. protocol-relative //evil.com, javascript:, external http/https) fallback to safe target.
 */
export function sanitizeRedirectPath(path: string | null | undefined, fallback = "/"): string {
  if (!path) return fallback;
  // Must be a relative path starting with single '/'
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return fallback;
  }
  // Disallow control characters or newlines
  if (/[\r\n\t]/.test(path)) {
    return fallback;
  }
  return path;
}

