import { ConversationTree, TreeNode } from "@graphmind/shared";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8008";

export interface WorkspaceItem {
  id: string;
  name: string;
  description?: string | null;
  viewportX: number;
  viewportY: number;
  zoom: number;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceListResponse {
  workspaces: WorkspaceItem[];
  total: number;
}

export interface ChatItem {
  id: string;
  workspaceId: string;
  title: string;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
  activeNodeId?: string | null;
}

export interface ChatListResponse {
  workspaceId: string;
  chats: ChatItem[];
  total: number;
}

export interface GraphSnapshotNode {
  id: string;
  workspaceId: string;
  parentId?: string | null;
  role: "user" | "assistant" | "system";
  content: string;
  highlightedContext?: string | null;
  provider?: string | null;
  model?: string | null;
  positionX: number;
  positionY: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GraphSnapshotEdge {
  id: string;
  workspaceId: string;
  sourceId: string;
  targetId: string;
  relationType: string;
  highlightedContext?: string | null;
  createdAt: string;
}

export interface GraphSnapshotResponse {
  workspace: WorkspaceItem;
  nodes: GraphSnapshotNode[];
  edges: GraphSnapshotEdge[];
  rootNodeId?: string | null;
  activeNodeId?: string | null;
}

export interface GraphDeltaPayload {
  workspaceUpdate?: {
    name?: string;
    description?: string;
    viewportX?: number;
    viewportY?: number;
    zoom?: number;
  };
  movedNodes?: Array<{
    id: string;
    positionX: number;
    positionY: number;
  }>;
}

export function snapshotToTree(snapshot: GraphSnapshotResponse): ConversationTree | null {
  if (!snapshot.nodes || snapshot.nodes.length === 0) return null;

  const nodesRecord: Record<string, TreeNode> = {};

  // First pass: build base node map
  for (const n of snapshot.nodes) {
    nodesRecord[n.id] = {
      id: n.id,
      parentId: n.parentId || null,
      childrenIds: [],
      role: n.role,
      content: n.content,
      highlightedContext: n.highlightedContext || null,
      provider: n.provider || null,
      model: n.model || null,
      createdAt: n.createdAt,
      metadata: n.metadata || {},
    };
  }

  // Second pass: wire children references
  for (const n of snapshot.nodes) {
    if (n.parentId && nodesRecord[n.parentId]) {
      nodesRecord[n.parentId].childrenIds.push(n.id);
    }
  }

  const rootId = snapshot.rootNodeId || snapshot.nodes[0].id;
  const activeId = snapshot.activeNodeId || snapshot.nodes[snapshot.nodes.length - 1].id;

  return {
    id: snapshot.workspace.id,
    rootNodeId: rootId,
    activeNodeId: activeId,
    nodes: nodesRecord,
    createdAt: snapshot.workspace.createdAt,
    updatedAt: snapshot.workspace.updatedAt,
  };
}

export async function fetchWorkspaces(): Promise<WorkspaceItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/workspaces?limit=50`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error("Failed to fetch workspaces");
    const data: WorkspaceListResponse = await res.json();
    return data.workspaces;
  } catch (err) {
    console.warn("Could not fetch workspaces from API, using local storage:", err);
    return [];
  }
}

export async function createWorkspace(
  name: string,
  description?: string
): Promise<WorkspaceItem> {
  const res = await fetch(`${API_BASE_URL}/api/v1/workspaces`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) throw new Error("Failed to create workspace");
  return res.json();
}

export async function fetchWorkspaceChats(workspaceId: string): Promise<ChatItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/workspaces/${workspaceId}/chats`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return [];
    const data: ChatListResponse = await res.json();
    return data.chats;
  } catch (err) {
    console.warn("Could not fetch chats for workspace:", err);
    return [];
  }
}

export interface CreateNodePayload {
  id?: string;
  parentId?: string | null;
  role: "user" | "assistant" | "system";
  content: string;
  highlightedContext?: string | null;
  provider?: string | null;
  model?: string | null;
  positionX?: number;
  positionY?: number;
  metadata?: Record<string, unknown>;
}

export async function addNodeToWorkspace(
  workspaceId: string,
  payload: CreateNodePayload
): Promise<GraphSnapshotNode | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/workspaces/${workspaceId}/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: payload.id,
        parentId: payload.parentId || null,
        role: payload.role,
        content: payload.content,
        highlightedContext: payload.highlightedContext || null,
        provider: payload.provider || null,
        model: payload.model || null,
        positionX: payload.positionX || 0,
        positionY: payload.positionY || 0,
        metadata: payload.metadata || {},
      }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch (err) {
    console.warn("Failed to persist node to workspace:", err);
    return null;
  }
}

export async function deleteWorkspaceChat(
  workspaceId: string,
  chatRootId: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/workspaces/${workspaceId}/chats/${chatRootId}`,
      {
        method: "DELETE",
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchGraphSnapshot(
  workspaceId: string,
  rootId?: string
): Promise<GraphSnapshotResponse | null> {
  try {
    const url = rootId
      ? `${API_BASE_URL}/api/v1/workspaces/${workspaceId}/graph?root_id=${encodeURIComponent(rootId)}`
      : `${API_BASE_URL}/api/v1/workspaces/${workspaceId}/graph`;
    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function saveGraphDelta(
  workspaceId: string,
  delta: GraphDeltaPayload
): Promise<boolean> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/workspaces/${workspaceId}/delta`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(delta),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteWorkspace(workspaceId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/workspaces/${workspaceId}`,
      {
        method: "DELETE",
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}
