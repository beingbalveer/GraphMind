import { apiFetch } from "./apiClient";

export interface RoadmapGenerateRequest {
  goal: string;
  level?: "beginner" | "intermediate" | "advanced";
  focus?: "concepts" | "projects" | "interview";
  provider?: string;
  model?: string;
}

export interface RoadmapGenerateResponse {
  workspaceId: string;
  rootNodeId: string;
  topicCount: number;
  title: string;
  description?: string;
}

export async function generateRoadmap(
  request: RoadmapGenerateRequest,
): Promise<RoadmapGenerateResponse> {
  return apiFetch<RoadmapGenerateResponse>("/roadmap/generate", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

import type {
  RoadmapRequest,
  JobSnapshot,
  JobReferenceData,
  CurriculumView,
  TopicBrief,
} from "./roadmapTypes";
const jobPath = (id: string) => `/roadmap/jobs/${encodeURIComponent(id)}`;
const curriculumPath = (id: string) =>
  `/workspaces/${encodeURIComponent(id)}/roadmap`;

export const createRoadmapJob = (request: RoadmapRequest, key: string) =>
  apiFetch<JobSnapshot>("/roadmap/jobs", {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: JSON.stringify(request),
  });
export function attachRoadmapFile(jobId: string, file: File) {
  const body = new FormData();
  body.append("file", file);
  return apiFetch<JobReferenceData>(`${jobPath(jobId)}/references`, {
    method: "POST",
    body,
  });
}
export const attachRoadmapLink = (jobId: string, url: string) =>
  apiFetch<JobReferenceData>(`${jobPath(jobId)}/references`, {
    method: "POST",
    body: JSON.stringify({ url }),
  });
export const startRoadmapJob = (jobId: string) =>
  apiFetch<JobSnapshot>(`${jobPath(jobId)}/start`, { method: "POST" });
export const listRoadmapJobs = (signal?: AbortSignal) =>
  apiFetch<JobSnapshot[]>("/roadmap/jobs", { signal });
export const readRoadmapJob = (jobId: string, signal?: AbortSignal) =>
  apiFetch<JobSnapshot>(jobPath(jobId), { signal });
export const answerRoadmapQuestion = (
  jobId: string,
  questionId: string,
  answer: string,
) =>
  apiFetch<JobSnapshot>(`${jobPath(jobId)}/answers`, {
    method: "POST",
    body: JSON.stringify({ questionId, answer }),
  });
export const cancelRoadmapJob = (jobId: string) =>
  apiFetch<JobSnapshot>(`${jobPath(jobId)}/cancel`, { method: "POST" });
export const retryRoadmapJob = (jobId: string) =>
  apiFetch<JobSnapshot>(`${jobPath(jobId)}/retry`, { method: "POST" });
export const readRoadmap = (workspaceId: string, signal?: AbortSignal) =>
  apiFetch<CurriculumView>(curriculumPath(workspaceId), { signal });
export const readTopicBrief = (
  workspaceId: string,
  topicId: string,
  signal?: AbortSignal,
) =>
  apiFetch<TopicBrief>(
    `${curriculumPath(workspaceId)}/topics/${encodeURIComponent(topicId)}`,
    { signal },
  );

import type {
  TopicSessionData,
  TopicProgressData,
  KnowledgeCheckData,
} from "./roadmapTypes";
export const openTopicSession = (
  workspaceId: string,
  topicId: string,
  key: string,
  fresh = false,
) =>
  apiFetch<TopicSessionData>(
    `${curriculumPath(workspaceId)}/topics/${encodeURIComponent(topicId)}/sessions`,
    {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify({ fresh }),
    },
  );
export const readTopicSession = (
  workspaceId: string,
  sessionId: string,
  signal?: AbortSignal,
) =>
  apiFetch<TopicSessionData>(
    `${curriculumPath(workspaceId)}/sessions/${encodeURIComponent(sessionId)}`,
    { signal },
  );
export const setTopicProgress = (
  workspaceId: string,
  topicId: string,
  status: TopicProgressData["status"],
) =>
  apiFetch<TopicProgressData>(
    `${curriculumPath(workspaceId)}/topics/${encodeURIComponent(topicId)}/progress`,
    { method: "PATCH", body: JSON.stringify({ status }) },
  );
export const recordTopicCheck = (
  workspaceId: string,
  topicId: string,
  sessionId: string,
) =>
  apiFetch<KnowledgeCheckData>(
    `${curriculumPath(workspaceId)}/topics/${encodeURIComponent(topicId)}/checks`,
    { method: "POST", body: JSON.stringify({ sessionId }) },
  );

import type {
  EditRequest,
  RevisionSummary,
  ArchivedTopic,
  SourceData,
} from "./roadmapTypes";
export const saveRoadmapEdits = (workspaceId: string, request: EditRequest) =>
  apiFetch<CurriculumView>(curriculumPath(workspaceId), {
    method: "PATCH",
    body: JSON.stringify(request),
  });
export const listRoadmapRevisions = (
  workspaceId: string,
  signal?: AbortSignal,
) =>
  apiFetch<RevisionSummary[]>(`${curriculumPath(workspaceId)}/revisions`, {
    signal,
  });
export const readArchivedTopics = (workspaceId: string, signal?: AbortSignal) =>
  apiFetch<ArchivedTopic[]>(`${curriculumPath(workspaceId)}/archived-topics`, {
    signal,
  });
export const restoreRoadmapRevision = (
  workspaceId: string,
  revisionId: string,
  baseRevisionId: string,
  historyRemovalAck = false,
) =>
  apiFetch<CurriculumView>(
    `${curriculumPath(workspaceId)}/revisions/${encodeURIComponent(revisionId)}/restore`,
    {
      method: "POST",
      body: JSON.stringify({ baseRevisionId, historyRemovalAck }),
    },
  );
export const inspectRoadmapSource = (workspaceId: string, url: string) =>
  apiFetch<SourceData>(`${curriculumPath(workspaceId)}/sources/inspect`, {
    method: "POST",
    body: JSON.stringify({ url }),
  });

import type { RefinementRequest, RevisionProposalData } from "./roadmapTypes";
export const requestRoadmapRefinement = (
  workspaceId: string,
  request: RefinementRequest,
  key: string,
) =>
  apiFetch<JobSnapshot>(`${curriculumPath(workspaceId)}/refinements`, {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: JSON.stringify(request),
  });
export const readRoadmapProposal = (
  workspaceId: string,
  revisionId: string,
  signal?: AbortSignal,
) =>
  apiFetch<RevisionProposalData>(
    `${curriculumPath(workspaceId)}/revisions/${encodeURIComponent(revisionId)}/proposal`,
    { signal },
  );
export const applyRoadmapRevision = (
  workspaceId: string,
  revisionId: string,
  baseRevisionId: string,
  historyRemovalAck = false,
) =>
  apiFetch<CurriculumView>(
    `${curriculumPath(workspaceId)}/revisions/${encodeURIComponent(revisionId)}/apply`,
    {
      method: "POST",
      body: JSON.stringify({ baseRevisionId, historyRemovalAck }),
    },
  );
export const rejectRoadmapProposal = (
  workspaceId: string,
  revisionId: string,
) =>
  apiFetch<void>(
    `${curriculumPath(workspaceId)}/revisions/${encodeURIComponent(revisionId)}/reject`,
    { method: "POST" },
  );
