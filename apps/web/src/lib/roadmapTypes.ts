/** CamelCase contracts for the researched curriculum. Study progress is independent of revisions. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
export type LearningLevel = "beginner" | "intermediate" | "advanced";
export interface Duration {
  value: number | string;
  unit: "weeks" | "months";
}
export interface RoadmapRequest {
  title?: string | null;
  prompt: string;
  level?: LearningLevel;
  background?: string | null;
  duration?: Duration | null;
  hoursPerWeek?: number | string | null;
}
export interface LearningProfile {
  title: string | null;
  prompt: string;
  level: LearningLevel;
  background: string | null;
  duration: Duration | null;
  hoursPerWeek: string | null;
  studyWeeks: number | null;
  weeklyMinutes: number | null;
  outcome: string;
  assumptions: string[];
  knownSkills: string[];
}
export interface CurriculumItemData {
  id: string;
  kind: "root" | "phase" | "group" | "choice" | "topic";
  title: string;
  brief: string;
  objectives: string[];
  exercise: string | null;
  format: "concepts" | "practice" | "project" | null;
  order: number;
  path: "core" | "further";
  estimateMinutes: number | null;
  participation: "active" | "archived";
  contentMarkdown?: string | null;
}
export interface CurriculumRelationData {
  sourceId: string;
  targetId: string;
  kind: "contains" | "prerequisite" | "recommended_next" | "alternative";
}
export interface ChoiceData {
  choiceId: string;
  selectedId: string;
  rationale: string;
}
export interface WeeklySession {
  week: number;
  topicId: string;
  sequence: number;
  minutes: number;
}
export interface SourceData {
  id: string;
  title: string;
  url: string | null;
  referenceId: string | null;
  locator: string | null;
  verifiedAt: string;
  status: "inspected" | "grounded" | "unavailable";
  access: "free" | "paid" | "unknown";
  kind: string;
  evidence: string;
  provenance: Record<string, JsonValue>;
}
export interface ResourceData {
  topicId: string;
  sourceId: string;
  order: number;
  rationale: string;
}
export interface CurriculumCandidate {
  title: string;
  outcome: string;
  assumptions: string[];
  items: CurriculumItemData[];
  relations: CurriculumRelationData[];
  choices: ChoiceData[];
  sessions: WeeklySession[];
  resources: ResourceData[];
}
export interface ValidationIssue {
  code: string;
  itemId: string | null;
  message: string;
  severity: "error" | "warning";
}
export interface ValidationReport {
  valid: boolean;
  issues: ValidationIssue[];
  coreMinutes: number;
  capacityMinutes: number | null;
}
export interface TopicProgressData {
  topicId: string;
  status: "not_started" | "in_progress" | "completed";
  completedAt: string | null;
}
export interface KnowledgeCheckData {
  id: string;
  topicId: string;
  sessionId: string;
  revisionId: string;
  rubric: Record<string, JsonValue>;
  result: Record<string, JsonValue>;
  createdAt: string;
}
export interface PracticeActivityData {
  id: string;
  version: string;
  topicId: string;
  kind: "choice" | "short_answer" | "reflection";
  prompt: string;
  choices?: string[] | null;
  hint?: string | null;
  explanation?: string | null;
}
export interface PracticeDraftRequest {
  activityId: string;
  activityVersion: string;
  draft: string;
  selectedChoice?: string | null;
}
export interface PracticeDraftData {
  topicId: string;
  activityId: string;
  activityVersion: string;
  draft: string;
  selectedChoice?: string | null;
  updatedAt: string;
}
export interface PracticeAttemptData {
  id: string;
  attemptId: string;
  attemptNumber: number;
  activityId: string;
  activityVersion: string;
  answer?: string | null;
  selectedChoice?: string | null;
  correct?: boolean | null;
  feedback: string;
  explanation?: string | null;
  canRetry: boolean;
  nextAction: "retry" | "continue" | "review";
  submittedAt: string;
}
export interface PracticeStateData {
  topicId: string;
  activity: PracticeActivityData;
  draft?: PracticeDraftData | null;
  attemptsCount: number;
  latestAttempt?: PracticeAttemptData | null;
  checks: KnowledgeCheckData[];
}
export interface CheckRequest {
  sessionId?: string | null;
  activityId?: string | null;
  activityVersion?: string | null;
  attemptId?: string | null;
  answer?: string | null;
  selectedChoice?: string | null;
  draft?: string | null;
  isDraft?: boolean;
}
export interface TopicResourceView {
  source: SourceData;
  rationale: string;
  order: number;
}
export interface TopicBrief {
  item: CurriculumItemData;
  resources: TopicResourceView[];
  prerequisites: CurriculumItemData[];
  progress: TopicProgressData;
  defaultChatId: string | null;
  latestCheck: KnowledgeCheckData | null;
  savedLessonContent?: string | null;
  practiceActivity?: PracticeActivityData | null;
}
export interface CurriculumView {
  roadmapId: string;
  workspaceId: string;
  /** Whether the current actor may change this workspace curriculum. */
  canWrite: boolean;
  canvasAnchorChatId: string;
  revisionId: string;
  profile: LearningProfile;
  candidate: CurriculumCandidate;
  sources: SourceData[];
  progress: Record<string, TopicProgressData>;
  validation: ValidationReport;
  origins?: CurriculumTopicOrigin[];
}

