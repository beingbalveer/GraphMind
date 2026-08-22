import React from "react";
import { ChatContainer } from "@/components/chat/ChatContainer";

interface CanvasPageProps {
  params: Promise<{ workspaceId: string; chatId: string }>;
  searchParams: Promise<{ node?: string }>;
}

/**
 * /w/{workspaceId}/chat/{chatId}/canvas — Canvas (graph) view.
 *
 * Same chat as /w/{workspaceId}/chat/{chatId}, rendered in the 2D spatial
 * canvas mode. View mode is a path segment — not a query param — so this URL
 * is independently bookmarkable and shareable.
 */
export default async function CanvasPage({
  params,
  searchParams,
}: CanvasPageProps) {
  const { workspaceId, chatId } = await params;
  const { node } = await searchParams;

  return (
    <ChatContainer
      initialWorkspaceId={workspaceId}
      initialChatId={chatId}
      initialNodeId={node}
      initialViewMode="canvas"
    />
  );
}

export async function generateMetadata({ params }: CanvasPageProps) {
  const { workspaceId, chatId } = await params;
  return {
    title: `Canvas — GraphMind`,
    description: `GraphMind canvas view for chat ${chatId} in workspace ${workspaceId}`,
  };
}
