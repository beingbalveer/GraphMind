// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import { beforeAll, describe, expect, it } from "vitest";

const cssPath = path.resolve("src/app/globals.css");
const source = readFileSync(cssPath, "utf8");
let compiled: postcss.Root;
beforeAll(async () => {
  compiled = (await postcss([tailwindcss()]).process(source, { from: cssPath })).root;
}, 30000);

describe("compiled overlay and keyboard visibility contract", () => {
  it.each(["dropdown", "toast"])("emits a working z-%s utility above modal content", (layer) => {
    let value: string | undefined;
    compiled.walkRules(`.z-${layer}`, (rule) => { rule.walkDecls("z-index", (decl) => { value = decl.value; }); });
    expect(value).toBe(`var(--z-${layer})`);
    const layerValue = Number(source.match(new RegExp(`--z-${layer}: (\\d+)`))?.[1]);
    expect(layerValue).toBeGreaterThan(50);
  });

  it.each(["BranchChatPane", "SidePeekBranchSheet"])("%s reveals the menu wrapper while its trigger has focus", (component) => {
    const consumer = readFileSync(path.resolve(`src/components/chat/${component}.tsx`), "utf8");
    const wrapper = consumer.match(/"opacity-0 group-hover:opacity-100[^"]*"/)?.[0];
    expect(wrapper).toContain("focus-within:opacity-100");
    let focusOpacity: string | undefined;
    compiled.walkRules(".focus-within\\:opacity-100:focus-within", (rule) => {
      rule.walkDecls("opacity", (decl) => { focusOpacity = decl.value; });
    });
    expect(focusOpacity).toBe("100%");
  });
});

type RGB = [number, number, number];
function color(value: string, base: RGB): RGB {
  if (value.startsWith("#")) return [0, 2, 4].map((offset) => parseInt(value.slice(1 + offset, 3 + offset), 16)) as RGB;
  const channels = value.match(/[\d.]+/g)!.map(Number);
  return channels.slice(0, 3).map((channel, i) => channel * channels[3] + base[i] * (1 - channels[3])) as RGB;
}
function luminance(rgb: RGB) {
  return rgb.map((channel) => channel / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((total, value, i) => total + value * [0.2126, 0.7152, 0.0722][i], 0);
}
describe("small status text contrast", () => {
  for (const mode of [":root", ".dark"]) {
    const block = source.slice(source.indexOf(`${mode} {`)).split("}")[0];
    const token = (name: string) => block.match(new RegExp(`--${name}: ([^;]+)`))![1];
    it.each(["success", "warning", "info", "destructive"])(`${mode} %s badge text meets 4.5:1 on its status background`, (status) => {
      // Dark status backgrounds are translucent; verify each supported surface underneath.
      for (const surface of ["background", "surface", "surface-raised", "surface-hover"]) {
        const base = color(token(surface), [0, 0, 0]);
        const foreground = luminance(color(token(status), base));
        const background = luminance(color(token(`${status}-bg`), base));
        expect((Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
