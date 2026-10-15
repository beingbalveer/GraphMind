"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  FileText,
  Loader2,
  AlertCircle,
  RotateCw,
} from "lucide-react";
import { ConversationTree, TreeNode } from "@graphmind/shared";
import { ViewMode } from "../layout/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  searchFileResultUrl,
  searchNodeResultUrl,
  searchWorkspace,
  type SearchFileHit,
  type SearchNodeHit,
} from "@/lib/searchApi";

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
  /** Authorized workspace to run inventory-backed search against. */
  workspaceId?: string;
  /** Navigate to a canonical result URL (built with @/lib/urls). */
  onNavigateResult?: (url: string) => void;
}

/** Minimum query length before hitting the server search endpoint. */
const MIN_REMOTE_QUERY_LENGTH = 2;
const REMOTE_SEARCH_DEBOUNCE_MS = 250;

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
  workspaceId,
  onNavigateResult,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Inventory-backed (server) results for the authorized workspace.
  const [remoteNodes, setRemoteNodes] = useState<SearchNodeHit[]>([]);
  const [remoteFiles, setRemoteFiles] = useState<SearchFileHit[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchNonce, setSearchNonce] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setRemoteNodes([]);
      setRemoteFiles([]);
      setSearchError(null);
      setIsSearching(false);
    }
  }, [isOpen]);

  // Debounced server search scoped to the authorized workspace.
  useEffect(() => {
    if (!isOpen || !workspaceId) {
      setRemoteNodes([]);
      setRemoteFiles([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < MIN_REMOTE_QUERY_LENGTH) {
      setRemoteNodes([]);
      setRemoteFiles([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    setIsSearching(true);
    setSearchError(null);

    const handle = setTimeout(async () => {
      try {
        const result = await searchWorkspace(workspaceId, trimmed, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setRemoteNodes(result.nodes);
        setRemoteFiles(result.files);
      } catch (error) {
        if (controller.signal.aborted) return;
        setRemoteNodes([]);
        setRemoteFiles([]);
        setSearchError(
          error instanceof Error ? error.message : "Search is unavailable right now."
        );
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, REMOTE_SEARCH_DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(handle);
    };
  }, [isOpen, workspaceId, query, searchNonce]);

  const allNodes: TreeNode[] = useMemo(() => {
    if (!tree) return [];
    return Object.values(tree.nodes);
  }, [tree]);

  // Filter in-conversation nodes matching query
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

  const openNodeResult = useCallback(
    (hit: SearchNodeHit) => {
      if (workspaceId) {
        onNavigateResult?.(searchNodeResultUrl(workspaceId, hit));
      }
      onClose();
    },
    [workspaceId, onNavigateResult, onClose]
  );

  const openFileResult = useCallback(
    (hit: SearchFileHit) => {
      if (workspaceId) {
        onNavigateResult?.(searchFileResultUrl(workspaceId, hit));
      }
      onClose();
    },
    [workspaceId, onNavigateResult, onClose]
  );

  const localCount = matchingNodes.length;
  const remoteNodeCount = remoteNodes.length;
  const fileCount = remoteFiles.length;
  const totalItems = localCount + remoteNodeCount + fileCount + commandActions.length;

  const hasQuery = query.trim().length > 0;
  const showEmptyState =
    hasQuery &&
    localCount === 0 &&
    remoteNodeCount === 0 &&
    fileCount === 0 &&
    !isSearching &&
    !searchError;

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
        if (selectedIndex < localCount) {
          onSelectNode(matchingNodes[selectedIndex].id);
          onClose();
        } else if (selectedIndex < localCount + remoteNodeCount) {
          openNodeResult(remoteNodes[selectedIndex - localCount]);
        } else if (selectedIndex < localCount + remoteNodeCount + fileCount) {
          openFileResult(remoteFiles[selectedIndex - localCount - remoteNodeCount]);
        } else {
          const actionIndex = selectedIndex - localCount - remoteNodeCount - fileCount;
          commandActions[actionIndex]?.action();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isOpen,
    totalItems,
    selectedIndex,
    matchingNodes,
    remoteNodes,
    remoteFiles,
    localCount,
    remoteNodeCount,
    fileCount,
    commandActions,
    onSelectNode,
    openNodeResult,
    openFileResult,
    onClose,
  ]);

  if (!isOpen) return null;

  const selectedRowClass = "bg-primary text-primary-foreground font-medium";
  const idleRowClass = "text-foreground hover:bg-surface-hover";

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-overlay backdrop-blur-sm flex items-start justify-center pt-20 sm:pt-28 px-4 animate-in fade-in duration-150 select-none font-sans"
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
          {isSearching && (
            <Loader2
              className="w-4 h-4 text-foreground-muted animate-spin shrink-0"
              aria-label="Searching workspace"
            />
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close command palette"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Results Container */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {/* Search error with retry */}
          {searchError && (
            <div
              role="alert"
              className="mx-1 mb-2 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="flex-1">{searchError}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchNonce((n) => n + 1)}
                className="h-6 gap-1 px-2 text-2xs text-destructive hover:bg-destructive/20"
              >
                <RotateCw className="w-3 h-3" />
                Retry search
              </Button>
            </div>
          )}

          {/* Matching in-conversation nodes */}
          {localCount > 0 && (
            <div className="space-y-0.5 mb-2">
              <div className="px-3 py-1 text-2xs font-semibold text-foreground-muted uppercase tracking-wider">
                This conversation
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
                      isSelected ? selectedRowClass : idleRowClass
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

          {/* Workspace-wide semantic node results */}
          {remoteNodeCount > 0 && (
            <div className="space-y-0.5 mb-2">
              <div className="px-3 py-1 text-2xs font-semibold text-foreground-muted uppercase tracking-wider">
                Workspace conversations
              </div>
              {remoteNodes.map((hit, index) => {
                const flatIndex = localCount + index;
                const isSelected = selectedIndex === flatIndex;
                return (
                  <Button
                    key={hit.nodeId}
                    variant={isSelected ? "default" : "ghost"}
                    size="sm"
                    onClick={() => openNodeResult(hit)}
                    onMouseEnter={() => setSelectedIndex(flatIndex)}
                    data-testid={`command-palette-node-${hit.nodeId}`}
                    className={cn(
                      "w-full justify-between h-auto py-2 px-3 text-xs rounded-xl font-normal cursor-pointer transition-colors",
                      isSelected ? selectedRowClass : idleRowClass
                    )}
                  >
                    <div className="flex items-center space-x-2 min-w-0 text-left">
                      <MessageSquare
                        className={cn(
                          "w-3.5 h-3.5 shrink-0",
                          isSelected ? "text-primary-foreground/70" : "text-foreground-muted"
                        )}
                      />
                      <span className="truncate">{hit.content}</span>
                    </div>
                    <span
                      className={cn(
                        "text-2xs font-mono shrink-0 ml-2 tabular-nums",
                        isSelected ? "text-primary-foreground/70" : "text-foreground-muted"
                      )}
                    >
                      {Math.round(hit.similarityScore * 100)}%
                    </span>
                  </Button>
                );
              })}
            </div>
          )}

          {/* Workspace hybrid file results */}
          {fileCount > 0 && (
            <div className="space-y-0.5 mb-2">
              <div className="px-3 py-1 text-2xs font-semibold text-foreground-muted uppercase tracking-wider">
                Files
              </div>
              {remoteFiles.map((hit, index) => {
                const flatIndex = localCount + remoteNodeCount + index;
                const isSelected = selectedIndex === flatIndex;
                return (
                  <Button
                    key={`${hit.fileId}-${hit.chunkId}`}
                    variant={isSelected ? "default" : "ghost"}
                    size="sm"
                    onClick={() => openFileResult(hit)}
                    onMouseEnter={() => setSelectedIndex(flatIndex)}
                    data-testid={`command-palette-file-${hit.fileId}`}
                    className={cn(
                      "w-full justify-between h-auto py-2 px-3 text-xs rounded-xl font-normal cursor-pointer transition-colors",
                      isSelected ? selectedRowClass : idleRowClass
                    )}
                  >
                    <div className="flex items-center space-x-2 min-w-0 text-left">
                      <FileText
                        className={cn(
                          "w-3.5 h-3.5 shrink-0",
                          isSelected ? "text-primary-foreground/70" : "text-foreground-muted"
                        )}
                      />
                      <span className="truncate">
                        <span className="font-medium">{hit.filename}</span>
                        <span
                          className={cn(
                            "ml-2",
                            isSelected ? "text-primary-foreground/70" : "text-foreground-muted"
                          )}
                        >
                          {hit.snippet}
                        </span>
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

          {/* Empty state */}
          {showEmptyState && (
            <div
              role="status"
              className="rounded-xl border border-dashed border-border-subtle bg-background-secondary p-6 text-center"
            >
              <p className="text-xs font-semibold text-foreground">No matching results</p>
              <p className="mt-1 text-2xs text-foreground-muted">
                {workspaceId
                  ? "No conversations or files matched this search in the workspace."
                  : "No conversation nodes matched this search."}
              </p>
            </div>
          )}

          {/* Quick Actions List */}
          <div className="space-y-0.5">
            <div className="px-3 py-1 text-2xs font-semibold text-foreground-muted uppercase tracking-wider">
              Actions
            </div>
            {commandActions.map((cmd, index) => {
              const actualIndex = localCount + remoteNodeCount + fileCount + index;
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
                    isSelected ? selectedRowClass : idleRowClass
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
