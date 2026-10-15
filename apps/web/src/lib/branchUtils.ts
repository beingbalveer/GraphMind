/**
 * @/lib/branchUtils.ts — Lineage and Sibling Branch Utilities for GraphMind.
 *
 * Implements ancestry reconstruction, sibling branch tab discovery, and branch
 * navigation helpers used across Learning Studio and Chat.
 */

import {
  ConversationTree,
  TreeNode,
  getAncestorPath,
  getSiblingSubBranches,
  getBranchLinearLeafNode,
} from "@graphmind/shared";
import type { BreadcrumbStep } from "@/components/chat/BranchBreadcrumbs";

export interface SiblingBranchTab {
  id: string;
  rootId: string;
  leafId: string;
  title: string;
  prompt: string;
  pinned?: boolean;
}

/**
 * Find the active sub-branch root node in a lineage (the last node containing highlightedContext).
 * Returns null if the lineage is entirely along the mainline trunk.
 */
export function getActiveBranchRoot(lineage: TreeNode[]): TreeNode | null {
  for (let i = lineage.length - 1; i >= 0; i--) {
    if (lineage[i].highlightedContext) {
      return lineage[i];
    }
  }
  return null;
}

/**
 * Determine whether a node is located on a branch (has an ancestor with highlightedContext,
 * excluding the tree root).
 */
export function isNodeOnBranch(
  tree: ConversationTree | null | undefined,
  nodeId: string | null | undefined
): boolean {
  if (!tree || !nodeId || !tree.nodes[nodeId]) return false;
  const lineage = getAncestorPath(tree, nodeId);
  return lineage.some(
    (node) => node.id !== tree.rootNodeId && Boolean(node.highlightedContext)
  );
}

/**
 * Derive a clean, human-readable title for a branch root from prompt, title metadata, or quote.
 */
export function deriveBranchTitle(
  rootNode: TreeNode | null | undefined,
  index = 0,
  fallbackContext?: string | null
): string {
  if (!rootNode) return fallbackContext || `Branch ${index + 1}`;

  // 1. Explicit user metadata title
  if (typeof rootNode.metadata?.title === "string" && rootNode.metadata.title.trim()) {
    return rootNode.metadata.title.trim();
  }

  // 2. User prompt intent (e.g. Explain, Code, Compare, etc.)
  const content = rootNode.content?.trim() || "";
  if (content) {
    if (/^Explain\s+"[^"]+"\s+in\s+concise/i.test(content) || /^explain\b/i.test(content)) {
      return "Explain";
    }
    if (/^(show\s+)?code\b/i.test(content) || /^write\s+(the\s+)?code\b/i.test(content)) {
      return "Code";
    }
    if (/^(compare|comparison)\b/i.test(content)) {
      return "Compare";
    }
    if (/^(benchmark|benchmarks|performance)\b/i.test(content)) {
      return "Benchmarks";
    }
    if (/^(summarize|summary)\b/i.test(content)) {
      return "Summary";
    }

    const firstLine = content.split("\n")[0].replace(/^[#>\s*-]+/, "").trim();
    const clean = firstLine.replace(/^["'`]+|["'`]+$/g, "").trim();
    if (clean.length <= 18) {
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    }
  }

  // 3. Highlighted context excerpt
  if (rootNode.highlightedContext?.trim()) {
    const ctx = rootNode.highlightedContext.trim();
    return ctx.length > 24 ? `${ctx.slice(0, 22)}…` : ctx;
  }

  return fallbackContext || `Branch ${index + 1}`;
}

/**
 * Reconstruct an ordered breadcrumb trail from tree root to the active node,
 * surfacing all branch divergence points along the ancestry chain.
 */
export function reconstructBranchBreadcrumbs(
  tree: ConversationTree | null | undefined,
  activeNodeId: string | null | undefined,
  rootLabel = "Main Chat"
): BreadcrumbStep[] {
  if (!tree || !activeNodeId || !tree.nodes[activeNodeId]) return [];

  const lineage = getAncestorPath(tree, activeNodeId);
  if (lineage.length === 0) return [];

  const rootNode = tree.nodes[tree.rootNodeId] || lineage[0];
  const steps: BreadcrumbStep[] = [
    {
      id: rootNode.id,
      leafId: rootNode.id,
      title: rootLabel,
      isRoot: true,
    },
  ];

  let branchCount = 0;
  for (let i = 1; i < lineage.length; i++) {
    const node = lineage[i];
    if (node.highlightedContext) {
      branchCount++;
      const leaf = getBranchLinearLeafNode(tree, node.id);
      const title = deriveBranchTitle(node, branchCount - 1);
      steps.push({
        id: node.id,
        leafId: leaf.id,
        title,
        isRoot: false,
      });
    }
  }

  return steps;
}

/**
 * Discover sibling sub-branches stemming from the same parent context for the active node.
 */
export function getSiblingBranchTabs(
  tree: ConversationTree | null | undefined,
  activeNodeId: string | null | undefined
): SiblingBranchTab[] {
  if (!tree || !activeNodeId || !tree.nodes[activeNodeId]) return [];

  const lineage = getAncestorPath(tree, activeNodeId);
  const activeBranchRoot = getActiveBranchRoot(lineage);
  if (!activeBranchRoot || !activeBranchRoot.parentId) return [];

  const parentNodeId = activeBranchRoot.parentId;
  const siblingRoots = getSiblingSubBranches(
    tree,
    parentNodeId,
    activeBranchRoot.highlightedContext
  );

  if (siblingRoots.length === 0) {
    const leaf = getBranchLinearLeafNode(tree, activeBranchRoot.id);
    return [
      {
        id: activeBranchRoot.id,
        rootId: activeBranchRoot.id,
        leafId: leaf.id,
        title: deriveBranchTitle(activeBranchRoot, 0),
        prompt: activeBranchRoot.content,
        pinned: Boolean(activeBranchRoot.metadata?.pinned),
      },
    ];
  }

  const tabs: SiblingBranchTab[] = siblingRoots.map((root, idx) => {
    const leaf = getBranchLinearLeafNode(tree, root.id);
    return {
      id: root.id,
      rootId: root.id,
      leafId: leaf.id,
      title: deriveBranchTitle(root, idx),
      prompt: root.content,
      pinned: Boolean(root.metadata?.pinned),
    };
  });

  return tabs.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
}