export interface CurriculumTopicOrigin {
  topicId: string;
  creationRevisionId: string;
  sourceWorkspaceId: string | null;
  sourceChatId: string | null;
  sourceNodeId: string | null;
  sourceTitle: string;
  sourceExcerpt: string;
  unavailable: boolean;
}

export type JobStatus =
  | "queued"
  | "running"
  | "awaiting_input"
  | "cancel_requested"
  | "canceled"
  | "failed"
  | "completed";
export type StageName =
  | "understand"
  | "research"
  | "compose"
  | "personalize"
  | "validate"
  | "publish";
export interface ClarificationQuestion {
  id: string;
  text: string;
  suggestions: string[];
}
export interface JobError {
  code: string;
  message: string;
  recoverable: boolean;
  nextAction: "retry" | "new_run" | "answer" | "configure_search";
}
export interface JobResult {
  proposalState?: "candidate" | "applied" | "rejected" | null;
  workspaceId: string;
  roadmapId: string;
  revisionId: string;
  kind: "published" | "proposal";
}
export interface JobSnapshot {
  targetWorkspaceId?: string | null;
  id: string;
  operation: "generate" | "refine";
  title: string | null;
  status: JobStatus;
  stage: StageName;
  startupReady: boolean;
  summary: string;
  question: ClarificationQuestion | null;
  questionCount: number;
  error: JobError | null;
  result: JobResult | null;
  lastSequence: number;
  createdAt: string;
  updatedAt: string;
}
export interface JobEventData {
  sequence: number;
  stage: StageName;
  type: string;
  summary: string;
  metadata: Record<string, JsonValue>;
  createdAt: string;
}
export interface JobReferenceData {
  id: string;
  kind: "file" | "link";
  name: string;
  status: "staged" | "inspected" | "unavailable" | "rejected";
  sizeBytes: number;
  error: string | null;
  locator: string | null;
}

export interface TopicSessionData {
  id: string;
  chatId: string;
  topicId: string;
  revisionId: string;
  isNew: boolean;
  lessonStartState: "pending" | "started" | "completed" | "interrupted";
  archived: boolean;
  topicTitle?: string | null;
  progress?: TopicProgressData | null;
  checks?: KnowledgeCheckData[];
}

/** Lightweight history row used in a topic brief; knowledge checks are loaded only for the active session. */
export interface TopicSessionSummary {
  id: string;
  chatId: string;
  topicId: string;
  title: string;
  revisionId: string;
  createdAt: string;
  updatedAt: string;
  isPrimary: boolean;
  lessonStartState: "pending" | "started" | "completed" | "interrupted";
  archived: boolean;
}

export type CurriculumPatch =
  | {
      op: "update_item";
      itemId: string;
      title?: string;
      brief?: string;
      objectives?: string[];
      exercise?: string | null;
      estimateMinutes?: number;
    }
  | { op: "add_topic"; item: CurriculumItemData; parentId: string }
  | { op: "remove_topic"; itemId: string }
  | { op: "move_item"; itemId: string; parentId: string; order: number }
  | { op: "replace_resources"; itemId: string; resources: ResourceData[] }
  | { op: "assign_week"; sessions: WeeklySession[] }
  | { op: "select_alternative"; choiceId: string; selectedId: string };
export interface EditRequest {
  baseRevisionId: string;
  patches: CurriculumPatch[];
  historyRemovalAck?: boolean;
}
export interface RevisionSummary {
  id: string;
  baseRevisionId: string | null;
  status: string;
  title: string;
  createdAt: string;
  added: string[];
  changed: string[];
  removed: string[];
  hasLearningHistory: boolean;
}
export interface ArchivedTopic {
  item: CurriculumItemData;
  progress: TopicProgressData;
  sessions: TopicSessionData[];
}

export interface RevisionDiff {
  added: string[];
  changed: string[];
  removed: string[];
  summary: string;
  identityChanges: { oldItemId: string; newItemId: string; reason: string }[];
}
export interface RevisionProposalData {
  instruction?: string | null;
  original: CurriculumCandidate;
  view: CurriculumView;
  baseRevisionId: string;
  diff: RevisionDiff;
  affectedCompletedTopics: string[];
  status: string;
  outdated: boolean;
  origins?: CurriculumTopicOrigin[];
}
export interface RefinementRequest {
  baseRevisionId: string;
  instruction: string;
}
