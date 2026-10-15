import { describe, expect, it } from "vitest";
import {
  APPROVED_GENERATOR_DEFAULTS,
  approvedProfileDefaults,
  buildRoadmapRequest,
  createBlankProfile,
  deriveProfileDefaults,
  isHttpUrl,
  validateProfile,
  type GeneratorProfile,
} from "../generatorProfile";

function profile(overrides: Partial<GeneratorProfile> = {}): GeneratorProfile {
  return {
    title: "My roadmap",
    goal: "Learn to build a small API",
    level: "intermediate",
    outcome: "Deploy one tested endpoint",
    knownSkills: ["Python", "HTTP"],
    background: "Some scripting experience",
    referenceUrl: "",
    sampleTemplateRef: "",
    hoursPerWeek: "6",
    durationWeeks: "8",
    ...overrides,
  };
}

describe("generator profile defaults (LSI-021)", () => {
  it("seeds a blank profile from the approved defaults", () => {
    const blank = createBlankProfile();
    expect(blank.goal).toBe("");
    expect(blank.level).toBe(APPROVED_GENERATOR_DEFAULTS.level);
    expect(blank.hoursPerWeek).toBe(String(APPROVED_GENERATOR_DEFAULTS.hoursPerWeek));
    expect(blank.durationWeeks).toBe(String(APPROVED_GENERATOR_DEFAULTS.durationWeeks));
    expect(blank.sampleTemplateRef).toBe("");
  });

  it("applies stored preferences but rejects out-of-bounds or fractional values", () => {
    expect(approvedProfileDefaults({ hoursPerWeek: 10, durationWeeks: 12 })).toEqual({
      level: "beginner",
      hoursPerWeek: 10,
      durationWeeks: 12,
    });
    expect(approvedProfileDefaults({ hoursPerWeek: 999, durationWeeks: 0 })).toEqual({
      level: "beginner",
      hoursPerWeek: APPROVED_GENERATOR_DEFAULTS.hoursPerWeek,
      durationWeeks: APPROVED_GENERATOR_DEFAULTS.durationWeeks,
    });
    // 3.25 hours is not a half-hour step, so the approved default is kept.
    expect(approvedProfileDefaults({ hoursPerWeek: 3.25 }).hoursPerWeek).toBe(
      APPROVED_GENERATOR_DEFAULTS.hoursPerWeek,
    );
    expect(approvedProfileDefaults({ level: "advanced" }).level).toBe("advanced");
  });
});

describe("generator profile validation bounds (LSI-021)", () => {
  it("accepts a fully specified profile", () => {
    expect(validateProfile(profile())).toEqual({ valid: true, errors: {} });
  });

  it("bounds the goal length", () => {
    expect(validateProfile(profile({ goal: "too short" })).errors.goal).toBeDefined();
    expect(
      validateProfile(profile({ goal: "a".repeat(8001) })).errors.goal,
    ).toBeDefined();
  });

  it("bounds optional text fields", () => {
    const errors = validateProfile(
      profile({
        title: "t".repeat(181),
        outcome: "o".repeat(2001),
        background: "b".repeat(4001),
      }),
    ).errors;
    expect(errors.title).toBeDefined();
    expect(errors.outcome).toBeDefined();
    expect(errors.background).toBeDefined();
  });

  it("validates the optional reference URL with the public-URL guard", () => {
    expect(
      validateProfile(profile({ referenceUrl: "not-a-url" })).errors.referenceUrl,
    ).toBeDefined();
    expect(
      validateProfile(profile({ referenceUrl: "https://user:pass@example.com" }))
        .errors.referenceUrl,
    ).toBeDefined();
    expect(
      validateProfile(profile({ referenceUrl: "https://example.com/syllabus" }))
        .errors.referenceUrl,
    ).toBeUndefined();
  });

  it("bounds known skills by count and label length", () => {
    const tooMany = validateProfile(
      profile({ knownSkills: Array.from({ length: 51 }, (_, i) => `skill ${i}`) }),
    );
    expect(tooMany.errors.knownSkills).toBeDefined();
    const tooLong = validateProfile(profile({ knownSkills: ["s".repeat(121)] }));
    expect(tooLong.errors.knownSkills).toBeDefined();
  });

  it("enforces hours per week and whole-week duration bounds", () => {
    expect(
      validateProfile(profile({ hoursPerWeek: "0" })).errors.hoursPerWeek,
    ).toBeDefined();
    expect(
      validateProfile(profile({ hoursPerWeek: "81" })).errors.hoursPerWeek,
    ).toBeDefined();
    expect(
      validateProfile(profile({ hoursPerWeek: "3.25" })).errors.hoursPerWeek,
    ).toBeDefined();
    expect(
      validateProfile(profile({ hoursPerWeek: "3.5" })).errors.hoursPerWeek,
    ).toBeUndefined();
    expect(
      validateProfile(profile({ durationWeeks: "8.5" })).errors.durationWeeks,
    ).toBeDefined();
    expect(
      validateProfile(profile({ durationWeeks: "105" })).errors.durationWeeks,
    ).toBeDefined();
  });

  it("treats blank optional numbers as unset", () => {
    expect(
      validateProfile(profile({ hoursPerWeek: "", durationWeeks: "" })).valid,
    ).toBe(true);
  });
});

