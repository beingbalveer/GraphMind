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
export const buildLibraryUrl = (
  workspaceId: string,
  params?: { file?: string }
): string => {
  const base = `/w/${workspaceId}/library`;
  if (!params?.file) return base;
  return `${base}?file=${encodeURIComponent(params.file)}`;
};

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

/**
 * /learn — Public learning catalog landing, optionally carrying the discovery
 * filters (`query`/`category`/`level`) so a filtered catalog view is a real,
 * shareable public URL. Filters are never primary navigation, so a query string
 * is correct here (unlike workspace/chat identity, which stays in the path).
 */
export const buildPublicCatalogUrl = (params?: {
  query?: string;
  category?: string;
  level?: string;
}): string => {
  const base = "/learn";
  if (!params) return base;
  const searchParams = new URLSearchParams();
  if (params.query) searchParams.set("query", params.query);
  if (params.category) searchParams.set("category", params.category);
  if (params.level) searchParams.set("level", params.level);
  const query = searchParams.toString();
  return query ? `${base}?${query}` : base;
};

/** /learn/{slug} — Public published roadmap detail */
export const buildPublicRoadmapUrl = (slug: string): string =>
  `/learn/${encodeURIComponent(slug)}`;

/** /learn/{slug}/lessons/{topicSlug} — Public published lesson reader */
export const buildPublicLessonUrl = (
  slug: string,
  topicSlug: string,
  params?: { branch?: string; node?: string }
): string => {
  const base = `/learn/${encodeURIComponent(slug)}/lessons/${encodeURIComponent(topicSlug)}`;
  if (!params) return base;
  const searchParams = new URLSearchParams();
  if (params.branch) searchParams.set("branch", params.branch);
  if (params.node) searchParams.set("node", params.node);
  const query = searchParams.toString();
  return query ? `${base}?${query}` : base;
};

/**
 * /login — Sign-in, preserving a safe post-login destination (e.g. a public
 * lesson the learner wanted to save). The `next` value is always encoded.
 */
export const buildLoginUrl = (next?: string | null): string =>
  next ? `/login?next=${encodeURIComponent(next)}` : "/login";

/**
 * Strip branch/node query params from a URL to retain the canonical root URL.
 */
export function stripBranchParams(url: string): string {
  try {
    const isRelative = url.startsWith("/");
    const dummyBase = "http://localhost";
    const parsed = new URL(url, dummyBase);
    parsed.searchParams.delete("branch");
    parsed.searchParams.delete("node");
    const query = parsed.searchParams.toString();
    const cleanPath = parsed.pathname;
    const result = query ? `${cleanPath}?${query}` : cleanPath;
    return isRelative ? result : parsed.href;
  } catch {
    return url.replace(/([?&])(branch|node)=[^&]*&?/g, "$1").replace(/[?&]$/, "");
  }
}

/**
 * Extract canonical branch navigation parameters (?branch= or ?node=).
 */
export function parseBranchNavigation(
  searchParams: URLSearchParams | { get: (key: string) => string | null } | null | undefined
): { branchId: string | null; nodeId: string | null } {
  if (!searchParams) return { branchId: null, nodeId: null };
  const branchId = searchParams.get("branch");
  const nodeId = searchParams.get("node");
  return {
    branchId: branchId ? decodeURIComponent(branchId) : null,
    nodeId: nodeId ? decodeURIComponent(nodeId) : null,
  };
}

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


