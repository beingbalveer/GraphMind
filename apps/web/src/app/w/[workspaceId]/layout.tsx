"use client";

import React from "react";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { useParams, usePathname, useSearchParams } from "next/navigation";

/**
 * /w/[workspaceId] layout — mounts ChatContainer exactly ONCE.
 *
 * Because this is a layout (not a page), Next.js preserves it across
 * navigations between child pages (/w/ws1/chat/chatA → /w/ws1/chat/chatB).
 * ChatContainer never unmounts, so there is zero state loss, zero RSC
 * re-fetch, and zero flicker when switching chats from the sidebar.
 *
 * The child <page.tsx> files render nothing (empty fragments) — they exist
 * only to satisfy the Next.js file-system router.
 */
export default function WorkspaceLayout({
  children: _children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ workspaceId: string }>();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse chatId from the pathname: /w/{workspaceId}/chat/{chatId}[/canvas]
  const chatIdMatch = pathname.match(/\/chat\/([^/]+)/);
  const chatId = chatIdMatch ? chatIdMatch[1] : undefined;
  const viewMode = pathname.endsWith("/canvas") ? "canvas" : "chat";
  const nodeId = searchParams.get("node") ?? undefined;

  return (
    <ChatContainer
      initialWorkspaceId={params.workspaceId}
      initialChatId={chatId}
      initialNodeId={nodeId}
      initialViewMode={viewMode}
    />
  );
}
