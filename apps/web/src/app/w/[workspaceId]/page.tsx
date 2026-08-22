import React from "react";
import { ChatContainer } from "@/components/chat/ChatContainer";

interface WorkspacePageProps {
  params: Promise<{ workspaceId: string }>;
}

/**
 * /w/{workspaceId} — Workspace landing page.
 *
 * Renders ChatContainer in chat mode with no specific chatId.
 * This serves as the "New Chat" empty state. Once a message is sent,
 * the chat is persisted and the URL is updated to /w/{workspaceId}/chat/{chatId}.
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
