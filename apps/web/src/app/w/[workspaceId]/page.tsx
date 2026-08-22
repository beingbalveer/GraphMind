import React from "react";
import { ChatContainer } from "@/components/chat/ChatContainer";

interface WorkspacePageProps {
  params: Promise<{ workspaceId: string }>;
}

/**
 * /w/{workspaceId} — Workspace landing page.
 *
 * Renders ChatContainer in chat mode with no specific chatId.
 * ChatContainer's initWorkspace effect resolves the most recent chat
 * and calls router.replace() to push the full canonical URL:
 *   /w/{workspaceId}/chat/{chatId}
 */
export default async function WorkspaceLandingPage({
  params,
}: WorkspacePageProps) {
  const { workspaceId } = await params;

  return (
    <ChatContainer
      initialWorkspaceId={workspaceId}
      initialViewMode="chat"
    />
  );
}

export async function generateMetadata({ params }: WorkspacePageProps) {
  const { workspaceId } = await params;
  return {
    title: "GraphMind — AI Knowledge Workspace",
    description: `GraphMind workspace ${workspaceId}`,
  };
}
