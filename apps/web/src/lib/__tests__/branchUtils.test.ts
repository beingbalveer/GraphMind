import { describe, it, expect } from "vitest";
import {
  createConversationTree,
  addChildNode,
  ConversationTree,
} from "@graphmind/shared";
import {
  reconstructBranchBreadcrumbs,
  getSiblingBranchTabs,
  isNodeOnBranch,
  getActiveBranchRoot,
  deriveBranchTitle,
} from "../branchUtils";
import {
  buildBranchUrl,
  buildNodeUrl,
  buildPublicLessonUrl,
  stripBranchParams,
  parseBranchNavigation,
} from "../urls";

describe("Branch Lineage & Sibling Utilities (LSI-016)", () => {
  function createSampleTree(): {
    tree: ConversationTree;
    rootId: string;
    ans1Id: string;
    branch1Id: string;
    branch1ReplyId: string;
    branch2Id: string;
    subBranchId: string;
  } {
    // 1. Root prompt + assistant response
    let tree = createConversationTree({
      role: "user",
      content: "Explain asynchronous generators in Python",
    });
    const rootId = tree.rootNodeId;

    const { tree: t1, node: ans1Node } = addChildNode(tree, {
      parentId: rootId,
      role: "assistant",
      content: "Async generators use `async def` and `yield` to yield items asynchronously.",
    });
    tree = t1;
    const ans1Id = ans1Node.id;

    // 2. Branch 1: Branch off ans1 with quote
    const { tree: t2, node: b1Node } = addChildNode(tree, {
      parentId: ans1Id,
      role: "user",
      content: "Explain `yield` inside an async generator in detail",
      highlightedContext: "`yield` to yield items asynchronously",
    });
    tree = t2;
    const branch1Id = b1Node.id;

    const { tree: t3, node: b1ReplyNode } = addChildNode(tree, {
      parentId: branch1Id,
      role: "assistant",
      content: "In an async generator, `yield` suspends the generator until `anext()` is awaited.",
    });
    tree = t3;
    const branch1ReplyId = b1ReplyNode.id;

    // 3. Sibling Branch 2: Branch off ans1 with same quote
    const { tree: t4, node: b2Node } = addChildNode(tree, {
      parentId: ans1Id,
      role: "user",
      content: "Show code example for async generator",
      highlightedContext: "`yield` to yield items asynchronously",
      metadata: { title: "Code Example" },
    });
    tree = t4;
    const branch2Id = b2Node.id;

    // 4. Nested Sub-Branch: Branch off b1ReplyNode
    const { tree: t5, node: subNode } = addChildNode(tree, {
      parentId: branch1ReplyId,
      role: "user",
      content: "Explain how `anext()` handles `StopAsyncIteration`",
      highlightedContext: "generator until `anext()` is awaited",
    });
    tree = t5;
    const subBranchId = subNode.id;

    return {
      tree,
      rootId,
      ans1Id,
      branch1Id,
      branch1ReplyId,
      branch2Id,
      subBranchId,
    };
  }

  it("identifies whether nodes are on a branch or mainline trunk", () => {
    const { tree, rootId, ans1Id, branch1Id, branch1ReplyId, subBranchId } =
      createSampleTree();

    expect(isNodeOnBranch(tree, rootId)).toBe(false);
    expect(isNodeOnBranch(tree, ans1Id)).toBe(false);
    expect(isNodeOnBranch(tree, branch1Id)).toBe(true);
    expect(isNodeOnBranch(tree, branch1ReplyId)).toBe(true);
    expect(isNodeOnBranch(tree, subBranchId)).toBe(true);
    expect(isNodeOnBranch(tree, "non-existent")).toBe(false);
    expect(isNodeOnBranch(null, rootId)).toBe(false);

    // Active branch root resolution
    const lineage = [tree.nodes[rootId], tree.nodes[ans1Id], tree.nodes[branch1Id]];
    expect(getActiveBranchRoot(lineage)?.id).toBe(branch1Id);
    expect(getActiveBranchRoot([tree.nodes[rootId], tree.nodes[ans1Id]])).toBeNull();
  });

  it("reconstructs branch breadcrumbs with multi-level ancestry", () => {
    const { tree, rootId, branch1ReplyId, subBranchId } = createSampleTree();

    // Mainline node: returns 1 step (Root only)
    const trunkSteps = reconstructBranchBreadcrumbs(tree, rootId, "Topic Tutor");
    expect(trunkSteps).toHaveLength(1);
    expect(trunkSteps[0]).toMatchObject({
      id: rootId,
      leafId: rootId,
      title: "Topic Tutor",
      isRoot: true,
    });

    // Level 1 Branch node: returns 2 steps (Root -> Branch 1)
    const b1Steps = reconstructBranchBreadcrumbs(tree, branch1ReplyId, "Topic Tutor");
    expect(b1Steps).toHaveLength(2);
    expect(b1Steps[0].isRoot).toBe(true);
    expect(b1Steps[1].isRoot).toBe(false);
    expect(b1Steps[1].title).toBe("Explain");

    // Level 2 Nested Branch node: returns 3 steps (Root -> Branch 1 -> Sub-branch)
    const nestedSteps = reconstructBranchBreadcrumbs(tree, subBranchId, "Topic Tutor");
    expect(nestedSteps).toHaveLength(3);
    expect(nestedSteps[0].title).toBe("Topic Tutor");
    expect(nestedSteps[1].title).toBe("Explain");
    expect(nestedSteps[2].title).toBe("Explain");
  });

  it("discovers sibling branch tabs and sorts pinned tabs first", () => {
    const { tree, branch1ReplyId, branch2Id } = createSampleTree();

    // Sibling branches off ans1 with same quote
    const tabs = getSiblingBranchTabs(tree, branch1ReplyId);
    expect(tabs.length).toBeGreaterThanOrEqual(2);

    const b1Tab = tabs.find((t) => t.id === tabs[0].id);
    expect(b1Tab).toBeDefined();

    const b2Tab = tabs.find((t) => t.title === "Code Example");
    expect(b2Tab).toBeDefined();

    // Pinned sibling sort test
    tree.nodes[branch2Id].metadata = {
      ...tree.nodes[branch2Id].metadata,
      pinned: true,
    };
    const pinnedTabs = getSiblingBranchTabs(tree, branch1ReplyId);
    expect(pinnedTabs[0].title).toBe("Code Example");
    expect(pinnedTabs[0].pinned).toBe(true);
  });

  it("derives semantic titles from prompt intent and metadata", () => {
    expect(
      deriveBranchTitle(
        {
          id: "1",
          parentId: null,
          childrenIds: [],
          role: "user",
          content: "Explain recursion in simple terms",
          createdAt: "now",
        },
        0
      )
    ).toBe("Explain");

    expect(
      deriveBranchTitle(
        {
          id: "2",
          parentId: null,
          childrenIds: [],
          role: "user",
          content: "show code for quicksort algorithm",
          createdAt: "now",
        },
        1
      )
    ).toBe("Code");

    expect(
      deriveBranchTitle(
        {
          id: "3",
          parentId: null,
          childrenIds: [],
          role: "user",
          content: "compare merge sort vs quick sort",
          createdAt: "now",
        },
        2
      )
    ).toBe("Compare");

    expect(
      deriveBranchTitle(
        {
          id: "4",
          parentId: null,
          childrenIds: [],
          role: "user",
          content: "benchmarks on memory usage",
          createdAt: "now",
        },
        3
      )
    ).toBe("Benchmarks");
  });
});

