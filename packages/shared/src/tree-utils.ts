import {
  TreeNode,
  ConversationTree,
  CreateNodeParams,
  MessageRole,
} from "./index";

/**
 * Generate a random unique ID with an optional prefix.
 */
function generateId(prefix = "node"): string {
  const randomStr = Math.random().toString(36).substring(2, 10);
  const timeStr = Date.now().toString(36);
  return `${prefix}_${timeStr}${randomStr}`;
}

/**
 * Initialize a fresh immutable ConversationTree with a root prompt node.
 */
export function createConversationTree(
  rootParams: CreateNodeParams,
  treeId?: string
): ConversationTree {
  const rootId = rootParams.id || generateId("node");
  const now = new Date().toISOString();

  const rootNode: TreeNode = {
    id: rootId,
    parentId: null,
    childrenIds: [],
    role: rootParams.role,
    content: rootParams.content,
    highlightedContext: rootParams.highlightedContext ?? null,
    provider: rootParams.provider ?? null,
    model: rootParams.model ?? null,
    createdAt: now,
    metadata: rootParams.metadata ?? {},
  };

  const id = treeId || generateId("tree");

  return {
    id,
    rootNodeId: rootId,
    activeNodeId: rootId,
    nodes: {
      [rootId]: rootNode,
    },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Immutably add a child branch node to a ConversationTree and link it to its parent.
 */
export function addChildNode(
  tree: ConversationTree,
  params: CreateNodeParams
): { tree: ConversationTree; node: TreeNode } {
  if (!params.parentId || !tree.nodes[params.parentId]) {
    throw new Error(`Parent node with id "${params.parentId}" does not exist in tree`);
  }

  const childId = params.id || generateId("node");
  const now = new Date().toISOString();
  const parent = tree.nodes[params.parentId];

  const childNode: TreeNode = {
    id: childId,
    parentId: params.parentId,
    childrenIds: [],
    role: params.role,
    content: params.content,
    highlightedContext: params.highlightedContext ?? null,
    provider: params.provider ?? null,
    model: params.model ?? null,
    createdAt: now,
    metadata: params.metadata ?? {},
  };

  const updatedParent: TreeNode = {
    ...parent,
    childrenIds: parent.childrenIds.includes(childId)
      ? parent.childrenIds
      : [...parent.childrenIds, childId],
  };

  const updatedTree: ConversationTree = {
    ...tree,
    activeNodeId: childId,
    nodes: {
      ...tree.nodes,
      [parent.id]: updatedParent,
      [childId]: childNode,
    },
    updatedAt: now,
  };

  return { tree: updatedTree, node: childNode };
}

/**
 * Immutably update the textual content of a specific tree node (e.g. during live token streaming).
 */
export function updateNodeContent(
  tree: ConversationTree,
  nodeId: string,
  content: string,
  metadataUpdate?: Record<string, unknown>
): ConversationTree {
  const node = tree.nodes[nodeId];
  if (!node) {
    throw new Error(`Node with id "${nodeId}" not found in tree`);
  }

  const updatedNode: TreeNode = {
    ...node,
    content,
    metadata: metadataUpdate
      ? { ...node.metadata, ...metadataUpdate }
      : node.metadata,
  };

  return {
    ...tree,
    nodes: {
      ...tree.nodes,
      [nodeId]: updatedNode,
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Traverse backwards from target nodeId up to the root, returning an ordered array
 * from [RootNode, ..., TargetNode] for prompt history reconstruction.
 */
export function getAncestorPath(
  tree: ConversationTree,
  nodeId: string
): TreeNode[] {
  const path: TreeNode[] = [];
  let current: TreeNode | undefined = tree.nodes[nodeId];

  while (current) {
    path.unshift(current);
    if (!current.parentId) break;
    current = tree.nodes[current.parentId];
  }

  return path;
}

/**
 * Return all direct branch children for a given node.
 */
export function getNodeChildren(
  tree: ConversationTree,
  nodeId: string
): TreeNode[] {
  const node = tree.nodes[nodeId];
  if (!node) return [];
  return node.childrenIds
    .map((id) => tree.nodes[id])
    .filter((n): n is TreeNode => Boolean(n));
}

/**
 * Return sibling branches that share the same parent node.
 */
export function getSiblingNodes(
  tree: ConversationTree,
  nodeId: string
): TreeNode[] {
  const node = tree.nodes[nodeId];
  if (!node || !node.parentId) return [];
  const parent = tree.nodes[node.parentId];
  if (!parent) return [];

  return parent.childrenIds
    .filter((id) => id !== nodeId)
    .map((id) => tree.nodes[id])
    .filter((n): n is TreeNode => Boolean(n));
}

/**
 * Recursively delete a node and all of its descendant branch nodes from the tree.
 */
export function pruneSubtree(
  tree: ConversationTree,
  nodeId: string
): ConversationTree {
  if (nodeId === tree.rootNodeId) {
    throw new Error("Cannot prune root node of conversation tree");
  }

  const nodeToPrune = tree.nodes[nodeId];
  if (!nodeToPrune) return tree;

  // Collect all descendants recursively
  const toDelete = new Set<string>();
  const collectDescendants = (id: string) => {
    toDelete.add(id);
    const n = tree.nodes[id];
    if (n) {
      n.childrenIds.forEach(collectDescendants);
    }
  };
  collectDescendants(nodeId);

  const updatedNodes: Record<string, TreeNode> = {};
  for (const [id, node] of Object.entries(tree.nodes)) {
    if (!toDelete.has(id)) {
      if (node.id === nodeToPrune.parentId) {
        // Remove pruned node from parent's childrenIds
        updatedNodes[id] = {
          ...node,
          childrenIds: node.childrenIds.filter((cid) => cid !== nodeId),
        };
      } else {
        updatedNodes[id] = node;
      }
    }
  }

  // If active node was in deleted subtree, fallback active node to parent
  let activeNodeId = tree.activeNodeId;
  if (toDelete.has(activeNodeId)) {
    activeNodeId = nodeToPrune.parentId || tree.rootNodeId;
  }

  return {
    ...tree,
    activeNodeId,
    nodes: updatedNodes,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Return all leaf nodes (nodes with 0 children) in the tree.
 */
export function getAllLeafNodes(tree: ConversationTree): TreeNode[] {
  return Object.values(tree.nodes).filter((node) => node.childrenIds.length === 0);
}

/**
 * Return all sibling sub-branch roots stemming from a parent node,
 * optionally matching a specific highlightedContext.
 */
export function getSiblingSubBranches(
  tree: ConversationTree,
  parentNodeId: string,
  highlightedContext?: string | null
): TreeNode[] {
  const children = getNodeChildren(tree, parentNodeId);
  if (!highlightedContext) return children;

  const exactMatches = children.filter(
    (c) => c.highlightedContext?.trim() === highlightedContext.trim()
  );
  return exactMatches.length > 0 ? exactMatches : children;
}

/**
 * Return the deepest active leaf descendant for a given branch node.
 */
export function getBranchLeafNode(tree: ConversationTree, startNodeId: string): TreeNode {
  let current = tree.nodes[startNodeId];
  if (!current) return current;

  while (current.childrenIds.length > 0) {
    const nextChildId = current.childrenIds[current.childrenIds.length - 1];
    const nextChild = tree.nodes[nextChildId];
    if (!nextChild) break;
    current = nextChild;
  }
  return current;
}

/**
 * Return all nodes along the mainline conversation trunk (starting from root,
 * following linear replies where highlightedContext is null).
 * Guarantees sub-branch nodes are excluded from the main chat feed.
 */
export function getMainlineTrunkPath(tree: ConversationTree | null): TreeNode[] {
  if (!tree || !tree.rootNodeId || !tree.nodes[tree.rootNodeId]) return [];

  const path: TreeNode[] = [];
  let current: TreeNode | undefined = tree.nodes[tree.rootNodeId];

  while (current) {
    path.push(current);
    if (current.childrenIds.length === 0) break;

    // Find direct mainline child (no highlightedContext)
    const mainlineChildId: string | undefined = current.childrenIds.find(
      (id: string) => !tree.nodes[id]?.highlightedContext
    );

    if (!mainlineChildId) break;
    current = tree.nodes[mainlineChildId];
  }

  return path;
}
