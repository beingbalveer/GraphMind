import { describe, it, expect } from "vitest";
import {
  createConversationTree,
  addChildNode,
  updateNodeContent,
  getAncestorPath,
  getNodeChildren,
  getSiblingNodes,
  pruneSubtree,
  getAllLeafNodes,
  getSiblingSubBranches,
  getBranchLeafNode,
} from "../src/tree-utils";

describe("ConversationTree Utilities", () => {
  it("creates a fresh conversation tree with a root node", () => {
    const tree = createConversationTree({
      role: "user",
      content: "Explain asynchronous Python.",
    });

    expect(tree.id).toBeDefined();
    expect(tree.rootNodeId).toBeDefined();
    expect(tree.activeNodeId).toBe(tree.rootNodeId);
    expect(tree.nodes[tree.rootNodeId]).toBeDefined();
    expect(tree.nodes[tree.rootNodeId].content).toBe("Explain asynchronous Python.");
    expect(tree.nodes[tree.rootNodeId].parentId).toBeNull();
    expect(tree.nodes[tree.rootNodeId].childrenIds).toEqual([]);
  });

  it("immutably adds child branch nodes to a parent", () => {
    const initialTree = createConversationTree({
      role: "user",
      content: "What is GraphMind?",
    });

    const rootId = initialTree.rootNodeId;
    const { tree: treeWithAnswer, node: answerNode } = addChildNode(initialTree, {
      parentId: rootId,
      role: "assistant",
      content: "GraphMind is a graph-first knowledge workspace.",
      model: "gemini-2.5-flash",
    });

    expect(treeWithAnswer.nodes[rootId].childrenIds).toContain(answerNode.id);
    expect(treeWithAnswer.nodes[answerNode.id].parentId).toBe(rootId);
    expect(treeWithAnswer.activeNodeId).toBe(answerNode.id);
    // Immutability check: initialTree must not have been mutated
    expect(initialTree.nodes[rootId].childrenIds).toEqual([]);
  });

  it("creates multiple parallel branches from the same parent", () => {
    const tree0 = createConversationTree({
      role: "user",
      content: "Python Data Structures",
    });
    const rootId = tree0.rootNodeId;

    const { tree: tree1, node: respNode } = addChildNode(tree0, {
      parentId: rootId,
      role: "assistant",
      content: "Python has Lists, Tuples, Dicts, Sets.",
    });

    // Branch 1: Ask about Dicts
    const { tree: tree2, node: branch1 } = addChildNode(tree1, {
      parentId: respNode.id,
      role: "user",
      content: "How do hash tables in dicts work?",
      highlightedContext: "Dicts",
    });

    // Branch 2: Ask about Sets
    const { tree: tree3, node: branch2 } = addChildNode(tree2, {
      parentId: respNode.id,
      role: "user",
      content: "What are set operations and complexity?",
      highlightedContext: "Sets",
    });

    expect(tree3.nodes[respNode.id].childrenIds).toHaveLength(2);
    expect(tree3.nodes[respNode.id].childrenIds).toContain(branch1.id);
    expect(tree3.nodes[respNode.id].childrenIds).toContain(branch2.id);

    const siblingsOfBranch1 = getSiblingNodes(tree3, branch1.id);
    expect(siblingsOfBranch1).toHaveLength(1);
    expect(siblingsOfBranch1[0].id).toBe(branch2.id);

    const childrenOfResp = getNodeChildren(tree3, respNode.id);
    expect(childrenOfResp).toHaveLength(2);
  });

  it("resolves ancestor path from root to target branch", () => {
    const tree0 = createConversationTree({
      role: "user",
      content: "Root question",
    });
    const rootId = tree0.rootNodeId;

    const { tree: tree1, node: resp1 } = addChildNode(tree0, {
      parentId: rootId,
      role: "assistant",
      content: "Root answer",
    });

    const { tree: tree2, node: subPrompt } = addChildNode(tree1, {
      parentId: resp1.id,
      role: "user",
      content: "Sub question",
    });

    const { tree: tree3, node: subAnswer } = addChildNode(tree2, {
      parentId: subPrompt.id,
      role: "assistant",
      content: "Sub answer",
    });

    const path = getAncestorPath(tree3, subAnswer.id);
    expect(path).toHaveLength(4);
    expect(path.map((n) => n.id)).toEqual([rootId, resp1.id, subPrompt.id, subAnswer.id]);
  });

  it("updates node content immutably", () => {
    const tree0 = createConversationTree({
      role: "user",
      content: "Initial text",
    });
    const rootId = tree0.rootNodeId;

    const updated = updateNodeContent(tree0, rootId, "Updated streaming text...");
    expect(updated.nodes[rootId].content).toBe("Updated streaming text...");
    expect(tree0.nodes[rootId].content).toBe("Initial text");
  });

  it("recursively prunes subtree and adjusts parent children list", () => {
    const tree0 = createConversationTree({
      role: "user",
      content: "Root",
    });
    const rootId = tree0.rootNodeId;

    const { tree: tree1, node: resp } = addChildNode(tree0, {
      parentId: rootId,
      role: "assistant",
      content: "Answer",
    });

    const { tree: tree2, node: branchA } = addChildNode(tree1, {
      parentId: resp.id,
      role: "user",
      content: "Branch A",
    });

    const { tree: tree3, node: branchADescendant } = addChildNode(tree2, {
      parentId: branchA.id,
      role: "assistant",
      content: "Branch A child",
    });

    const { tree: tree4, node: branchB } = addChildNode(tree3, {
      parentId: resp.id,
      role: "user",
      content: "Branch B",
    });

    // Prune branchA and all its descendants
    const prunedTree = pruneSubtree(tree4, branchA.id);

    expect(prunedTree.nodes[branchA.id]).toBeUndefined();
    expect(prunedTree.nodes[branchADescendant.id]).toBeUndefined();
    expect(prunedTree.nodes[resp.id].childrenIds).toEqual([branchB.id]);
    expect(prunedTree.nodes[branchB.id]).toBeDefined();
  });

  it("extracts all leaf nodes from a branching tree", () => {
    const tree0 = createConversationTree({
      role: "user",
      content: "Root",
    });
    const rootId = tree0.rootNodeId;

    const { tree: tree1, node: resp } = addChildNode(tree0, {
      parentId: rootId,
      role: "assistant",
      content: "Answer",
    });

    const { tree: tree2, node: branch1 } = addChildNode(tree1, {
      parentId: resp.id,
      role: "user",
      content: "Branch 1",
    });

    const { tree: tree3, node: branch2 } = addChildNode(tree2, {
      parentId: resp.id,
      role: "user",
      content: "Branch 2",
    });

    const leaves = getAllLeafNodes(tree3);
    expect(leaves).toHaveLength(2);
    expect(leaves.map((l) => l.id)).toContain(branch1.id);
    expect(leaves.map((l) => l.id)).toContain(branch2.id);
  });

  it("stress tests deep 20-level lineage chains without stack overflow", () => {
    let currentTree = createConversationTree({
      role: "user",
      content: "Level 0 Root",
    });
    let currentParentId = currentTree.rootNodeId;

    for (let i = 1; i <= 20; i++) {
      const { tree, node } = addChildNode(currentTree, {
        parentId: currentParentId,
        role: i % 2 === 1 ? "assistant" : "user",
        content: `Node at level ${i}`,
      });
      currentTree = tree;
      currentParentId = node.id;
    }

    const path = getAncestorPath(currentTree, currentParentId);
    expect(path).toHaveLength(21); // Root (0) + 20 levels
    expect(path[0].content).toBe("Level 0 Root");
    expect(path[20].content).toBe("Node at level 20");
  });

  it("handles 10 parallel sibling branches from a single node", () => {
    const tree0 = createConversationTree({
      role: "user",
      content: "Architecture Topics",
    });
    const rootId = tree0.rootNodeId;

    let tree = tree0;
    const branchIds: string[] = [];

    for (let i = 1; i <= 10; i++) {
      const { tree: updatedTree, node } = addChildNode(tree, {
        parentId: rootId,
        role: "assistant",
        content: `Architecture Branch ${i}`,
        highlightedContext: `Topic ${i}`,
      });
      tree = updatedTree;
      branchIds.push(node.id);
    }

    const children = getNodeChildren(tree, rootId);
    expect(children).toHaveLength(10);
    expect(children.map((c) => c.id)).toEqual(branchIds);

    const siblings = getSiblingNodes(tree, branchIds[0]);
    expect(siblings).toHaveLength(9);
  });

  it("recovers activeNodeId safely to parent when active node is pruned", () => {
    const tree0 = createConversationTree({
      role: "user",
      content: "Root",
    });

    const { tree: tree1, node: branchA } = addChildNode(tree0, {
      parentId: tree0.rootNodeId,
      role: "assistant",
      content: "Branch A",
    });

    // Active node is currently branchA
    expect(tree1.activeNodeId).toBe(branchA.id);

    // Prune branchA
    const pruned = pruneSubtree(tree1, branchA.id);

    // activeNodeId should safely fallback to root
    expect(pruned.activeNodeId).toBe(tree0.rootNodeId);
    expect(pruned.nodes[branchA.id]).toBeUndefined();
  });

  it("retrieves sibling sub-branches matching highlighted context", () => {
    const tree0 = createConversationTree({
      role: "user",
      content: "Main query",
    });
    const rootId = tree0.rootNodeId;

    const { tree: tree1, node: node1 } = addChildNode(tree0, {
      parentId: rootId,
      role: "user",
      content: "Explain Raft",
      highlightedContext: "Raft",
    });

    const { tree: tree2, node: node2 } = addChildNode(tree1, {
      parentId: rootId,
      role: "user",
      content: "Raft Code Example",
      highlightedContext: "Raft",
    });

    const { tree: tree3 } = addChildNode(tree2, {
      parentId: rootId,
      role: "user",
      content: "Explain Paxos",
      highlightedContext: "Paxos",
    });

    const raftBranches = getSiblingSubBranches(tree3, rootId, "Raft");
    expect(raftBranches).toHaveLength(2);
    expect(raftBranches.map((b) => b.id)).toEqual([node1.id, node2.id]);

    const leafOfNode1 = getBranchLeafNode(tree3, node1.id);
    expect(leafOfNode1.id).toBe(node1.id);
  });
});
