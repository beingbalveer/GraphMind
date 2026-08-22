import React from "react";
import { ChatContainer } from "@/components/chat/ChatContainer";

interface WorkspacePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ chat?: string }>;
}

export default async function WorkspacePage({
  params,
  searchParams,
}: WorkspacePageProps) {
  const { id } = await params;
  const { chat } = await searchParams;
  return (
    <ChatContainer
      initialWorkspaceId={id}
      initialChatId={chat}
      initialViewMode="chat"
    />
  );
}
