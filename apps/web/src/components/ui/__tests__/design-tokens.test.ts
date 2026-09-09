// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.resolve(process.cwd(), "src/app/globals.css"), "utf8");

describe("GraphMind Calm token contract", () => {
  it.each([
    "--surface-raised:",
    "--foreground-subtle:",
    "--border-strong:",
    "--focus-ring:",
    "--overlay:",
    "--chat-content-max: 44rem",
  ])("defines %s in the theme", (token) => expect(css).toContain(token));

  it("defines every semantic role for dark mode", () => {
    const darkBlock = css.slice(css.indexOf(".dark"));
    for (const token of ["--surface-raised:", "--foreground-subtle:", "--border-strong:", "--focus-ring:", "--overlay:"]) {
      expect(darkBlock).toContain(token);
    }
  });
});
