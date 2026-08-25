/**
 * /w/{workspaceId}/chat/{chatId}/canvas — Canvas (graph) view.
 *
 * Same chat as /w/{workspaceId}/chat/{chatId}, rendered in the 2D spatial
 * canvas mode. View mode is a path segment — not a query param — so this URL
 * is independently bookmarkable and shareable.
 *
 * ChatContainer is rendered once by the parent layout.tsx and persists across navigations.
 * This page returns null to satisfy the Next.js App Router without re-mounting.
 */
export default function CanvasPage() {
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ workspaceId: string; chatId: string }>;
}) {
  const { workspaceId, chatId } = await params;
  return {
    title: `Canvas — GraphMind`,
    description: `GraphMind canvas view for chat ${chatId} in workspace ${workspaceId}`,
  };
}
