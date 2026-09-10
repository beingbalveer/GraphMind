// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const uiDir = path.resolve(process.cwd(), "src/components/ui");
const files = readdirSync(uiDir).filter((name) => name.endsWith(".tsx"));
const forbiddenPalette = /\b(?:bg|text|border|ring|stroke|fill)-(?:white|black|zinc|slate|gray|neutral|stone|red|rose|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink)-/;
const forbiddenType = /text-\[(?:[^\]]+)\]/;
const forbiddenSpacing = /\b(?:h|w|p[trblxy]?|m[trblxy]?)-(?:4\.5|7\.5|8\.5|9\.5)\b/;
const forbiddenLiteralColor = /#[0-9a-f]{3,8}\b|rgba?\(/i;

describe("components/ui design contract", () => {
  it.each(files)("keeps %s on semantic colors and standard scales", (name) => {
    const source = readFileSync(path.join(uiDir, name), "utf8");
    expect(source).not.toMatch(forbiddenPalette);
    expect(source).not.toMatch(forbiddenType);
    expect(source).not.toMatch(forbiddenSpacing);
    expect(source).not.toMatch(forbiddenLiteralColor);
  });
});
