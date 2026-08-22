import React from "react";
import { ChatContainer } from "@/components/chat/ChatContainer";

interface GraphPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ chat?: string }>;
}

export default async function GraphPage({
  params,
  searchParams,
}: GraphPageProps) {
  const { id } = await params;
  const { chat } = await searchParams;
  return (
    <ChatContainer
      initialWorkspaceId={id}
      initialChatId={chat}
      initialViewMode="canvas"
    />
  );
}
