/**
 * @/lib/storage.ts — Safe LocalStorage utilities with QuotaExceededError and SSR resilience.
 */

/**
 * Safely retrieve an item from localStorage without throwing exceptions in restricted or SSR environments.
 */
export function safeGetItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.warn(`[Storage] Failed to read "${key}" from localStorage:`, err);
    return null;
  }
}

/**
 * Safely store an item in localStorage.
 * If quota is exceeded (e.g. large conversation trees or file attachments),
 * it recovers gracefully by removing stale entries without crashing the application.
 */
export function safeSetItem(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    // QuotaExceededError or SecurityError (e.g., private browsing or 5MB origin limit)
    console.warn(
      `[Storage] Failed to save "${key}" to localStorage (${(value.length / 1024).toFixed(1)} KB):`,
      err
    );

    // Attempt to remove the failing key to prevent corrupt state
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
    return false;
  }
}

/**
 * Safely remove an item from localStorage.
 */
export function safeRemoveItem(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`[Storage] Failed to remove "${key}" from localStorage:`, err);
  }
}
