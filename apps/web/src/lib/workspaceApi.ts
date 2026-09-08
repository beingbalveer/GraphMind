import {
  Concept,
  ConceptCreateInput,
  ConceptUpdateInput,
  ConversationTree,
  FileAttachment,
  GapAnalysisResponse,
  NextTopicsResponse,
  TreeNode,
  WorkspaceMasterySummary,
  WorkspaceTimelineResponse,
} from "@graphmind/shared";
import { apiFetch } from "./apiClient";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";


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
  pinned?: boolean;
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

  // Resolve activeId by strictly following the mainline conversation trunk (nodes without highlightedContext)
  let currentTrunkNode = nodesRecord[rootId];
  let mainlineLeafId = rootId;
  if (currentTrunkNode) {
    while (currentTrunkNode.childrenIds.length > 0) {
      const mainlineChildren = currentTrunkNode.childrenIds
        .map((id) => nodesRecord[id])
        .filter((n): n is typeof currentTrunkNode => Boolean(n && !n.highlightedContext));

      if (mainlineChildren.length === 0) break;
      const nextNode = mainlineChildren[mainlineChildren.length - 1];
      currentTrunkNode = nextNode;
      mainlineLeafId = nextNode.id;
    }
  }
  const activeId = mainlineLeafId;


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
    const data = await apiFetch<WorkspaceListResponse>("/workspaces?limit=50");
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
  return apiFetch<WorkspaceItem>("/workspaces", {
    method: "POST",
    body: JSON.stringify({ name, description }),
  });
}

export async function seedDemoWorkspace(): Promise<{ workspaceId: string; initialChatId: string }> {
  return apiFetch<{ workspaceId: string; initialChatId: string }>("/workspaces/seed", {
    method: "POST",
  });
}

export async function fetchWorkspaceChats(workspaceId: string): Promise<ChatItem[]> {
  try {
    const data = await apiFetch<ChatListResponse>(`/workspaces/${workspaceId}/chats`);
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
    return await apiFetch<GraphSnapshotNode>(`/workspaces/${workspaceId}/nodes`, {
      method: "POST",
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
  } catch (err) {
    console.warn("Failed to persist node to workspace:", err);
    return null;
  }
}

export async function deleteWorkspaceBranch(
  workspaceId: string,
  nodeId: string
): Promise<boolean> {
  try {
    await apiFetch(`/workspaces/${workspaceId}/nodes/${nodeId}`, {
      method: "DELETE",
    });
    return true;
  } catch (error) {
    console.error("Failed to delete branch:", error);
    return false;
  }
}

export async function updateWorkspaceNodeMetadata(
  workspaceId: string,
  nodeId: string,
  metadata: Record<string, unknown>
): Promise<boolean> {
  try {
    await apiFetch(`/workspaces/${workspaceId}/nodes/${nodeId}`, {
      method: "PATCH",
      body: JSON.stringify({ metadata }),
    });
    return true;
  } catch {
    return false;
  }
}

export async function updateWorkspaceNodeContent(
  workspaceId: string,
  nodeId: string,
  content: string
): Promise<boolean> {
  try {
    await apiFetch(`/workspaces/${workspaceId}/nodes/${nodeId}`, {
      method: "PATCH",
      body: JSON.stringify({ content }),
    });
    return true;
  } catch {
    return false;
  }
}

export async function deleteWorkspaceChat(
  workspaceId: string,
  chatRootId: string
): Promise<boolean> {
  try {
    await apiFetch(`/workspaces/${workspaceId}/chats/${chatRootId}`, {
      method: "DELETE",
    });
    return true;
  } catch {
    return false;
  }
}

export async function renameWorkspaceChat(
  workspaceId: string,
  chatRootId: string,
  newTitle: string
): Promise<boolean> {
  try {
    await apiFetch(`/workspaces/${workspaceId}/chats/${chatRootId}`, {
      method: "PATCH",
      body: JSON.stringify({ title: newTitle }),
    });
    return true;
  } catch {
    return false;
  }
}

export async function togglePinWorkspaceChat(
  workspaceId: string,
  chatRootId: string,
  pinned: boolean
): Promise<boolean> {
  try {
    await apiFetch(`/workspaces/${workspaceId}/chats/${chatRootId}`, {
      method: "PATCH",
      body: JSON.stringify({ pinned }),
    });
    return true;
  } catch {
    return false;
  }
}


export async function fetchGraphSnapshot(
  workspaceId: string,
  rootId?: string
): Promise<GraphSnapshotResponse | null> {
  try {
    const endpoint = rootId
      ? `/workspaces/${workspaceId}/graph?root_id=${encodeURIComponent(rootId)}`
      : `/workspaces/${workspaceId}/graph`;
    return await apiFetch<GraphSnapshotResponse>(endpoint);
  } catch {
    return null;
  }
}

export async function saveGraphDelta(
  workspaceId: string,
  delta: GraphDeltaPayload
): Promise<boolean> {
  try {
    await apiFetch(`/workspaces/${workspaceId}/delta`, {
      method: "POST",
      body: JSON.stringify(delta),
    });
    return true;
  } catch {
    return false;
  }
}

export async function deleteWorkspace(workspaceId: string): Promise<boolean> {
  try {
    await apiFetch(`/workspaces/${workspaceId}`, {
      method: "DELETE",
    });
    return true;
  } catch {
    return false;
  }
}

export async function uploadWorkspaceFile(
  workspaceId: string,
  file: File
): Promise<FileAttachment | null> {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const data = await apiFetch<Record<string, any>>(
      `/workspaces/${workspaceId}/files/upload`,
      {
        method: "POST",
        body: formData,
      }
    );
    const resolvedUrl = data.url
      ? (data.url.startsWith("http") ? data.url : `${API_BASE_URL}${data.url}`)
      : undefined;

    return {
      id: data.id,
      name: data.name,
      sizeBytes: data.sizeBytes,
      mimeType: data.mimeType,
      fileCategory: data.fileCategory,
      url: resolvedUrl,
      extractedText: data.extractedText,
    };
  } catch (err) {
    console.warn("Error uploading file to workspace:", err);
    return null;
  }
}

export function resolveFileUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }
  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

