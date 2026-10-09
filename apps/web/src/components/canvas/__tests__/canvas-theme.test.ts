import fs from "node:fs";
import path from "node:path";
import React from "react";
import { render } from "@testing-library/react";
import { it, expect } from "vitest";
import { CanvasCard } from "../CanvasCard";

const css = fs.readFileSync(path.resolve("src/app/globals.css"), "utf8");
const luminance = (hex: string) =>
  [1, 3, 5]
    .map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    )
    .reduce(
      (sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index],
      0,
    );

for (const mode of [":root", ".dark"]) {
  it(`${mode} small card metadata has readable contrast on both card surfaces`, () => {
    const block = css.slice(css.indexOf(`${mode} {`)).split("}")[0];
    const value = (name: string) =>
      block.match(new RegExp(`--${name}: ([^;]+)`))![1];
    const { container } = render(
      React.createElement(CanvasCard, {
        item: {
          id: "topic",
          kind: "topic",
          title: "Readable topic",
          metaLabel: "Core",
          itemIds: ["topic"],
          selectionId: "topic",
          lane: "side",
          parentId: null,
          originId: null,
          order: 0,
        },
        compact: true,
        selected: false,
        streaming: false,
        onSelect: () => {},
      }),
    );
    const role = Array.from(
      container.querySelector(".canvas-card-meta")!.classList,
    )
      .filter((name) => name.startsWith("text-"))
      .map((name) => name.slice(5))
      .find((name) => block.includes(`--${name}:`))!;
    const foreground = luminance(value(role));
    for (const surface of ["canvas-milestone", "canvas-topic"]) {
      const background = luminance(value(surface));
      expect(
        (Math.max(foreground, background) + 0.05) /
          (Math.min(foreground, background) + 0.05),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
}
