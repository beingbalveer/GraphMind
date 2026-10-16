/**
 * @/lib/authIntent.ts — Discriminated, expiring guest → login intents (LSI-032).
 *
 * A guest who tries a private action on a public surface stores one intent and
 * is sent to sign in. After the auth return the client resumes that intent once.
 * An intent carries **only public identities** (public template/slug/version and
 * public topic slug/id) plus the guest's reading context — never a private
 * workspace, roadmap, chat, or session id. The server revalidates the source and
 * authorizes the owner on resume, so a forged or stale payload can never apply
 * partial private state.
 *
 * Intents expire (`PENDING_INTENT_TTL_MS`) and are consumed exactly once: the
 * resume path removes the intent before executing it, so a duplicate callback
 * finds nothing to run and dismissal (clearing the intent) performs no write.
 */

export type IntentKind =
  | "save"
  | "complete"
  | "practice"
  | "tutor"
  | "generator"
  | "signin";

export interface IntentMeta {
  /** Wall-clock creation time (ms). */
  createdAt: number;
  /** Wall-clock expiry (ms). Past it the intent is discarded without executing. */
  expiresAt: number;
  /** Reading position ratio captured on the public lesson, for the private copy. */
  readingRatio: number | null;
}

export interface IntentSnapshot {
  templateId: string;
  slug: string;
  snapshotVersion: string;
}

export interface IntentTopic {
  topicSlug: string;
  topicId: string;
}

export type PendingIntent =
  | ({ kind: "save"; title: string | null } & IntentSnapshot &
      Partial<IntentTopic> &
      IntentMeta)
  | ({ kind: "complete" } & IntentSnapshot & IntentTopic & IntentMeta)
  | ({ kind: "practice" } & IntentSnapshot & IntentTopic & IntentMeta)
  | ({ kind: "tutor"; quote: string | null } & IntentSnapshot &
      IntentTopic &
      IntentMeta)
  | ({ kind: "signin" } & Partial<IntentSnapshot> &
      Partial<IntentTopic> &
      IntentMeta)
  | ({ kind: "generator" } & Partial<IntentSnapshot> &
      Partial<IntentTopic> &
      IntentMeta);

/** Loosely typed input accepted by {@link storePendingIntent}. */
export interface StoreIntentInput {
  kind: IntentKind;
  templateId?: string | null;
  slug?: string | null;
  snapshotVersion?: string | null;
  topicSlug?: string | null;
  topicId?: string | null;
  quote?: string | null;
  readingRatio?: number | null;
  title?: string | null;
}

export const PENDING_INTENT_STORAGE_KEY = "graphmind:pending_auth_intent";
export const PENDING_INTENT_TTL_MS = 30 * 60 * 1000;

/** Fired after an intent is stored, so a signed-in resumer can act immediately. */
export const PENDING_INTENT_STORED_EVENT = "graphmind:pending-auth-intent";

const INTENT_KINDS: readonly IntentKind[] = [
  "save",
  "complete",
  "practice",
  "tutor",
  "generator",
  "signin",
];

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isRatio = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;

function asString(value: unknown): string | null {
  return isNonEmptyString(value) ? value : null;
}

/** True when the intent is past its expiry (or has an invalid timestamp). */
export function isIntentExpired(intent: PendingIntent, now = Date.now()): boolean {
  return !Number.isFinite(intent.expiresAt) || intent.expiresAt <= now;
}

/**
 * Validate an untrusted value (e.g. rehydrated JSON) into a `PendingIntent`.
 *
 * Rejects unknown kinds, missing per-kind context, and malformed fields. Returns
 * `null` instead of throwing, so a forged or partially written payload is simply
 * ignored.
 */
