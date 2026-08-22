import React from "react";
import { ChatContainer } from "@/components/chat/ChatContainer";

interface WorkspacePageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { id } = await params;
  return <ChatContainer initialWorkspaceId={id} initialViewMode="chat" />;
}
