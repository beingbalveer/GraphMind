"use client";

import React from "react";
import {
  GitBranch,
  Sparkles,
  User,
  X,
  Layers,
} from "lucide-react";
import {
  ConversationTree,
  TreeNode,
  getNodeChildren,
  getAncestorPath,
} from "@graphmind/shared";
import { Button } from "@/components/ui/button";

interface TreeSidebarProps {
  tree: ConversationTree | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
}

function TreeNodeItem({
  tree,
  node,
  depth,
  activePathIds,
  activeNodeId,
  onSelectNode,
}: {
  tree: ConversationTree;
  node: TreeNode;
  depth: number;
  activePathIds: Set<string>;
  activeNodeId: string;
  onSelectNode: (nodeId: string) => void;
}) {
  const children = getNodeChildren(tree, node.id);
  const isActive = node.id === activeNodeId;
  const isOnActivePath = activePathIds.has(node.id);
  const isUser = node.role === "user";

  return (
    <div className="flex flex-col">
      <Button
        type="button"
        variant="ghost"
        onClick={() => onSelectNode(node.id)}
        style={{ paddingLeft: `${Math.min(depth * 14 + 10, 120)}px` }}
        className={`w-full h-auto text-left py-2 pr-3 rounded-lg flex items-start justify-start space-x-2 transition-all group cursor-pointer text-xs font-normal whitespace-normal ${
          isActive
            ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
            : isOnActivePath
            ? "bg-muted/90 text-foreground hover:bg-muted hover:text-foreground"
            : "text-foreground-muted hover:bg-surface-hover hover:text-foreground"
        }`}
      >
        {/* Node Icon */}
        <div className="shrink-0 pt-0.5">
          {node.highlightedContext ? (
            <GitBranch
              className={`w-3.5 h-3.5 ${
                isActive ? "text-primary-foreground" : "text-foreground-muted"
              }`}
            />
          ) : isUser ? (
            <User
              className={`w-3.5 h-3.5 ${
                isActive ? "text-primary-foreground" : "text-foreground-muted"
              }`}
            />
          ) : (
            <Sparkles
              className={`w-3.5 h-3.5 ${
                isActive ? "text-primary-foreground" : "text-foreground-muted"
              }`}
            />
          )}
        </div>

        {/* Content Snippet */}
        <div className="flex-1 min-w-0">
          {node.highlightedContext && (
            <div
              className={`text-2xs truncate font-normal ${
                isActive ? "text-primary-foreground/80" : "text-foreground-muted"
              }`}
            >
              &ldquo;{node.highlightedContext}&rdquo;
            </div>
          )}
          <div className="truncate leading-tight">
            {node.content || (node.role === "assistant" ? "Generating..." : "Empty message")}
          </div>
        </div>

        {/* Children count badge */}
        {children.length > 1 && (
          <span
            className={`text-2xs px-1.5 py-0.5 rounded-full font-mono shrink-0 ${
              isActive
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-muted text-foreground-muted"
            }`}
            title={`${children.length} branch pathways`}
          >
            {children.length}
          </span>
        )}
      </Button>

      {/* Render Subtree Children */}
      {children.length > 0 && (
        <div className="relative flex flex-col space-y-0.5 mt-0.5">
          {/* Vertical lineage guide line */}
          <div
            style={{ left: `${depth * 14 + 16}px` }}
            className="absolute top-0 bottom-2 w-px bg-border-subtle pointer-events-none"
          />
          {children.map((child) => (
            <TreeNodeItem
              key={child.id}
              tree={tree}
              node={child}
              depth={depth + 1}
              activePathIds={activePathIds}
              activeNodeId={activeNodeId}
              onSelectNode={onSelectNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TreeSidebar({
  tree,
  isOpen,
  onClose,
  onSelectNode,
}: TreeSidebarProps) {
  if (!isOpen || !tree) return null;

  const rootNode = tree.nodes[tree.rootNodeId];
  if (!rootNode) return null;

  const activePath = getAncestorPath(tree, tree.activeNodeId);
  const activePathIds = new Set(activePath.map((n) => n.id));
  const totalNodes = Object.keys(tree.nodes).length;

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 w-72 bg-background-secondary text-foreground border-r border-border-subtle sm:static flex flex-col animate-in slide-in-from-left duration-200 select-none"
    >
      {/* Sidebar Header */}
      <div className="h-13 px-4 border-b border-border-subtle flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-foreground-muted" />
          <span className="font-semibold text-xs tracking-tight text-foreground">
            Conversation Tree
          </span>
          <span className="text-2xs px-1.5 py-0.5 rounded-full bg-muted text-foreground-muted font-mono">
            {totalNodes} {totalNodes === 1 ? "node" : "nodes"}
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          className="text-foreground-muted hover:text-foreground h-7 w-7"
          title="Close Tree Sidebar"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Tree Hierarchy Scroll Container */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <TreeNodeItem
          tree={tree}
          node={rootNode}
          depth={0}
          activePathIds={activePathIds}
          activeNodeId={tree.activeNodeId}
          onSelectNode={onSelectNode}
        />
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-border bg-surface/50 text-2xs text-foreground-muted flex items-center justify-between">
        <span>Click any node to switch branch view</span>
      </div>
    </aside>
  );
}
