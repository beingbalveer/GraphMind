export type NodeType = 'root_prompt' | 'response' | 'branch_prompt' | 'concept';

export interface Position {
  x: number;
  y: number;
}

export interface GraphNode {
  id: string;
  workspaceId: string;
  nodeType: NodeType;
  content: string;
  position: Position;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface GraphEdge {
  id: string;
  workspaceId: string;
  sourceNodeId: string;
  targetNodeId: string;
  label?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface Workspace {
  id: string;
  userId: string;
  title: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface HealthCheckResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  environment: string;
}
