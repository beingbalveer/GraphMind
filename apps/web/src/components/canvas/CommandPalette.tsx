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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
    return allNodes
      .filter(
        (n) =>
          n.content.toLowerCase().includes(q) ||
          (n.highlightedContext && n.highlightedContext.toLowerCase().includes(q))
      )
      .slice(0, 5);
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
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-start justify-center pt-20 sm:pt-28 px-4 animate-in fade-in duration-150 select-none font-sans"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-surface rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
      >
        {/* Search Input Bar */}
        <div className="h-13 px-3 border-b border-border flex items-center space-x-2 shrink-0">
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            autoFocus
            variant="ghost"
            inputSize="lg"
            startIcon={<Search className="w-4 h-4 text-foreground-muted shrink-0" />}
            placeholder="Search conversation nodes or type a command..."
            className="flex-1 text-sm bg-transparent border-none shadow-none focus-visible:ring-0 focus-visible:bg-transparent"
          />
          <Button
            variant="ghost"
            size="iconSm"
            onClick={onClose}
            aria-label="Close command palette"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Results Container */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {/* Matching Node Search Results */}
          {matchingNodes.length > 0 && (
            <div className="space-y-0.5 mb-2">
              <div className="px-3 py-1 text-2xs font-semibold text-foreground-muted uppercase tracking-wider">
                Conversation Nodes
              </div>
              {matchingNodes.map((node, index) => {
                const isSelected = selectedIndex === index;
                return (
                  <Button
                    key={node.id}
                    variant={isSelected ? "default" : "ghost"}
                    size="sm"
                    onClick={() => {
                      onSelectNode(node.id);
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      "w-full justify-between h-auto py-2 px-3 text-xs rounded-xl font-normal cursor-pointer transition-colors",
                      isSelected
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-foreground hover:bg-surface-hover"
                    )}
                  >
                    <div className="flex items-center space-x-2 min-w-0 text-left">
                      <span
                        className={cn(
                          "text-2xs font-mono shrink-0",
                          isSelected ? "text-primary-foreground/70" : "text-foreground-muted"
                        )}
                      >
                        {node.role}
                      </span>
                      <span className="truncate">
                        {node.highlightedContext ? `"${node.highlightedContext}" — ` : ""}
                        {node.content}
                      </span>
                    </div>
                    <CornerDownLeft
                      className={cn(
                        "w-3 h-3 shrink-0 ml-2",
                        isSelected ? "text-primary-foreground" : "text-foreground-muted"
                      )}
                    />
                  </Button>
                );
              })}
            </div>
          )}

          {/* Quick Actions List */}
          <div className="space-y-0.5">
            <div className="px-3 py-1 text-2xs font-semibold text-foreground-muted uppercase tracking-wider">
              Actions
            </div>
            {commandActions.map((cmd, index) => {
              const actualIndex = matchingNodes.length + index;
              const isSelected = selectedIndex === actualIndex;
              const Icon = cmd.icon;

              return (
                <Button
                  key={cmd.id}
                  variant={isSelected ? "default" : "ghost"}
                  size="sm"
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(actualIndex)}
                  className={cn(
                    "w-full justify-between h-auto py-2 px-3 text-xs rounded-xl font-normal cursor-pointer transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-foreground hover:bg-surface-hover"
                  )}
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon
                      className={cn(
                        "w-4 h-4",
                        isSelected ? "text-primary-foreground" : "text-foreground-muted"
                      )}
                    />
                    <span>{cmd.label}</span>
                  </div>
                  <kbd
                    className={cn(
                      "text-2xs font-mono px-1.5 py-0.5 rounded border",
                      isSelected
                        ? "bg-primary-foreground/20 border-primary-foreground/30 text-primary-foreground"
                        : "bg-surface-hover border-border text-foreground-muted"
                    )}
                  >
                    {cmd.shortcut}
                  </kbd>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-background-secondary border-t border-border flex items-center justify-between text-xs text-foreground-muted">
          <div className="flex items-center space-x-2">
            <span>
              Navigate with <kbd className="font-mono">↑</kbd> <kbd className="font-mono">↓</kbd>
            </span>
            <span>•</span>
            <span>
              Select with <kbd className="font-mono">↵</kbd>
            </span>
          </div>
          <span>
            Close with <kbd className="font-mono">esc</kbd>
          </span>
        </div>
      </div>
    </div>
  );
}
