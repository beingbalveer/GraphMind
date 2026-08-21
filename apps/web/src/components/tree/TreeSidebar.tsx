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
      <button
        type="button"
        onClick={() => onSelectNode(node.id)}
        style={{ paddingLeft: `${Math.min(depth * 14 + 10, 120)}px` }}
        className={`w-full text-left py-2 pr-3 rounded-lg flex items-start space-x-2 transition-all group cursor-pointer text-xs ${
          isActive
            ? "bg-zinc-900 text-white font-semibold shadow-xs"
            : isOnActivePath
            ? "bg-zinc-100/90 text-zinc-900 font-medium"
            : "text-zinc-600 hover:bg-zinc-100/70 hover:text-zinc-900"
        }`}
      >
        {/* Node Icon */}
        <div className="shrink-0 pt-0.5">
          {node.highlightedContext ? (
            <GitBranch
              className={`w-3.5 h-3.5 ${
                isActive ? "text-white" : "text-zinc-500"
              }`}
            />
          ) : isUser ? (
            <User
              className={`w-3.5 h-3.5 ${
                isActive ? "text-white" : "text-zinc-400"
              }`}
            />
          ) : (
            <Sparkles
              className={`w-3.5 h-3.5 ${
                isActive ? "text-white" : "text-zinc-400"
              }`}
            />
          )}
        </div>

        {/* Content Snippet */}
        <div className="flex-1 min-w-0">
          {node.highlightedContext && (
            <div
              className={`text-[10.5px] truncate font-medium ${
                isActive ? "text-zinc-300" : "text-zinc-500"
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
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono shrink-0 ${
              isActive
                ? "bg-zinc-800 text-zinc-300"
                : "bg-zinc-200/80 text-zinc-600"
            }`}
            title={`${children.length} branch pathways`}
          >
            {children.length}
          </span>
        )}
      </button>

      {/* Render Subtree Children */}
      {children.length > 0 && (
        <div className="relative flex flex-col space-y-0.5 mt-0.5">
          {/* Vertical lineage guide line */}
          <div
            style={{ left: `${depth * 14 + 16}px` }}
            className="absolute top-0 bottom-2 w-px bg-zinc-200/80 pointer-events-none"
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
      className={`fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-zinc-200/90 shadow-xl sm:shadow-none sm:static flex flex-col animate-in slide-in-from-left duration-200 select-none`}
    >
      {/* Sidebar Header */}
      <div className="h-13 px-4 border-b border-zinc-200/80 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-zinc-700" />
          <span className="font-semibold text-xs tracking-tight text-zinc-900">
            Conversation Tree
          </span>
          <span className="text-[10.5px] px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600 font-mono">
            {totalNodes} {totalNodes === 1 ? "node" : "nodes"}
          </span>
        </div>

        <Button
          variant="ghost"
          size="iconSm"
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-900 h-7 w-7"
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
      <div className="p-3 border-t border-zinc-200/80 bg-zinc-50/50 text-[11px] text-zinc-500 flex items-center justify-between">
        <span>Click any node to switch branch view</span>
      </div>
    </aside>
  );
}
