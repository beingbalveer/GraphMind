/**
 * /w/{workspaceId}/chat/{chatId} — Active chat view.
 * ChatContainer is rendered by the parent layout.tsx and persists across navigations.
 * This page renders nothing — the layout reads chatId from usePathname().
 */
export default function ChatPage() {
  return null;
}

export async function generateMetadata() {
  return { title: "Chat — GraphMind" };
}
