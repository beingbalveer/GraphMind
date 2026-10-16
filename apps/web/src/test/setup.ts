import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom under this Node version exposes no working localStorage (Node's own
// experimental localStorage requires `--localstorage-file`). Provide a real
// in-memory implementation so storage-backed flows are exercised, not silently
// skipped, and clear it after each test so files stay isolated.
if (typeof window !== "undefined" && !window.localStorage) {
  const store = new Map<string, string>();
  const localStorageMock: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => (store.has(key) ? (store.get(key) as string) : null),
    key: (index) => Array.from(store.keys())[index] ?? null,
    removeItem: (key) => {
      store.delete(key);
    },
    setItem: (key, value) => {
      store.set(key, String(value));
    },
  };
  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });
}

if (typeof window !== "undefined" && !window.PointerEvent) {
  window.PointerEvent = window.MouseEvent as typeof window.PointerEvent;
}

// jsdom has no fullscreen or native modal top layer. Its nwsapi selector
// fallback delegates these states back to Element.matches, recursively.
// Model the unsupported states here; real focus, menus and events stay intact.
if (typeof Element !== "undefined") {
  const nativeMatches = Element.prototype.matches;
  Element.prototype.matches = function (selector: string) {
    if (selector === ":fullscreen" || selector === ":modal") return false;
    return nativeMatches.call(this, selector);
  };
}

afterEach(() => {
  cleanup();
  try {
    window.localStorage?.clear();
  } catch {
    // Ignore storage access errors.
  }
});