describe("Canonical URL Helpers (LSI-016 Contract)", () => {
  it("constructs canonical branch and node URLs with workspace and chat in path", () => {
    const branchUrl = buildBranchUrl("ws_123", "chat_456", "node_leaf_789");
    expect(branchUrl).toBe("/w/ws_123/chat/chat_456?branch=node_leaf_789");

    const nodeUrl = buildNodeUrl("ws_123", "chat_456", "node_highlight_101");
    expect(nodeUrl).toBe("/w/ws_123/chat/chat_456?node=node_highlight_101");

    // Invariant: workspaceId and chatId are in path segments, NOT query params
    expect(branchUrl).not.toContain("workspaceId=");
    expect(branchUrl).not.toContain("chatId=");
    expect(nodeUrl).not.toContain("workspaceId=");
    expect(nodeUrl).not.toContain("chatId=");
  });

  it("constructs public lesson URL with optional branch/node parameters", () => {
    const publicLesson = buildPublicLessonUrl("python-backend", "event-loops");
    expect(publicLesson).toBe("/learn/python-backend/lessons/event-loops");

    const publicWithBranch = buildPublicLessonUrl("python-backend", "event-loops", {
      branch: "leaf_123",
    });
    expect(publicWithBranch).toBe("/learn/python-backend/lessons/event-loops?branch=leaf_123");
  });

  it("strips branch parameters cleanly to retain root URL upon close or back navigation", () => {
    expect(stripBranchParams("/w/ws_1/chat/chat_2?branch=leaf_3")).toBe("/w/ws_1/chat/chat_2");
    expect(stripBranchParams("/w/ws_1/chat/chat_2?node=msg_4")).toBe("/w/ws_1/chat/chat_2");
    expect(
      stripBranchParams("/w/ws_1/chat/chat_2?branch=leaf_3&other=keep")
    ).toBe("/w/ws_1/chat/chat_2?other=keep");
    expect(stripBranchParams("/learn/slug/lessons/topic?branch=b_1")).toBe(
      "/learn/slug/lessons/topic"
    );
  });

  it("parses branch navigation parameters from URLSearchParams", () => {
    const search1 = new URLSearchParams("branch=leaf_42&other=1");
    expect(parseBranchNavigation(search1)).toEqual({
      branchId: "leaf_42",
      nodeId: null,
    });

    const search2 = new URLSearchParams("node=node_99");
    expect(parseBranchNavigation(search2)).toEqual({
      branchId: null,
      nodeId: "node_99",
    });

    expect(parseBranchNavigation(null)).toEqual({
      branchId: null,
      nodeId: null,
    });
  });
});
