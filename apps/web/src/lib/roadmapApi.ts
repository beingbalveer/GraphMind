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
  request: RoadmapGenerateRequest
): Promise<RoadmapGenerateResponse> {
  return apiFetch<RoadmapGenerateResponse>("/roadmap/generate", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

import type { RoadmapRequest, JobSnapshot, JobReferenceData, CurriculumView, TopicBrief } from "./roadmapTypes";
const jobPath = (id: string) => `/roadmap/jobs/${encodeURIComponent(id)}`;
const curriculumPath = (id: string) => `/workspaces/${encodeURIComponent(id)}/roadmap`;

export const createRoadmapJob = (request: RoadmapRequest, key: string) =>
  apiFetch<JobSnapshot>("/roadmap/jobs", { method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify(request) });
export function attachRoadmapFile(jobId: string, file: File) {
  const body = new FormData(); body.append("file", file);
  return apiFetch<JobReferenceData>(`${jobPath(jobId)}/references`, { method: "POST", body });
}
export const attachRoadmapLink = (jobId: string, url: string) =>
  apiFetch<JobReferenceData>(`${jobPath(jobId)}/references`, { method: "POST", body: JSON.stringify({ url }) });
export const startRoadmapJob = (jobId: string) => apiFetch<JobSnapshot>(`${jobPath(jobId)}/start`, { method: "POST" });
export const listRoadmapJobs = (signal?: AbortSignal) => apiFetch<JobSnapshot[]>("/roadmap/jobs", { signal });
export const readRoadmapJob = (jobId: string, signal?: AbortSignal) => apiFetch<JobSnapshot>(jobPath(jobId), { signal });
export const answerRoadmapQuestion = (jobId: string, questionId: string, answer: string) =>
  apiFetch<JobSnapshot>(`${jobPath(jobId)}/answers`, { method: "POST", body: JSON.stringify({ questionId, answer }) });
export const cancelRoadmapJob = (jobId: string) => apiFetch<JobSnapshot>(`${jobPath(jobId)}/cancel`, { method: "POST" });
export const retryRoadmapJob = (jobId: string) => apiFetch<JobSnapshot>(`${jobPath(jobId)}/retry`, { method: "POST" });
export const readRoadmap = (workspaceId: string, signal?: AbortSignal) => apiFetch<CurriculumView>(curriculumPath(workspaceId), { signal });
export const readTopicBrief = (workspaceId: string, topicId: string, signal?: AbortSignal) =>
  apiFetch<TopicBrief>(`${curriculumPath(workspaceId)}/topics/${encodeURIComponent(topicId)}`, { signal });
