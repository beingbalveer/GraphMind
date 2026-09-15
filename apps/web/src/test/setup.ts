import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

if (!window.PointerEvent) {
  window.PointerEvent = window.MouseEvent as typeof window.PointerEvent;
}

afterEach(() => cleanup());