export async function fetchWorkspaceFiles(
  workspaceId: string,
  category?: string
): Promise<FileAttachment[]> {
  try {
    const query = category ? `?category=${encodeURIComponent(category)}` : "";
    const files = await apiFetch<FileAttachment[]>(
      `/workspaces/${workspaceId}/files${query}`
    );
    return files.map((f) => ({
      ...f,
      url: f.url ? resolveFileUrl(f.url) : resolveFileUrl(`/api/v1/workspaces/${workspaceId}/files/${f.id}/download`),
    }));
  } catch (err) {
    console.warn("Error fetching workspace files:", err);
    return [];
  }
}

export async function deleteWorkspaceFile(
  workspaceId: string,
  fileId: string
): Promise<boolean> {
  try {
    await apiFetch(`/workspaces/${workspaceId}/files/${fileId}`, {
      method: "DELETE",
    });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------
// Phase 6 Knowledge Mastery & Concept APIs
// ---------------------------------------------------------

export async function getWorkspaceMastery(
  workspaceId: string,
  stalenessDays: number = 14
): Promise<WorkspaceMasterySummary | null> {
  try {
    return await apiFetch<WorkspaceMasterySummary>(
      `/workspaces/${workspaceId}/mastery?staleness_days=${stalenessDays}`
    );
  } catch (err) {
    console.warn("Error fetching workspace mastery summary:", err);
    return null;
  }
}

export async function listWorkspaceConcepts(
  workspaceId: string,
  limit: number = 100
): Promise<Concept[]> {
  try {
    return await apiFetch<Concept[]>(
      `/workspaces/${workspaceId}/concepts?limit=${limit}`
    );
  } catch (err) {
    console.warn("Error listing workspace concepts:", err);
    return [];
  }
}

export async function createWorkspaceConcept(
  workspaceId: string,
  data: ConceptCreateInput
): Promise<Concept | null> {
  try {
    return await apiFetch<Concept>(
      `/workspaces/${workspaceId}/concepts`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  } catch (err) {
    console.warn("Error creating workspace concept:", err);
    return null;
  }
}

export async function updateWorkspaceConcept(
  workspaceId: string,
  conceptId: string,
  data: ConceptUpdateInput
): Promise<Concept | null> {
  try {
    return await apiFetch<Concept>(
      `/workspaces/${workspaceId}/concepts/${conceptId}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      }
    );
  } catch (err) {
    console.warn("Error updating workspace concept:", err);
    return null;
  }
}

export async function linkNodeConcepts(
  workspaceId: string,
  nodeId: string,
  conceptIds: string[]
): Promise<Concept[]> {
  try {
    return await apiFetch<Concept[]>(
      `/workspaces/${workspaceId}/nodes/${nodeId}/concepts`,
      {
        method: "POST",
        body: JSON.stringify({ conceptIds }),
      }
    );
  } catch (err) {
    console.warn("Error linking node concepts:", err);
    return [];
  }
}

export async function getNodeConcepts(
  workspaceId: string,
  nodeId: string
): Promise<Concept[]> {
  try {
    return await apiFetch<Concept[]>(
      `/workspaces/${workspaceId}/nodes/${nodeId}/concepts`
    );
  } catch (err) {
    console.warn("Error getting node concepts:", err);
    return [];
  }
}

export async function getWorkspaceKnowledgeGaps(
  workspaceId: string,
  stalenessDays: number = 14
): Promise<GapAnalysisResponse | null> {
  try {
    return await apiFetch<GapAnalysisResponse>(
      `/workspaces/${workspaceId}/curator/gaps?staleness_days=${stalenessDays}`
    );
  } catch (err) {
    console.warn("Error fetching knowledge gaps:", err);
    return null;
  }
}

export async function adoptKnowledgeGap(
  workspaceId: string,
  gapId: string,
  initialMasteryLevel: string = "unexplored"
): Promise<Concept | null> {
  try {
    return await apiFetch<Concept>(
      `/workspaces/${workspaceId}/curator/gaps/${encodeURIComponent(gapId)}/adopt`,
      {
        method: "POST",
        body: JSON.stringify({ initialMasteryLevel }),
      }
    );
  } catch (err) {
    console.warn("Error adopting knowledge gap:", err);
    return null;
  }
}

export async function getNextTopicRecommendations(
  workspaceId: string,
  limit: number = 3
): Promise<NextTopicsResponse | null> {
  try {
    return await apiFetch<NextTopicsResponse>(
      `/workspaces/${workspaceId}/curator/next-topics?limit=${limit}`
    );
  } catch (err) {
    console.warn("Error fetching next topic recommendations:", err);
    return null;
  }
}

export async function getWorkspaceTimeline(
  workspaceId: string
): Promise<WorkspaceTimelineResponse | null> {
  try {
    return await apiFetch<WorkspaceTimelineResponse>(
      `/workspaces/${workspaceId}/curator/timeline`
    );
  } catch (err) {
    console.warn("Error fetching workspace timeline:", err);
    return null;
  }
}