describe("generator profile to request mapping (LSI-021)", () => {
  it("maps every LSI-020 extension field onto the request", () => {
    const request = buildRoadmapRequest(
      profile({
        referenceUrl: "https://example.com/syllabus",
        sampleTemplateRef: "roadmap-sql-queries@2026-10-14.1",
      }),
    );
    expect(request).toEqual({
      title: "My roadmap",
      prompt: "Learn to build a small API",
      level: "intermediate",
      background: "Some scripting experience",
      outcome: "Deploy one tested endpoint",
      knownSkills: ["Python", "HTTP"],
      referenceUrl: "https://example.com/syllabus",
      sampleTemplateRef: "roadmap-sql-queries@2026-10-14.1",
      duration: { value: 8, unit: "weeks" },
      hoursPerWeek: 6,
    });
  });

  it("omits unset optional fields so real generation needs no sample", () => {
    const request = buildRoadmapRequest(
      profile({
        title: "",
        outcome: "",
        background: "",
        referenceUrl: "",
        sampleTemplateRef: "",
        hoursPerWeek: "",
        durationWeeks: "",
        knownSkills: [" Python ", "", "HTTP"],
      }),
    );
    expect(request.title).toBeNull();
    expect(request.outcome).toBeNull();
    expect(request.background).toBeNull();
    expect(request.referenceUrl).toBeNull();
    expect(request.sampleTemplateRef).toBeNull();
    expect(request.hoursPerWeek).toBeNull();
    expect(request.duration).toBeNull();
    expect(request.knownSkills).toEqual(["Python", "HTTP"]);
  });
});

describe("generator profile derived defaults (LSI-021)", () => {
  it("derives a title and outcome from the goal without clobbering edits", () => {
    const derived = deriveProfileDefaults(
      profile({ goal: "I want to learn to build an API", title: "", outcome: "" }),
    );
    expect(derived.title).toBe("Learn to build an API");
    expect(derived.outcome).toBe("Be able to build an API");

    const kept = deriveProfileDefaults(
      profile({ goal: "I want to learn to build an API", title: "Mine", outcome: "Mine" }),
    );
    expect(kept.title).toBe("Mine");
    expect(kept.outcome).toBe("Mine");
  });

  it("guards public URL shapes", () => {
    expect(isHttpUrl("https://example.com")).toBe(true);
    expect(isHttpUrl("http://example.com")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("/relative")).toBe(false);
    expect(isHttpUrl("ftp://example.com")).toBe(false);
  });
});
