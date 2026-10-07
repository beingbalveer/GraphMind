import type { ConversationTree, TreeNode } from "@graphmind/shared";
import { extractConversationThreads } from "../threadUtils";
import type { CanvasGraph, CanvasItem } from "./types";

function excerpt(content: string): string {
  return content.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|~~)(.*?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1").replace(/^#{1,6}\s+/gm, "")
    .replace(/\s+/g, " ").trim().slice(0, 240);
}

/** Keep readable evidence and ancestry; malformed timestamps are undated. */
export function filterConversationByTime(tree: ConversationTree, cutoff: string): ConversationTree {
  const limit = Date.parse(cutoff);
  if (!Number.isFinite(limit)) return tree;
  const visible = new Set<string>([tree.rootNodeId]);
  for (const node of Object.values(tree.nodes)) {
    const date = Date.parse(node.createdAt);
    if (Number.isFinite(date) && date > limit) continue;
    let current: TreeNode | undefined = node;
    const visited = new Set<string>();
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      visible.add(current.id);
      current = current.parentId ? tree.nodes[current.parentId] : undefined;
    }
  }
  return { ...tree, nodes: Object.fromEntries(Object.entries(tree.nodes).filter(([id]) => visible.has(id))) };
}

/** Selection/streaming flags never choose the mainline or alter graph topology. */
export function projectConversation(tree: ConversationTree): CanvasGraph {
  const { threads } = extractConversationThreads(tree);
  const origins = new Set(threads.flatMap(thread => thread.sourceMessageId ? [thread.sourceMessageId] : []));
  const items: CanvasItem[] = [];
  const messageToSegment = new Map<string, string>();
  const firstOrigins = new Map<string, string>();
  const links: CanvasGraph["links"] = [];

  for (const thread of threads) {
    const chunks: TreeNode[][] = [];
    let chunk: TreeNode[] = [];
    for (const message of thread.messages) {
      chunk.push(message);
      if (origins.has(message.id)) { chunks.push(chunk); chunk = []; }
    }
    if (chunk.length) chunks.push(chunk);
    let previous: CanvasItem | undefined;
    for (const [order, messages] of chunks.entries()) {
      const last = messages[messages.length - 1];
      const item: CanvasItem = {
        id: `segment:${messages[0].id}`, kind: "conversation", title: thread.title,
        summary: excerpt(last.content),
        itemIds: messages.map(message => message.id), selectionId: last.id,
        lane: thread.parentThreadId ? "side" : "spine",
        parentId: previous?.id ?? null, originId: previous?.selectionId ?? thread.sourceMessageId ?? null,
        order, threadId: thread.id,
      };
      for (const id of item.itemIds) messageToSegment.set(id, item.id);
      if (previous) links.push({ id: `${previous.id}->${item.id}`, source: previous.id, target: item.id, kind: "sequence" });
      else if (thread.sourceMessageId) firstOrigins.set(item.id, thread.sourceMessageId);
      items.push(item);
      previous = item;
    }
  }
  for (const item of items) {
    const origin = firstOrigins.get(item.id);
    if (!origin) continue;
    const parent = messageToSegment.get(origin);
    if (!parent || parent === item.id) continue;
    item.parentId = parent;
    links.push({ id: `${parent}->${item.id}`, source: parent, target: item.id, kind: "containment" });
  }
  return {
    items: items.sort((a, b) => (a.lane === b.lane ? a.order - b.order || a.id.localeCompare(b.id) : a.lane === "spine" ? -1 : 1)),
    links: links.sort((a, b) => a.id.localeCompare(b.id)),
  };
}
