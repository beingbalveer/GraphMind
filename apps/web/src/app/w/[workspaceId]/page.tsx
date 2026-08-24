/**
 * /w/{workspaceId} — Workspace landing (no active chat).
 * ChatContainer is rendered by the parent layout.tsx and persists across navigations.
 */
export default function WorkspaceLandingPage() {
  return null;
}

export async function generateMetadata() {
  return {
    title: "GraphMind — AI Knowledge Workspace",
    description: "Graph-first workspace for structured AI conversations.",
  };
}
