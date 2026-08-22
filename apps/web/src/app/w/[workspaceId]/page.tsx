import React from "react";

interface WorkspacePageProps {
  params: Promise<{ workspaceId: string }>;
}

/**
 * /w/{workspaceId} — Workspace landing page.
 *
 * This is a pure redirect: the server immediately sends the user to the most
 * recent chat in the workspace. The actual chat list resolution happens in
 * ChatContainer (client) because we don't yet have server-side auth/session.
 *
 * When server-side auth lands (Phase 4), this page can be upgraded to fetch
 * the most recent chatId from the DB and redirect directly to
 * /w/{workspaceId}/chat/{chatId}, skipping the client round-trip.
 */
export default async function WorkspaceLandingPage({
  params,
}: WorkspacePageProps) {
  const { workspaceId } = await params;

  // For now, render ChatContainer in chat mode without a specific chatId.
  // ChatContainer will auto-resolve and push the canonical URL client-side.
  // Import here avoids a dynamic import cycle with the redirect.
  const { ChatContainer } = await import("@/components/chat/ChatContainer");

  return (
    <ChatContainer
      initialWorkspaceId={workspaceId}
      initialViewMode="chat"
    />
  );
}

export async function generateMetadata({
  params,
}: WorkspacePageProps) {
  const { workspaceId } = await params;
  return {
    title: `Workspace — GraphMind`,
    description: `GraphMind workspace ${workspaceId}`,
  };
}
