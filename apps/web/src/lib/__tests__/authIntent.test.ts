import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PENDING_INTENT_STORAGE_KEY,
  PENDING_INTENT_STORED_EVENT,
  PENDING_INTENT_TTL_MS,
  clearPendingIntent,
  consumePendingIntent,
  isIntentExpired,
  isPendingIntent,
  parsePendingIntent,
  readPendingIntent,
  storePendingIntent,
  subscribePendingIntentStored,
  type PendingIntent,
} from "../authIntent";

beforeEach(() => {
  window.localStorage.clear();
});

const SAVE_INPUT = {
  kind: "save" as const,
  templateId: "tmpl-python",
  slug: "python-backend",
  snapshotVersion: "2026-10-15.1",
  title: "Python Backend",
};

const rawIntent = (overrides: Record<string, unknown> = {}) => ({
  kind: "save",
  templateId: "tmpl-python",
  slug: "python-backend",
  snapshotVersion: "2026-10-15.1",
  createdAt: 1_000,
  expiresAt: 2_000,
  readingRatio: null,
  ...overrides,
});

describe("authIntent store (LSI-032)", () => {
  it("stores one intent with fresh expiry and reads it back", () => {
    const stored = storePendingIntent(SAVE_INPUT, 5_000);
    expect(stored).not.toBeNull();
    expect(stored?.kind).toBe("save");
    expect(stored?.expiresAt).toBe(5_000 + PENDING_INTENT_TTL_MS);

    const read = readPendingIntent(5_000);
    expect(read).toEqual(stored);
    expect(read && "title" in read && read.title).toBe("Python Backend");
  });

  it("broadcasts a stored intent so a signed-in resumer can act", () => {
    const listener = vi.fn();
    const unsubscribe = subscribePendingIntentStored(listener);
    storePendingIntent(SAVE_INPUT, 5_000);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    storePendingIntent(SAVE_INPUT, 5_000);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(PENDING_INTENT_STORED_EVENT).toBe("graphmind:pending-auth-intent");
  });

  it("rejects a forged or unknown intent payload", () => {
    expect(parsePendingIntent({ kind: "bogus" }, 1_500)).toBeNull();
    expect(parsePendingIntent(null, 1_500)).toBeNull();
    expect(parsePendingIntent("save", 1_500)).toBeNull();
    // A save must carry the full snapshot identity.
    expect(
      parsePendingIntent(rawIntent({ templateId: undefined }), 1_500),
    ).toBeNull();
    // A topic intent must carry the topic.
    expect(
      parsePendingIntent(rawIntent({ kind: "practice" }), 1_500),
    ).toBeNull();
    // Malformed timestamps are refused.
    expect(parsePendingIntent(rawIntent({ expiresAt: "soon" }), 1_500)).toBeNull();
  });

  it("accepts a partial sign-in/generator intent but not an expired one", () => {
    const signin = parsePendingIntent(
      { kind: "signin", createdAt: 1_000, expiresAt: 2_000 },
      1_500,
    );
    expect(signin?.kind).toBe("signin");
    expect(parsePendingIntent({ kind: "generator", createdAt: 1, expiresAt: 10 }, 50)).toBeNull();
  });

  it("treats an expired intent as absent and clears it from storage", () => {
    storePendingIntent(SAVE_INPUT, 5_000);
    const future = 5_000 + PENDING_INTENT_TTL_MS + 1;
    expect(readPendingIntent(future)).toBeNull();
    expect(window.localStorage.getItem(PENDING_INTENT_STORAGE_KEY)).toBeNull();
  });

  it("drops a corrupt payload without throwing", () => {
    window.localStorage.setItem(PENDING_INTENT_STORAGE_KEY, "{not json");
    expect(readPendingIntent(1_500)).toBeNull();
    expect(window.localStorage.getItem(PENDING_INTENT_STORAGE_KEY)).toBeNull();
  });

  it("consumes exactly once (duplicate callback finds nothing)", () => {
    storePendingIntent(SAVE_INPUT, 5_000);
    const first = consumePendingIntent(5_001);
    expect(first?.kind).toBe("save");
    expect(consumePendingIntent(5_001)).toBeNull();
    expect(window.localStorage.getItem(PENDING_INTENT_STORAGE_KEY)).toBeNull();
  });

  it("clearPendingIntent removes a stored intent (dismissal, no writes)", () => {
    storePendingIntent(SAVE_INPUT, 5_000);
    clearPendingIntent();
    expect(readPendingIntent(5_000)).toBeNull();
  });

  it("guards a held value, expiry, and structural checks", () => {
    const stored = storePendingIntent(SAVE_INPUT, 5_000) as PendingIntent;
    expect(isPendingIntent(stored, 5_000)).toBe(true);
    expect(isIntentExpired(stored, 5_000)).toBe(false);
    expect(isIntentExpired(stored, stored.expiresAt + 1)).toBe(true);
  });
});
