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
  extractedText?: string;
  metadata?: Record<string, unknown>;
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

/**
 * Phase 6 Knowledge State & Mastery Modeling Domain Types
 */

export type ConceptMasteryLevel =
  | 'unexplored'
  | 'explored'
  | 'quizzed'
  | 'mastered'
  | 'stale';

export interface Concept {
  id: string;
  workspaceId: string;
  name: string;
  description?: string | null;
  masteryLevel: ConceptMasteryLevel;
  confidenceScore: number;
  timesQuizzed: number;
  timesCorrect: number;
  lastReviewedAt?: string | null;
  nodeIds?: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ConceptMasteryDistribution {
  unexplored: number;
  explored: number;
  quizzed: number;
  mastered: number;
  stale: number;
}

export interface WorkspaceMasterySummary {
  workspaceId: string;
  totalConcepts: number;
  overallScore: number;
  distribution: ConceptMasteryDistribution;
  topMastered: Concept[];
  needingReview: Concept[];
  concepts: Concept[];
}

export interface ConceptCreateInput {
  name: string;
  description?: string | null;
  masteryLevel?: ConceptMasteryLevel;
  confidenceScore?: number;
  nodeIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface ConceptUpdateInput {
  name?: string;
  description?: string | null;
  masteryLevel?: ConceptMasteryLevel;
  confidenceScore?: number;
  timesQuizzed?: number;
  timesCorrect?: number;
  quizResult?: boolean;
  metadata?: Record<string, unknown>;
}

export type KnowledgeGapSeverity = 'high' | 'medium' | 'low';
export type KnowledgeGapStatus =
  | 'missing'
  | 'unexplored'
  | 'stale'
  | 'weak_retention';

export interface KnowledgeGap {
  id: string;
  conceptName: string;
  domain: string;
  severity: KnowledgeGapSeverity;
  status: KnowledgeGapStatus;
  dependentConcepts: string[];
  rationale: string;
  suggestedAction: string;
  foundationalImportance: string;
}

export interface GapAnalysisResponse {
  workspaceId: string;
  analyzedAt: string;
  totalGaps: number;
  highSeverityCount: number;
  mediumSeverityCount: number;
  gaps: KnowledgeGap[];
  exploredDomains: string[];
}

export * from './tree-utils';
