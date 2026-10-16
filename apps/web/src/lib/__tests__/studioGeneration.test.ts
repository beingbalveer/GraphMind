import { describe, expect, it } from "vitest";
import {
  EMPTY_JOB_KEY_STATE,
  completedRoadmapTarget,
  nextJobKeyState,
  requestFingerprint,
  resumableJob,
} from "../studioGeneration";
import type { JobSnapshot, RoadmapRequest } from "../roadmapTypes";

const request: RoadmapRequest = {
  title: "API Basics",
  prompt: "I want to learn to build a small API",
  level: "intermediate",
  background: null,
  duration: { value: 8, unit: "weeks" },
  hoursPerWeek: 6,
  outcome: "Deploy one tested endpoint",
  knownSkills: ["Python"],
  referenceUrl: null,
  sampleTemplateRef: null,
};

function job(overrides: Partial<JobSnapshot> = {}): JobSnapshot {
  return {
    id: "job-1",
    operation: "generate",
    title: "API Basics",
    status: "running",
    stage: "research",
    startupReady: true,
    summary: "Researching the path",
    question: null,
    questionCount: 0,
    error: null,
    result: null,
    lastSequence: 3,
    createdAt: "now",
    updatedAt: "now",
    ...overrides,
  };
}

describe("requestFingerprint", () => {
  it("is stable for equal requests and changes with any generator field", () => {
    expect(requestFingerprint(request)).toBe(requestFingerprint({ ...request }));
    expect(requestFingerprint({ ...request, prompt: "different" })).not.toBe(
      requestFingerprint(request),
    );
    expect(requestFingerprint({ ...request, knownSkills: ["Python", "HTTP"] })).not.toBe(
      requestFingerprint(request),
    );
    expect(requestFingerprint({ ...request, outcome: null })).not.toBe(
      requestFingerprint(request),
    );
  });
});

describe("nextJobKeyState", () => {
  it("mints a key once and reuses it for a duplicate submission", () => {
    const first = nextJobKeyState(EMPTY_JOB_KEY_STATE, request, () => "key-1");
    const duplicate = nextJobKeyState(first, { ...request }, () => "key-2");
    expect(first.key).toBe("key-1");
    expect(duplicate.key).toBe("key-1");
    expect(duplicate.acceptedJobId).toBeNull();
  });

  it("mints a new key for a deliberately changed request before acceptance", () => {
    const first = nextJobKeyState(EMPTY_JOB_KEY_STATE, request, () => "key-1");
    const changed = nextJobKeyState(
      first,
      { ...request, prompt: "Learn relational query planning" },
      () => "key-2",
    );
    expect(changed.key).toBe("key-2");
  });

  it("retains the accepted job id and key for every later submission", () => {
    const accepted = {
      ...nextJobKeyState(EMPTY_JOB_KEY_STATE, request, () => "key-1"),
      acceptedJobId: "job-1",
    };
    const resubmit = nextJobKeyState(
      accepted,
      { ...request, prompt: "changed after acceptance" },
      () => "key-2",
    );
    expect(resubmit.key).toBe("key-1");
    expect(resubmit.acceptedJobId).toBe("job-1");
  });
});

describe("completedRoadmapTarget", () => {
  it("stays null until a generation job completes with a published result", () => {
    expect(completedRoadmapTarget(null)).toBeNull();
    expect(completedRoadmapTarget(job())).toBeNull();
    expect(completedRoadmapTarget(job({ status: "failed" }))).toBeNull();
    expect(
      completedRoadmapTarget(
        job({ status: "completed", result: null }),
      ),
    ).toBeNull();
  });

  it("never auto-opens a refinement/promotion proposal", () => {
    expect(
      completedRoadmapTarget(
        job({
          operation: "refine",
          status: "completed",
          result: {
            kind: "proposal",
            proposalState: "candidate",
            workspaceId: "ws-existing",
            roadmapId: "rm-existing",
            revisionId: "rev-proposal",
          },
        }),
      ),
    ).toBeNull();
    expect(
      completedRoadmapTarget(
        job({
          status: "completed",
          result: {
            kind: "proposal",
            proposalState: "candidate",
            workspaceId: "ws-existing",
            roadmapId: "rm-existing",
            revisionId: "rev-proposal",
          },
        }),
      ),
    ).toBeNull();
  });

  it("resolves the actual workspace, roadmap, and revision of a published run", () => {
    expect(
      completedRoadmapTarget(
        job({
          status: "completed",
          result: {
            kind: "published",
            workspaceId: "ws-42",
            roadmapId: "rm-42",
            revisionId: "rev-42",
          },
        }),
      ),
    ).toEqual({
      workspaceId: "ws-42",
      roadmapId: "rm-42",
      revisionId: "rev-42",
    });
  });
});

describe("resumableJob", () => {
  it("picks the newest owned in-flight generation, including awaiting input", () => {
    const running = job({ id: "job-running", status: "running" });
    const awaiting = job({ id: "job-awaiting", status: "awaiting_input" });
    expect(resumableJob([awaiting, running])?.id).toBe("job-awaiting");
    expect(resumableJob([job({ status: "queued" })])?.status).toBe("queued");
    expect(
      resumableJob([job({ status: "cancel_requested" })])?.status,
    ).toBe("cancel_requested");
  });

  it("ignores terminal jobs and non-generation operations", () => {
    expect(resumableJob([])).toBeNull();
    expect(resumableJob([job({ status: "completed" })])).toBeNull();
    expect(resumableJob([job({ status: "failed" })])).toBeNull();
    expect(resumableJob([job({ status: "canceled" })])).toBeNull();
    expect(
      resumableJob([job({ operation: "refine", status: "running" })]),
    ).toBeNull();
  });
});
