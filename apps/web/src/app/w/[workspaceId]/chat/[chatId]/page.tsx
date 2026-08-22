import React from "react";
import { ChatContainer } from "@/components/chat/ChatContainer";

interface ChatPageProps {
  params: Promise<{ workspaceId: string; chatId: string }>;
  searchParams: Promise<{ node?: string }>;
}

/**
 * /w/{workspaceId}/chat/{chatId} — Chat (thread) view.
 *
 * Both workspaceId and chatId are path segments (not query params),
 * making this URL fully shareable and server-renderable.
 *
 * Optional ?node={nodeId} query param scrolls to a specific message node.
 */
export default async function ChatPage({
  params,
  searchParams,
}: ChatPageProps) {
  const { workspaceId, chatId } = await params;
  const { node } = await searchParams;

  return (
    <ChatContainer
      initialWorkspaceId={workspaceId}
      initialChatId={chatId}
      initialNodeId={node}
      initialViewMode="chat"
    />
  );
}

export async function generateMetadata({ params }: ChatPageProps) {
  const { workspaceId, chatId } = await params;
  return {
    title: `Chat — GraphMind`,
    description: `GraphMind chat ${chatId} in workspace ${workspaceId}`,
  };
}
