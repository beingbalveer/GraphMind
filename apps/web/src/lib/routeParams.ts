/**
 * @/lib/routeParams.ts — helpers for decoding App Router params in client
 * components.
 */

/** Read a single, URI-decoded route param, tolerating the array param shape. */
export function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ? decodeURIComponent(value[0]) : "";
  }
  return value ? decodeURIComponent(value) : "";
}
