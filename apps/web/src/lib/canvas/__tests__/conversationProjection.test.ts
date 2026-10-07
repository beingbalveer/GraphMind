import { describe, expect, it } from "vitest";
import type { ConversationTree, TreeNode } from "@graphmind/shared";
import { filterConversationByTime, projectConversation } from "../conversationProjection";

const message = (id: string, parentId: string | null, childrenIds: string[], highlightedContext?: string): TreeNode =>
  ({ id, parentId, childrenIds, highlightedContext, role: "assistant", content: id,
    createdAt: "2026-10-07T00:00:00Z" });

function conversation(): ConversationTree {
  return { id: "w", rootNodeId: "r", activeNodeId: "y", createdAt: "", updatedAt: "",
    nodes: { r: message("r", null, ["a"]), a: message("a", "r", ["b", "x"]),
      b: message("b", "a", []), x: message("x", "a", ["y"], "branch"),
      y: message("y", "x", [], "nested") } };
}

describe("conversation canvas projection", () => {
  it("keeps nested selection off the central spine and maps true origins", () => {
    const tree = conversation();
    const graph = projectConversation(tree);
    expect(graph.items.filter(i => i.lane === "spine").flatMap(i => i.itemIds)).toEqual(["r", "a", "b"]);
    expect(graph.items.find(i => i.itemIds.includes("x"))?.originId).toBe("a");
    expect(graph.items.find(i => i.itemIds.includes("y"))?.originId).toBe("x");
    expect(graph.items.flatMap(i => i.itemIds).sort()).toEqual(["a", "b", "r", "x", "y"]);
    expect(projectConversation({ ...tree, activeNodeId: "b" })).toEqual(graph);
    expect(graph.items.find(i => i.itemIds.includes("x"))?.parentId).toBe("segment:r");
    expect(graph.items.find(i => i.itemIds.includes("y"))?.parentId).toBe("segment:x");
    expect(graph.items.find(i => i.id === "segment:r")?.selectionId).toBe("a");
  });

  it("ignores missing child IDs and stops cycles without duplicating messages", () => {
    const tree = conversation();
    tree.nodes.a.childrenIds.push("missing", "x");
    tree.nodes.b.childrenIds.push("r");
    tree.nodes.y.childrenIds.push("x");
    expect(projectConversation(tree).items.flatMap(i => i.itemIds).sort()).toEqual(["a", "b", "r", "x", "y"]);
  });

  it("has stable IDs while assistant content streams", () => {
    const tree = conversation();
    const before = projectConversation(tree);
    tree.nodes.b.content = "A growing explanation of this topic";
    const after = projectConversation(tree);
    expect(after.items.map(i => [i.id, i.parentId, i.originId, i.itemIds])).toEqual(
      before.items.map(i => [i.id, i.parentId, i.originId, i.itemIds]));
    expect(after.links).toEqual(before.links);
    expect(after.items.find(i => i.selectionId === "b")?.summary).toContain("growing explanation");
  });

  it("returns an empty graph for an absent root", () => {
    const tree = conversation();
    delete tree.nodes.r;
    expect(projectConversation(tree)).toEqual({ items: [], links: [] });
  });

  it("shows clean prose excerpts instead of Markdown formatting markers", () => {
    const tree = conversation();
    tree.nodes.x.content = "**Prioritization** with [a source](https://example.com).";
    expect(projectConversation(tree).items.find(i => i.selectionId === "x")?.summary)
      .toBe("Prioritization with a source.");
  });

  it("retains undated messages and their full ancestor chain in timeline replay", () => {
    const tree = conversation();
    tree.nodes.a.createdAt = "2026-10-09T00:00:00Z";
    tree.nodes.x.createdAt = "invalid";
    tree.nodes.y.createdAt = "2026-10-10T00:00:00Z";
    tree.nodes.b.createdAt = "2026-10-10T00:00:00Z";
    const filtered = filterConversationByTime(tree, "2026-10-08T00:00:00Z");
    expect(Object.keys(filtered.nodes).sort()).toEqual(["a", "r", "x"]);
    expect(filtered.nodes.x).toBe(tree.nodes.x);
    expect(projectConversation(filtered).items.flatMap(i => i.itemIds).sort()).toEqual(["a", "r", "x"]);
    expect(filterConversationByTime(tree, "invalid")).toBe(tree);
  });
});
