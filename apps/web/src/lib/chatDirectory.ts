/**
 * @/lib/chatDirectory.ts — Projection helpers for the Learning Studio course directory.
 *
 * The course directory lists the conversations of a single authorized workspace
 * from the existing chat list metadata (`GET /workspaces/{id}/chats`). It is a
 * projection — not a copy — of the persisted chats: rows keep their server
 * identity and are never duplicated per topic.
 *
 * Existing metadata supplies:
 * - `pinned` and `updatedAt` for recent/pinned ordering,
 * - `title` for rename,
 * - `topicAssociation` for the lesson ancestry of a topic tutor conversation.
 *
 * Branch ancestry inside a single conversation remains the graph projection
 * owned by `@/lib/branchUtils` and is reused when a chat is opened through its
 * canonical `/w/{workspaceId}/chat/{chatId}` URL.
 */

import type { ChatItem } from "./workspaceApi";

export type ChatDirectoryKind = "lesson" | "personal";

export interface ChatDirectoryEntry {
  chat: ChatItem;
  /** Lesson for a topic tutor conversation, personal for an ordinary chat. */
  kind: ChatDirectoryKind;
  /** Ordered breadcrumb labels projected from existing metadata. */
  ancestry: string[];
  pinned: boolean;
}

export interface ProjectChatDirectoryOptions {
  /**
   * Protected structural row to exclude defensively (for example the roadmap
   * canvas anchor). The server already omits it; this keeps the projection
   * safe if a caller knows the anchor id.
   */
  excludeChatId?: string | null;
}

/**
 * Project persisted chats into ordered directory entries.
 *
 * Pinned conversations sort first, then most recently updated first, matching
 * the server order so a refresh preserves titles and ordering.
 */
export function projectChatDirectory(
  chats: readonly ChatItem[],
  options: ProjectChatDirectoryOptions = {}
): ChatDirectoryEntry[] {
  const { excludeChatId } = options;
  return chats
    .filter((chat) => !excludeChatId || chat.id !== excludeChatId)
    .map((chat) => {
      const association = chat.topicAssociation ?? null;
      const kind: ChatDirectoryKind = association ? "lesson" : "personal";
      const ancestry = association
        ? ["Lesson", association.title].filter(
            (label): label is string => Boolean(label)
          )
        : ["Personal"];
      return { chat, kind, ancestry, pinned: Boolean(chat.pinned) };
    })
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        new Date(b.chat.updatedAt).getTime() -
          new Date(a.chat.updatedAt).getTime()
    );
}

/**
 * Scoped search over the projected directory: matches a conversation title or
 * its lesson topic title. Empty query returns every entry unchanged.
 */
export function filterChatDirectory(
  entries: readonly ChatDirectoryEntry[],
  query: string
): ChatDirectoryEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...entries];
  return entries.filter(({ chat }) => {
    const topicTitle = chat.topicAssociation?.title ?? "";
    return `${chat.title} ${topicTitle}`.toLowerCase().includes(needle);
  });
}
