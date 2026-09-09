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
