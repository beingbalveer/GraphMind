/**
 * Authenticated learner preferences client (LSI-044).
 *
 * Mirrors the approved server contract in
 * `apps/api/src/schemas/preferences.py`. These values are persisted per account
 * server-side (unlike the browser-local BYOK model in `useModelConfig`); they
 * carry no secrets. `version` enables optimistic-concurrency saves.
 */

import { apiFetch } from "./apiClient";

export type Theme = "light" | "dark" | "system";
export type ReadingFontSize = "sm" | "md" | "lg";
export type TutorStyle = "concise" | "socratic" | "detailed";

export interface UserPreferences {
  theme: Theme;
  readingFontSize: ReadingFontSize;
  reducedMotion: boolean;
  /** Weekly study budget used as the generator default. */
  defaultStudyHours: number;
  tutorStyle: TutorStyle;
  version: number;
  updatedAt: string;
}

export interface UserPreferencesUpdate {
  theme?: Theme;
  readingFontSize?: ReadingFontSize;
  reducedMotion?: boolean;
  defaultStudyHours?: number;
  tutorStyle?: TutorStyle;
  /** Optional optimistic-concurrency token; must match the stored version. */
  version?: number;
}

export const STUDY_HOURS_MIN = 0.5;
export const STUDY_HOURS_MAX = 80;

/** Learner-facing tutor style applied to the tutor system prompt (LSI-044). */
export const TUTOR_STYLE_DIRECTIVES: Record<TutorStyle, string> = {
  concise: "Keep explanations concise and focused, avoiding unnecessary detail.",
  socratic: "Teach Socratically: ask guiding questions before revealing full answers.",
  detailed: "Give thorough, step-by-step explanations with worked examples.",
};

/** Approved defaults, also applied for unauthenticated (guest) browsing. */
export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "system",
  readingFontSize: "md",
  reducedMotion: false,
  defaultStudyHours: 4,
  tutorStyle: "socratic",
  version: 1,
  updatedAt: "",
};

export function getPreferences(): Promise<UserPreferences> {
  return apiFetch<UserPreferences>("/users/me/preferences");
}

export function updatePreferences(
  patch: UserPreferencesUpdate,
): Promise<UserPreferences> {
  return apiFetch<UserPreferences>("/users/me/preferences", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}
