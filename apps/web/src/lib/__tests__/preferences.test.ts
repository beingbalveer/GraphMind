import { describe, expect, it, vi } from "vitest";
import { applyPreferences, resolveIsDark } from "../applyPreferences";
import {
  DEFAULT_PREFERENCES,
  TUTOR_STYLE_DIRECTIVES,
} from "../preferencesApi";

function fakeRoot() {
  return {
    classList: { toggle: vi.fn() },
    setAttribute: vi.fn(),
  };
}

describe("applyPreferences", () => {
  it("resolves explicit and system themes", () => {
    expect(resolveIsDark("dark", false)).toBe(true);
    expect(resolveIsDark("light", true)).toBe(false);
    expect(resolveIsDark("system", true)).toBe(true);
    expect(resolveIsDark("system", false)).toBe(false);
  });

  it("toggles the dark class and sets reading/motion attributes", () => {
    const root = fakeRoot();
    applyPreferences(
      { theme: "dark", readingFontSize: "lg", reducedMotion: true },
      root,
      false,
    );
    expect(root.classList.toggle).toHaveBeenCalledWith("dark", true);
    expect(root.setAttribute).toHaveBeenCalledWith("data-reading-size", "lg");
    expect(root.setAttribute).toHaveBeenCalledWith("data-reduced-motion", "true");
  });

  it("follows the OS preference for the system theme", () => {
    const root = fakeRoot();
    applyPreferences(
      { theme: "system", readingFontSize: "md", reducedMotion: false },
      root,
      true,
    );
    expect(root.classList.toggle).toHaveBeenCalledWith("dark", true);
    expect(root.setAttribute).toHaveBeenCalledWith("data-reduced-motion", "false");
  });

  it("exposes approved defaults and a directive for every tutor style", () => {
    expect(DEFAULT_PREFERENCES.theme).toBe("system");
    expect(DEFAULT_PREFERENCES.readingFontSize).toBe("md");
    expect(DEFAULT_PREFERENCES.reducedMotion).toBe(false);
    expect(DEFAULT_PREFERENCES.defaultStudyHours).toBe(4);
    expect(Object.keys(TUTOR_STYLE_DIRECTIVES).sort()).toEqual([
      "concise",
      "detailed",
      "socratic",
    ]);
  });
});
