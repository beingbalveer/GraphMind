import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

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

afterEach(() => cleanup());
