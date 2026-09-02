export type NodeType = 'root_prompt' | 'response' | 'branch_prompt' | 'concept';
export type MessageRole = 'user' | 'assistant' | 'system';

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

/**
 * Phase 2 Tree-Structured Branching Domain Models
 */

export interface FileAttachment {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  fileCategory?: string;
  url?: string;
  data?: string;
}

export interface TreeNode {
  id: string;
  parentId: string | null;
  childrenIds: string[];
  role: MessageRole;
  content: string;
  highlightedContext?: string | null;
  provider?: string | null;
  model?: string | null;
  attachments?: FileAttachment[];
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface CreateNodeParams {
  id?: string;
  parentId?: string | null;
  role: MessageRole;
  content: string;
  highlightedContext?: string | null;
  provider?: string | null;
  model?: string | null;
  attachments?: FileAttachment[];
  metadata?: Record<string, unknown>;
}

export interface ConversationTree {
  id: string;
  rootNodeId: string;
  activeNodeId: string;
  nodes: Record<string, TreeNode>;
  createdAt: string;
  updatedAt: string;
}

export * from './tree-utils';
