/**
 * Pure, testable helpers that render persisted learner preferences (LSI-044)
 * onto the document root.
 *
 * The visible effects are intentionally global and declarative:
 *  - `dark` class toggling for light/dark/system themes
 *  - `data-reading-size` for reading font-scale CSS
 *  - `data-reduced-motion` for the reduced-motion CSS
 *
 * Kept free of React so it can be unit-tested against a fake root element.
 */

import type { Theme, UserPreferences } from "./preferencesApi";

export interface PreferencesTarget {
  classList: { toggle(token: string, force?: boolean): void };
  setAttribute(name: string, value: string): void;
}

/** Resolve whether the resolved theme is dark, honoring the OS preference. */
export function resolveIsDark(theme: Theme, prefersDark: boolean): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return prefersDark;
}

/** Apply a preference set to a document root element. */
export function applyPreferences(
  preferences: Pick<
    UserPreferences,
    "theme" | "readingFontSize" | "reducedMotion"
  >,
  root: PreferencesTarget,
  prefersDark = false,
): void {
  root.classList.toggle("dark", resolveIsDark(preferences.theme, prefersDark));
  root.setAttribute("data-reading-size", preferences.readingFontSize);
  root.setAttribute(
    "data-reduced-motion",
    preferences.reducedMotion ? "true" : "false",
  );
}
