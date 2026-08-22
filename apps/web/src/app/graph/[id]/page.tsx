import React from "react";
import { ChatContainer } from "@/components/chat/ChatContainer";

interface GraphPageProps {
  params: Promise<{ id: string }>;
}

export default async function GraphPage({ params }: GraphPageProps) {
  const { id } = await params;
  return <ChatContainer initialWorkspaceId={id} initialViewMode="canvas" />;
}
