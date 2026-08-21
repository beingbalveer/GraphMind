import { ConversationTree, TreeNode, getNodeChildren } from "@graphmind/shared";

/**
 * Trigger browser file download with a given text content.
 */
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export conversation tree to formatted JSON file.
 */
export function exportTreeToJson(tree: ConversationTree | null, title = "graphmind_export") {
  if (!tree) return;
  const jsonContent = JSON.stringify(tree, null, 2);
  const filename = `${title.toLowerCase().replace(/[^a-z0-9]/g, "_")}_graph.json`;
  downloadFile(jsonContent, filename, "application/json");
}

/**
 * Export conversation tree to Obsidian-compatible Markdown with [[wikilinks]] and branch hierarchy.
 */
export function exportTreeToMarkdown(
  tree: ConversationTree | null,
  workspaceTitle = "GraphMind Research"
) {
  if (!tree || !tree.rootNodeId || !tree.nodes[tree.rootNodeId]) return;

  const lines: string[] = [];
  lines.push(`# ${workspaceTitle}`);
  lines.push(`\n> **Exported from GraphMind** — AI-native Knowledge Graph\n`);
  lines.push(`---\n`);

  function formatSubtree(node: TreeNode, depth: number) {
    const heading = "#".repeat(Math.min(depth + 2, 6));
    const roleTitle =
      node.role === "user" ? "User Prompt" : `Assistant Response (${node.model || "AI"})`;

    lines.push(`${heading} ${roleTitle} — Node \`${node.id.slice(0, 8)}\``);

    if (node.highlightedContext) {
      lines.push(`> 🌿 **Context:** *"${node.highlightedContext}"*\n`);
    }

    if (node.parentId && tree?.nodes[node.parentId]) {
      lines.push(`**Parent Branch:** [[Node-${node.parentId.slice(0, 8)}]]\n`);
    }

    lines.push(node.content);
    lines.push(`\n---\n`);

    const children = tree ? getNodeChildren(tree, node.id) : [];
    for (const child of children) {
      formatSubtree(child, depth + 1);
    }
  }

  const root = tree.nodes[tree.rootNodeId];
  formatSubtree(root, 0);

  const filename = `${workspaceTitle.toLowerCase().replace(/[^a-z0-9]/g, "_")}_notes.md`;
  downloadFile(lines.join("\n"), filename, "text/markdown");
}
