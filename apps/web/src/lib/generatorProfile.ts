/**
 * @/lib/generatorProfile.ts — Learning Studio goal-form mapping and validation.
 *
 * LSI-021: maps the real generator inputs onto the extended `RoadmapRequest`
 * contract approved in LSI-020 (`outcome`, `knownSkills`, `referenceUrl`,
 * `sampleTemplateRef`). Real generation no longer requires a fixed sample; the
 * optional sample-template reference models the clearly separate sample-copy
 * path instead. Bounds mirror the server schema in
 * `apps/api/src/schemas/curriculum.py` so client feedback matches the API.
 */

import type { Duration, LearningLevel, RoadmapRequest } from "./roadmapTypes";

export const GOAL_MIN_LENGTH = 10;
export const GOAL_MAX_LENGTH = 8000;
export const TITLE_MAX_LENGTH = 180;
export const BACKGROUND_MAX_LENGTH = 4000;
export const OUTCOME_MAX_LENGTH = 2000;
export const REFERENCE_URL_MAX_LENGTH = 2048;
export const SAMPLE_REF_MAX_LENGTH = 100;
export const KNOWN_SKILLS_MAX = 50;
export const KNOWN_SKILL_MAX_LENGTH = 120;
export const HOURS_MIN = 0.5;
export const HOURS_MAX = 80;
export const DURATION_WEEKS_MIN = 1;
export const DURATION_WEEKS_MAX = 104;

/** Approved server defaults used when the learner has no stored preference. */
export interface GeneratorPreferences {
  level: LearningLevel;
  hoursPerWeek: number;
  durationWeeks: number;
}

export const APPROVED_GENERATOR_DEFAULTS: GeneratorPreferences = {
  level: "beginner",
  hoursPerWeek: 4,
  durationWeeks: 6,
};

/**
 * The editable goal-form draft. Numeric inputs stay as strings so the learner
 * can clear them; `buildRoadmapRequest` converts them only when non-empty.
 */
export interface GeneratorProfile {
  title: string;
  goal: string;
  level: LearningLevel;
  outcome: string;
  knownSkills: string[];
  background: string;
  referenceUrl: string;
  /** Empty means real generation; a value selects an approved sample copy. */
  sampleTemplateRef: string;
  hoursPerWeek: string;
  durationWeeks: string;
}

export interface SampleTemplateOption {
  /** `template_id@snapshot_version` accepted by the LSI-020 resolver. */
  ref: string;
  id: string;
  title: string;
  summary: string;
}

/**
 * Approved curated sample snapshots (mirrors the LSI-020 backend allowlist until
 * LSI-025 publishes the snapshot table). Used only by the sample-copy path.
 */
export const APPROVED_SAMPLE_TEMPLATES: SampleTemplateOption[] = [
  {
    ref: "roadmap-python-backend@2026-10-14.1",
    id: "roadmap-python-backend",
    title: "Python Backend Engineering",
    summary: "Async FastAPI, Pydantic v2 schemas, and PostgreSQL persistence.",
  },
  {
    ref: "roadmap-web-accessibility@2026-10-14.1",
    id: "roadmap-web-accessibility",
    title: "Web Accessibility",
    summary: "Semantic HTML, keyboard navigation, and assistive-technology support.",
  },
  {
    ref: "roadmap-sql-queries@2026-10-14.1",
    id: "roadmap-sql-queries",
    title: "SQL Queries",
    summary: "Relational modelling, joins, and query plans for everyday analysis.",
  },
];

export interface ProfileFieldErrors {
  goal?: string;
  title?: string;
  outcome?: string;
  knownSkills?: string;
  background?: string;
  referenceUrl?: string;
  sampleTemplateRef?: string;
  hoursPerWeek?: string;
  durationWeeks?: string;
}

export interface ProfileValidation {
  valid: boolean;
  errors: ProfileFieldErrors;
}

function sanitizeHours(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  if (value < HOURS_MIN || value > HOURS_MAX || !isHalfHourStep(value)) {
    return undefined;
  }
  return value;
}

function sanitizeWeeks(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  if (
    !Number.isInteger(value) ||
    value < DURATION_WEEKS_MIN ||
    value > DURATION_WEEKS_MAX
  ) {
    return undefined;
  }
  return value;
}

/** Normalize approved preferences into a valid, bounded default set. */
export function approvedProfileDefaults(
  preferences?: Partial<GeneratorPreferences> | null,
): GeneratorPreferences {
  const hours = sanitizeHours(preferences?.hoursPerWeek);
  const weeks = sanitizeWeeks(preferences?.durationWeeks);
  const level = preferences?.level ?? APPROVED_GENERATOR_DEFAULTS.level;
  return {
    level,
    hoursPerWeek: hours ?? APPROVED_GENERATOR_DEFAULTS.hoursPerWeek,
    durationWeeks: weeks ?? APPROVED_GENERATOR_DEFAULTS.durationWeeks,
  };
}

/** Create a blank, approved-preference-seeded draft. */
export function createBlankProfile(
  preferences?: Partial<GeneratorPreferences> | null,
): GeneratorProfile {
  const defaults = approvedProfileDefaults(preferences);
  return {
    title: "",
    goal: "",
    level: defaults.level,
    outcome: "",
    knownSkills: [],
    background: "",
    referenceUrl: "",
    sampleTemplateRef: "",
    hoursPerWeek: String(defaults.hoursPerWeek),
    durationWeeks: String(defaults.durationWeeks),
  };
}

