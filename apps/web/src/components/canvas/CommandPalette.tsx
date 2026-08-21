"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Maximize2,
  Crosshair,
  Sparkles,
  MessageSquare,
  LayoutGrid,
  Plus,
  X,
  CornerDownLeft,
} from "lucide-react";
import { ConversationTree, TreeNode } from "@graphmind/shared";
import { ViewMode } from "../layout/Navbar";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  tree: ConversationTree | null;
  viewMode: ViewMode;
  onSelectNode: (nodeId: string) => void;
  onToggleViewMode: () => void;
  onFitView: () => void;
  onCenterActive: () => void;
  onAutoLayout: () => void;
  onClearChat: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  tree,
  viewMode,
  onSelectNode,
  onToggleViewMode,
  onFitView,
  onCenterActive,
  onAutoLayout,
  onClearChat,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const allNodes: TreeNode[] = useMemo(() => {
    if (!tree) return [];
    return Object.values(tree.nodes);
  }, [tree]);

  // Filter nodes matching query
  const matchingNodes = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allNodes.filter(
      (n) =>
        n.content.toLowerCase().includes(q) ||
        (n.highlightedContext && n.highlightedContext.toLowerCase().includes(q))
    ).slice(0, 5);
  }, [allNodes, query]);

  // Command actions
  const commandActions = useMemo(() => {
    return [
      {
        id: "toggle-view",
        label: viewMode === "canvas" ? "Switch to Chat View" : "Switch to 2D Canvas View",
        icon: viewMode === "canvas" ? MessageSquare : LayoutGrid,
        shortcut: "View",
        action: () => {
          onToggleViewMode();
          onClose();
        },
      },
      {
        id: "fit-view",
        label: "Fit All Nodes in View",
        icon: Maximize2,
        shortcut: "⌘0",
        action: () => {
          onFitView();
          onClose();
        },
      },
      {
        id: "center-active",
        label: "Center on Active Node",
        icon: Crosshair,
        shortcut: "⌘.",
        action: () => {
          onCenterActive();
          onClose();
        },
      },
      {
        id: "auto-layout",
        label: "Recompute Clean Auto-Layout",
        icon: Sparkles,
        shortcut: "⌘L",
        action: () => {
          onAutoLayout();
          onClose();
        },
      },
      {
        id: "new-chat",
        label: "Start New Conversation",
        icon: Plus,
        shortcut: "New",
        action: () => {
          onClearChat();
          onClose();
        },
      },
    ];
  }, [viewMode, onToggleViewMode, onFitView, onCenterActive, onAutoLayout, onClearChat, onClose]);

  const totalItems = matchingNodes.length + commandActions.length;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % totalItems);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selectedIndex < matchingNodes.length) {
          const node = matchingNodes[selectedIndex];
          onSelectNode(node.id);
          onClose();
        } else {
          const actionIndex = selectedIndex - matchingNodes.length;
          commandActions[actionIndex]?.action();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, totalItems, selectedIndex, matchingNodes, commandActions, onSelectNode, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-start justify-center pt-20 sm:pt-28 px-4 animate-in fade-in duration-150 select-none font-sans"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white rounded-2xl border border-zinc-200/90 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
      >
        {/* Search Input Bar */}
        <div className="h-13 px-4 border-b border-zinc-200/80 flex items-center space-x-3 shrink-0">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            autoFocus
            placeholder="Search conversation nodes or type a command..."
            className="flex-1 text-sm text-zinc-900 placeholder:text-zinc-400 bg-transparent focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results Container */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {/* Matching Node Search Results */}
          {matchingNodes.length > 0 && (
            <div className="space-y-0.5 mb-2">
              <div className="px-3 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                Conversation Nodes
              </div>
              {matchingNodes.map((node, index) => {
                const isSelected = selectedIndex === index;
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => {
                      onSelectNode(node.id);
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-zinc-900 text-white font-medium"
                        : "text-zinc-700 hover:bg-zinc-100"
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className={`text-[10px] font-mono shrink-0 ${isSelected ? "text-zinc-300" : "text-zinc-400"}`}>
                        {node.role}
                      </span>
                      <span className="truncate">
                        {node.highlightedContext ? `"${node.highlightedContext}" — ` : ""}
                        {node.content}
                      </span>
                    </div>
                    <CornerDownLeft className={`w-3 h-3 shrink-0 ml-2 ${isSelected ? "text-white" : "text-zinc-400"}`} />
                  </button>
                );
              })}
            </div>
          )}

          {/* Quick Actions List */}
          <div className="space-y-0.5">
            <div className="px-3 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              Actions
            </div>
            {commandActions.map((cmd, index) => {
              const actualIndex = matchingNodes.length + index;
              const isSelected = selectedIndex === actualIndex;
              const Icon = cmd.icon;

              return (
                <button
                  key={cmd.id}
                  type="button"
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(actualIndex)}
                  className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-zinc-900 text-white font-medium"
                      : "text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon className={`w-4 h-4 ${isSelected ? "text-white" : "text-zinc-500"}`} />
                    <span>{cmd.label}</span>
                  </div>
                  <kbd
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                      isSelected
                        ? "bg-zinc-800 border-zinc-700 text-zinc-300"
                        : "bg-zinc-100 border-zinc-200 text-zinc-500"
                    }`}
                  >
                    {cmd.shortcut}
                  </kbd>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-zinc-50 border-t border-zinc-200/80 flex items-center justify-between text-[11px] text-zinc-500">
          <div className="flex items-center space-x-2">
            <span>Navigate with <kbd className="font-mono">↑</kbd> <kbd className="font-mono">↓</kbd></span>
            <span>•</span>
            <span>Select with <kbd className="font-mono">↵</kbd></span>
          </div>
          <span>Close with <kbd className="font-mono">esc</kbd></span>
        </div>
      </div>
    </div>
  );
}