export function parsePendingIntent(
  value: unknown,
  now = Date.now(),
): PendingIntent | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  const kind = raw.kind;
  if (typeof kind !== "string" || !INTENT_KINDS.includes(kind as IntentKind)) {
    return null;
  }

  const createdAt =
    typeof raw.createdAt === "number" && Number.isFinite(raw.createdAt)
      ? raw.createdAt
      : NaN;
  const expiresAt =
    typeof raw.expiresAt === "number" && Number.isFinite(raw.expiresAt)
      ? raw.expiresAt
      : NaN;
  if (!Number.isFinite(createdAt) || !Number.isFinite(expiresAt)) return null;
  if (expiresAt <= now) return null;

  const meta: IntentMeta = {
    createdAt,
    expiresAt,
    readingRatio: isRatio(raw.readingRatio) ? raw.readingRatio : null,
  };

  if (kind === "generator") {
    return { kind, ...meta };
  }

  const templateId = asString(raw.templateId);
  const slug = asString(raw.slug);
  const snapshotVersion = asString(raw.snapshotVersion);
  const topicSlug = asString(raw.topicSlug);
  const topicId = asString(raw.topicId);

  const snapshotRequired = kind !== "signin";
  if (snapshotRequired && (!templateId || !slug || !snapshotVersion)) {
    return null;
  }

  const topicRequired = kind === "complete" || kind === "practice" || kind === "tutor";
  if (topicRequired && (!topicSlug || !topicId)) {
    return null;
  }

  const snapshot: Partial<IntentSnapshot> = {
    ...(templateId ? { templateId } : {}),
    ...(slug ? { slug } : {}),
    ...(snapshotVersion ? { snapshotVersion } : {}),
  };
  const topic: Partial<IntentTopic> = {
    ...(topicSlug ? { topicSlug } : {}),
    ...(topicId ? { topicId } : {}),
  };

  switch (kind) {
    case "save":
      return {
        kind,
        templateId: templateId as string,
        slug: slug as string,
        snapshotVersion: snapshotVersion as string,
        ...topic,
        title: asString(raw.title),
        ...meta,
      };
    case "complete":
      return {
        kind,
        templateId: templateId as string,
        slug: slug as string,
        snapshotVersion: snapshotVersion as string,
        topicSlug: topicSlug as string,
        topicId: topicId as string,
        ...meta,
      };
    case "practice":
      return {
        kind,
        templateId: templateId as string,
        slug: slug as string,
        snapshotVersion: snapshotVersion as string,
        topicSlug: topicSlug as string,
        topicId: topicId as string,
        ...meta,
      };
    case "tutor":
      return {
        kind,
        templateId: templateId as string,
        slug: slug as string,
        snapshotVersion: snapshotVersion as string,
        topicSlug: topicSlug as string,
        topicId: topicId as string,
        quote: asString(raw.quote),
        ...meta,
      };
    case "signin":
      return { kind, ...snapshot, ...topic, ...meta };
    default:
      return null;
  }
}

/** Structural guard used by tests and callers that already hold a value. */
export function isPendingIntent(
  value: unknown,
  now = Date.now(),
): value is PendingIntent {
  return parsePendingIntent(value, now) !== null;
}

/**
 * Persist one intent with fresh timestamps. Returns the stored intent, or `null`
 * when the input cannot form a valid intent (nothing is written).
 */
export function storePendingIntent(
  input: StoreIntentInput,
  now = Date.now(),
): PendingIntent | null {
  if (typeof window === "undefined") return null;
  const stored = parsePendingIntent(
    { ...input, createdAt: now, expiresAt: now + PENDING_INTENT_TTL_MS },
    now,
  );
  if (!stored) return null;
  try {
    window.localStorage.setItem(
      PENDING_INTENT_STORAGE_KEY,
      JSON.stringify(stored),
    );
  } catch {
    return null;
  }
  window.dispatchEvent(new CustomEvent(PENDING_INTENT_STORED_EVENT));
  return stored;
}

/** Subscribe to newly stored intents; returns an unsubscribe function. */
export function subscribePendingIntentStored(
  listener: () => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(PENDING_INTENT_STORED_EVENT, listener);
  return () =>
    window.removeEventListener(PENDING_INTENT_STORED_EVENT, listener);
}

/**
 * Read the stored intent, dropping anything expired or malformed.
 *
 * A dropped intent is removed from storage so a subsequent read cannot retry it.
 */
export function readPendingIntent(now = Date.now()): PendingIntent | null {
  if (typeof window === "undefined") return null;
  let value: unknown;
  try {
    const raw = window.localStorage.getItem(PENDING_INTENT_STORAGE_KEY);
    if (!raw) return null;
    value = JSON.parse(raw);
  } catch {
    clearPendingIntent();
    return null;
  }
  const intent = parsePendingIntent(value, now);
  if (!intent) {
    clearPendingIntent();
    return null;
  }
  return intent;
}

/** Remove the stored intent (dismissal or after it is consumed). */
export function clearPendingIntent(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PENDING_INTENT_STORAGE_KEY);
  } catch {
    // Ignore storage access errors (restricted iframe / private mode).
  }
}

/**
 * Read and remove the stored intent in one step.
 *
 * Clearing before the caller executes makes resumption exactly-once: a duplicate
 * auth callback finds no intent and performs no further action.
 */
export function consumePendingIntent(now = Date.now()): PendingIntent | null {
  const intent = readPendingIntent(now);
  if (intent) clearPendingIntent();
  return intent;
}
