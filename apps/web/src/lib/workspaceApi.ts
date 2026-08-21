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

export async function fetchGraphSnapshot(
  workspaceId: string
): Promise<GraphSnapshotResponse | null> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/workspaces/${workspaceId}/graph`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );
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