function isHalfHourStep(value: number): boolean {
  return Number.isInteger(value * 2);
}

/** Mirror the server's public-URL guard for an optional reference URL. */
export function isHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > REFERENCE_URL_MAX_LENGTH) return false;
  try {
    const url = new URL(trimmed);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

/** Auto-derive a title and outcome from the goal without clobbering edits. */
export function deriveProfileDefaults(profile: GeneratorProfile): GeneratorProfile {
  const goal = profile.goal.trim().replace(/[.!?]+$/, "");
  const action = goal.replace(/^i want to /i, "");
  const subject = action.replace(/^(?:learn to|learn|understand)\s+/i, "");
  const capability = subject
    ? `${subject[0].toLowerCase()}${subject.slice(1)}`
    : goal;
  const title =
    profile.title.trim() ||
    `${action[0]?.toUpperCase() ?? ""}${action.slice(1)}`.slice(0, TITLE_MAX_LENGTH);
  const outcome =
    profile.outcome.trim() ||
    `Be able to ${capability}`.slice(0, OUTCOME_MAX_LENGTH);
  return { ...profile, title, outcome };
}

/** Validate every field against the LSI-020 request bounds. */
export function validateProfile(profile: GeneratorProfile): ProfileValidation {
  const errors: ProfileFieldErrors = {};

  const goal = profile.goal.trim();
  if (goal.length < GOAL_MIN_LENGTH) {
    errors.goal = `Describe your goal in at least ${GOAL_MIN_LENGTH} characters.`;
  } else if (goal.length > GOAL_MAX_LENGTH) {
    errors.goal = `Keep your goal within ${GOAL_MAX_LENGTH} characters.`;
  }

  if (profile.title.trim().length > TITLE_MAX_LENGTH) {
    errors.title = `Keep the title within ${TITLE_MAX_LENGTH} characters.`;
  }
  if (profile.outcome.trim().length > OUTCOME_MAX_LENGTH) {
    errors.outcome = `Keep the outcome within ${OUTCOME_MAX_LENGTH} characters.`;
  }
  if (profile.background.trim().length > BACKGROUND_MAX_LENGTH) {
    errors.background = `Keep your background within ${BACKGROUND_MAX_LENGTH} characters.`;
  }

  const reference = profile.referenceUrl.trim();
  if (reference && !isHttpUrl(reference)) {
    errors.referenceUrl =
      reference.length > REFERENCE_URL_MAX_LENGTH
        ? `Keep reference URLs within ${REFERENCE_URL_MAX_LENGTH} characters.`
        : "Use a complete http:// or https:// URL.";
  }

  const sampleRef = profile.sampleTemplateRef.trim();
  if (sampleRef.length > SAMPLE_REF_MAX_LENGTH) {
    errors.sampleTemplateRef = `Keep the sample reference within ${SAMPLE_REF_MAX_LENGTH} characters.`;
  }

  const skills = profile.knownSkills.map((skill) => skill.trim()).filter(Boolean);
  if (skills.length > KNOWN_SKILLS_MAX) {
    errors.knownSkills = `Add at most ${KNOWN_SKILLS_MAX} known skills.`;
  } else if (skills.some((skill) => skill.length > KNOWN_SKILL_MAX_LENGTH)) {
    errors.knownSkills = `Keep each known skill within ${KNOWN_SKILL_MAX_LENGTH} characters.`;
  }

  const hours = profile.hoursPerWeek.trim();
  if (hours) {
    const parsed = Number(hours);
    if (!Number.isFinite(parsed) || parsed < HOURS_MIN || parsed > HOURS_MAX) {
      errors.hoursPerWeek = `Use between ${HOURS_MIN} and ${HOURS_MAX} hours per week.`;
    } else if (!isHalfHourStep(parsed)) {
      errors.hoursPerWeek = "Use half-hour increments for hours per week.";
    }
  }

  const weeks = profile.durationWeeks.trim();
  if (weeks) {
    const parsed = Number(weeks);
    if (
      !Number.isInteger(parsed) ||
      parsed < DURATION_WEEKS_MIN ||
      parsed > DURATION_WEEKS_MAX
    ) {
      errors.durationWeeks = `Use a whole number of weeks from ${DURATION_WEEKS_MIN} to ${DURATION_WEEKS_MAX}.`;
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/** Map the editable draft onto the LSI-020 `RoadmapRequest` contract. */
export function buildRoadmapRequest(profile: GeneratorProfile): RoadmapRequest {
  const weeks = profile.durationWeeks.trim();
  const hours = profile.hoursPerWeek.trim();
  const duration: Duration | null = weeks
    ? { value: Number(weeks), unit: "weeks" }
    : null;
  return {
    title: profile.title.trim() || null,
    prompt: profile.goal.trim(),
    level: profile.level,
    background: profile.background.trim() || null,
    outcome: profile.outcome.trim() || null,
    knownSkills: profile.knownSkills.map((skill) => skill.trim()).filter(Boolean),
    referenceUrl: profile.referenceUrl.trim() || null,
    sampleTemplateRef: profile.sampleTemplateRef.trim() || null,
    duration,
    hoursPerWeek: hours ? Number(hours) : null,
  };
}
