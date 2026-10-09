import type { CurriculumView, CurriculumItemData } from "@/lib/roadmapTypes";
import type { CanvasGraph, CanvasLink } from "./types";

export function curriculumChildren(
  view: CurriculumView,
  id: string,
): CurriculumItemData[] {
  const ids = new Set(
    view.candidate.relations
      .filter((r) => r.kind === "contains" && r.sourceId === id)
      .map((r) => r.targetId),
  );
  return view.candidate.items
    .filter((i) => ids.has(i.id) && i.participation === "active")
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}
/** Hierarchical curriculum order; only the selected choice contributes to the core. */
export function selectedCoreTopics(view: CurriculumView): CurriculumItemData[] {
  const result: CurriculumItemData[] = [];
  const visited = new Set<string>();
  const choices = new Map(
    view.candidate.choices.map((c) => [c.choiceId, c.selectedId]),
  );
  function visit(item: CurriculumItemData) {
    if (
      visited.has(item.id) ||
      item.path === "further" ||
      item.participation !== "active"
    )
      return;
    visited.add(item.id);
    if (item.kind === "topic") result.push(item);
    for (const child of curriculumChildren(view, item.id))
      if (item.kind !== "choice" || choices.get(item.id) === child.id)
        visit(child);
  }
  view.candidate.items.filter((i) => i.kind === "root").forEach(visit);
  const rank = new Map(result.map((item, index) => [item.id, index]));
  const remaining = new Set(result.map((i) => i.id));
  const ordered: CurriculumItemData[] = [];
  const dependencies = view.candidate.relations.filter(
    (r) => r.kind === "prerequisite" || r.kind === "recommended_next",
  );
  while (remaining.size) {
    const ready = result
      .filter(
        (i) =>
          remaining.has(i.id) &&
          !dependencies.some(
            (r) => r.targetId === i.id && remaining.has(r.sourceId),
          ),
      )
      .sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
    if (!ready.length) throw new Error("Curriculum prerequisite cycle");
    ordered.push(ready[0]);
    remaining.delete(ready[0].id);
  }
  return ordered;
}
export function projectCurriculum(
  view: CurriculumView,
  expandedIds: Set<string>,
  showAlternatives = false,
): CanvasGraph {
  const graph: CanvasGraph = { items: [], links: [] };
  const visited = new Set<string>();
  let order = 0;
  const choices = new Map(
    view.candidate.choices.map((choice) => [choice.choiceId, choice]),
  );
  const selectedIds = new Set(
    view.candidate.choices.map((choice) => choice.selectedId),
  );
  function visit(
    item: CurriculumItemData,
    parentId: string | null,
    alternative = false,
  ) {
    if (visited.has(item.id) || item.participation !== "active") return;
    visited.add(item.id);
    const spine = item.kind !== "topic";
    graph.items.push({
      id: item.id,
      kind:
        item.kind === "root" || item.kind === "phase"
          ? "milestone"
          : item.kind === "topic"
            ? "topic"
            : "group",
      title: item.title,
      summary: choices.get(item.id)?.rationale ?? item.brief,
      metaLabel: alternative
        ? "Alternative"
        : item.path === "further"
          ? "Further learning"
          : selectedIds.has(item.id)
            ? "Selected path"
            : item.kind === "choice"
              ? "Recommended route"
              : item.kind === "topic"
                ? "Core"
                : undefined,
      itemIds: [item.id],
      selectionId: item.id,
      lane: spine ? "spine" : "side",
      parentId: spine ? null : parentId,
      originId: parentId,
      order: order++,
    });
    if (expandedIds.has(item.id))
      curriculumChildren(view, item.id).forEach((child) => {
        const optional =
          alternative ||
          (item.kind === "choice" &&
            choices.get(item.id)?.selectedId !== child.id);
        if (showAlternatives || !optional) visit(child, item.id, optional);
      });
  }
  view.candidate.items
    .filter((i) => i.kind === "root")
    .forEach((i) => visit(i, null));
  const kinds: Record<string, CanvasLink["kind"]> = {
    contains: "containment",
    prerequisite: "prerequisite",
    recommended_next: "sequence",
    alternative: "alternative",
  };
  graph.links = view.candidate.relations
    .filter((r) => visited.has(r.sourceId) && visited.has(r.targetId))
    .map((r) => ({
      id: `${r.kind}:${r.sourceId}:${r.targetId}`,
      source: r.sourceId,
      target: r.targetId,
      kind: kinds[r.kind],
    }));
  const spine = graph.items.filter((i) => i.lane === "spine");
  for (let i = 1; i < spine.length; i++)
    if (
      !graph.links.some(
        (l) =>
          l.kind === "sequence" &&
          l.source === spine[i - 1].id &&
          l.target === spine[i].id,
      )
    )
      graph.links.push({
        id: `spine:${spine[i].id}`,
        source: spine[i - 1].id,
        target: spine[i].id,
        kind: "sequence",
      });
  return graph;
}

/** Show the roadmap spine and the next core topic's ancestors; future branches stay quiet. */
export function initialCurriculumExpansion(view: CurriculumView): Set<string> {
  const expanded = new Set(
    view.candidate.items
      .filter((i) => i.kind === "root" && i.participation === "active")
      .map((i) => i.id),
  );
  let id = selectedCoreTopics(view).find(
    (i) => view.progress[i.id]?.status !== "completed",
  )?.id;
  const seen = new Set<string>();
  while (id && !seen.has(id)) {
    seen.add(id);
    const parent = view.candidate.relations.find(
      (r) => r.kind === "contains" && r.targetId === id,
    )?.sourceId;
    if (!parent) break;
    expanded.add(parent);
    id = parent;
  }
  return expanded;
}
