import axe from "axe-core";
import { expect } from "vitest";

/**
 * LSI-047 automated accessibility gate.
 *
 * Runs axe-core against a rendered container and fails on any violation.
 *
 * Two rule families are disabled by design and covered by the manual browser
 * checklist in `docs/integration/evidence/LSI-047.md` instead:
 *
 * 1. `color-contrast` needs real layout/paint that jsdom cannot compute.
 * 2. Document-level rules describe a complete HTML document with the app shell
 *    (`lang`, `<title>`, a skip link, and top-level landmarks). The scenes in
 *    `components/ui/__tests__/accessibility.test.tsx` render isolated
 *    components/fragments, so these rules cannot pass against a fragment even
 *    when the real page satisfies them.
 *
 * Everything else (names/roles/labels/aria wiring, duplicate ids, form labels,
 * list structure, etc.) runs at full strength. Pass `disabledRules` for the rare
 * extra rule that depends on unsupported jsdom behavior, and document why at the
 * call site.
 */
const NON_APPLICABLE_RULES = [
  // jsdom limitation.
  "color-contrast",
  // Document/shell-level rules (see note above).
  "bypass",
  "document-title",
  "html-has-lang",
  "landmark-banner-is-top-level",
  "landmark-complementary-is-top-level",
  "landmark-contentinfo-is-top-level",
  "landmark-main-is-top-level",
  "landmark-no-duplicate-banner",
  "landmark-no-duplicate-contentinfo",
  "landmark-no-duplicate-main",
  "landmark-one-main",
  "landmark-unique",
  "page-has-heading-one",
  "region",
];

export async function expectNoA11yViolations(
  container: HTMLElement,
  disabledRules: string[] = [],
): Promise<void> {
  const rules: axe.RunOptions["rules"] = {};
  for (const id of [...NON_APPLICABLE_RULES, ...disabledRules]) {
    rules[id] = { enabled: false };
  }

  const results = await axe.run(container, { rules });
  const summary = results.violations.map(
    (violation) =>
      `${violation.id} (${violation.nodes.length}): ${violation.help} — ${violation.nodes
        .map((node) => node.target.join(" "))
        .join("; ")}`,
  );
  expect(summary).toEqual([]);
}
