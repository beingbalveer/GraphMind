/** CamelCase contracts for the researched curriculum. Study progress is independent of revisions. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type LearningLevel = "beginner" | "intermediate" | "advanced";
export interface Duration { value: number | string; unit: "weeks" | "months" }
export interface RoadmapRequest {
  title?: string | null; prompt: string; level?: LearningLevel; background?: string | null;
  duration?: Duration | null; hoursPerWeek?: number | string | null;
}
export interface LearningProfile {
  title: string | null; prompt: string; level: LearningLevel; background: string | null;
  duration: Duration | null; hoursPerWeek: string | null; studyWeeks: number | null;
  weeklyMinutes: number | null; outcome: string; assumptions: string[]; knownSkills: string[];
}
export interface CurriculumItemData {
  id: string; kind: "root" | "phase" | "group" | "choice" | "topic";
  title: string; brief: string; objectives: string[]; exercise: string | null;
  format: "concepts" | "practice" | "project" | null; order: number;
  path: "core" | "further"; estimateMinutes: number | null;
  participation: "active" | "archived";
}
export interface CurriculumRelationData {
  sourceId: string; targetId: string;
  kind: "contains" | "prerequisite" | "recommended_next" | "alternative";
}
export interface ChoiceData { choiceId: string; selectedId: string; rationale: string }
export interface WeeklySession { week: number; topicId: string; sequence: number; minutes: number }
export interface SourceData {
  id: string; title: string; url: string | null; referenceId: string | null; locator: string | null;
  verifiedAt: string; status: "inspected" | "grounded" | "unavailable";
  access: "free" | "paid" | "unknown"; kind: string; evidence: string;
  provenance: Record<string, JsonValue>;
}
export interface ResourceData { topicId: string; sourceId: string; order: number; rationale: string }
export interface CurriculumCandidate {
  title: string; outcome: string; assumptions: string[]; items: CurriculumItemData[];
  relations: CurriculumRelationData[]; choices: ChoiceData[]; sessions: WeeklySession[];
  resources: ResourceData[];
}
export interface ValidationIssue {
  code: string; itemId: string | null; message: string; severity: "error" | "warning";
}
export interface ValidationReport {
  valid: boolean; issues: ValidationIssue[]; coreMinutes: number; capacityMinutes: number | null;
}
export interface TopicProgressData {
  topicId: string; status: "not_started" | "in_progress" | "completed"; completedAt: string | null;
}
export interface KnowledgeCheckData {
  id: string; topicId: string; sessionId: string; revisionId: string;
  rubric: Record<string, JsonValue>; result: Record<string, JsonValue>; createdAt: string;
}
export interface TopicResourceView { source: SourceData; rationale: string; order: number }
export interface TopicBrief {
  item: CurriculumItemData; resources: TopicResourceView[]; prerequisites: CurriculumItemData[];
  progress: TopicProgressData; defaultChatId: string | null; latestCheck: KnowledgeCheckData | null;
}
export interface CurriculumView {
  roadmapId: string; workspaceId: string; canvasAnchorChatId: string; revisionId: string;
  profile: LearningProfile; candidate: CurriculumCandidate; sources: SourceData[];
  progress: Record<string, TopicProgressData>; validation: ValidationReport;
}
