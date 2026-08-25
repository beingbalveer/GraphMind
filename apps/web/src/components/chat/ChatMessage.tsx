"use client";

import React, { useRef, memo, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import {
  Sparkles,
  RotateCcw,
  GitBranch,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { TreeNode, ConversationTree, getNodeChildren } from "@graphmind/shared";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { useTextSelection } from "@/hooks/useTextSelection";
import { SelectionTooltip } from "./SelectionTooltip";

export interface BranchLinkInfo {
  excerpt: string;
  leafId: string;
}

interface ChatMessageProps {
  message: TreeNode & { isStreaming?: boolean; isError?: boolean };
  tree?: ConversationTree | null;
  onRetry?: () => void;
  onRegenerate?: (nodeId: string) => void;
  onSwitchBranch?: (nodeId: string) => void;
  onExploreBranch?: (messageId: string, highlightedText: string) => void;
  onOpenSideBranch?: (childNodeId: string, excerpt: string) => void;
}


function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function injectBranchLinks(content: string, branches: BranchLinkInfo[]): string {
  if (!branches || branches.length === 0 || !content) return content;

  // Split by code blocks so we never alter code inside fences or inline backticks
  const codeBlockRegex = /(```[\s\S]*?```|`[^`]+`)/g;
  const parts = content.split(codeBlockRegex);

  return parts
    .map((part) => {
      // If this part is a code block, preserve untouched
      if (part.startsWith("`")) return part;

      let modifiedPart = part;
      for (const branch of branches) {
        if (!branch.excerpt || !branch.excerpt.trim()) continue;
        const rawExcerpt = branch.excerpt.trim();
        const escaped = escapeRegExp(rawExcerpt);
        // Replace occurrences not already inside a markdown branch link
        const regex = new RegExp(`(?<!\\[)${escaped}(?!\\]\\(#branch:)`, "gi");
        modifiedPart = modifiedPart.replace(
          regex,
          (match) => `[${match}](#branch:${branch.leafId})`
        );
      }
      return modifiedPart;
    })
    .join("");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CodeBlock({ children, className, ...props }: any) {
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "";

  // Extract raw text content from React children for clipboard copy
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getRawCode = (node: any): string => {
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(getRawCode).join("");
    if (node?.props?.children) return getRawCode(node.props.children);
    return "";
  };

  const rawCode = getRawCode(children).replace(/\n$/, "");

  if (!language && !className?.includes("hljs")) {
    return (
      <code
        className="px-1.5 py-0.5 rounded-md bg-zinc-100 border border-zinc-200/80 text-zinc-900 font-mono text-[13.5px] font-medium"
        {...props}
      >
        {children}
      </code>
    );
  }

  return (
    <div className="my-5 rounded-xl overflow-hidden border border-zinc-800 bg-[#1e2227] text-zinc-100 font-mono text-[13px] leading-relaxed shadow-xs group/code">
      <div className="px-4 py-2 bg-[#181b1f] border-b border-zinc-800/80 text-[11.5px] text-zinc-400 font-medium flex items-center justify-between select-none">
        <span className="lowercase font-mono text-zinc-400">{language || "code"}</span>
        <CopyButton
          text={rawCode}
          className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 p-1"
          title="Copy code"
        />
      </div>
      <div className="p-4 overflow-x-auto">
        <pre className="!bg-transparent !p-0 !m-0 font-mono">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      </div>
    </div>
  );
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  branchLinks,
  onOpenSideBranch,
}: {
  content: string;
  branchLinks?: BranchLinkInfo[];
  onOpenSideBranch?: (childNodeId: string, excerpt: string) => void;
}) {
  const processedContent = useMemo(() => {
    return branchLinks && branchLinks.length > 0
      ? injectBranchLinks(content, branchLinks)
      : content;
  }, [content, branchLinks]);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex, rehypeHighlight]}
      components={{
        code: CodeBlock,
        p({ children }) {
          return <p className="mb-4 last:mb-0 leading-[1.8]">{children}</p>;
        },
        h1({ children }) {
          return (
            <h1 className="text-xl font-bold text-zinc-950 mt-6 mb-3 tracking-tight">
              {children}
            </h1>
          );
        },
        h2({ children }) {
          return (
            <h2 className="text-lg font-semibold text-zinc-900 mt-5 mb-2.5 tracking-tight">
              {children}
            </h2>
          );
        },
        h3({ children }) {
          return (
            <h3 className="text-base font-semibold text-zinc-800 mt-4 mb-2">
              {children}
            </h3>
          );
        },
        ul({ children }) {
          return (
            <ul className="list-disc list-inside space-y-1.5 mb-4 pl-1 text-zinc-800">
              {children}
            </ul>
          );
        },
        ol({ children }) {
          return (
            <ol className="list-decimal list-inside space-y-1.5 mb-4 pl-1 text-zinc-800">
              {children}
            </ol>
          );
        },
        li({ children }) {
          return <li className="leading-relaxed">{children}</li>;
        },
        blockquote({ children }) {
          return (
            <blockquote className="border-l-2 border-zinc-900 pl-4 italic text-zinc-700 my-4 bg-zinc-50/50 py-1.5 rounded-r-lg">
              {children}
            </blockquote>
          );
        },
        a({ href, children }) {
          // Obsidian-style clickable inline branch link
          if (href?.startsWith("#branch:")) {
            const leafId = href.replace("#branch:", "");
            const excerptText =
              typeof children === "string"
                ? children
                : Array.isArray(children)
                ? children.map((c) => (typeof c === "string" ? c : "")).join("")
                : "";

            return (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onOpenSideBranch?.(leafId, excerptText);
                }}
                className="inline text-blue-600 hover:text-blue-800 underline underline-offset-2 decoration-blue-400/80 hover:decoration-blue-600 font-medium cursor-pointer transition-colors bg-transparent border-0 p-0 align-baseline"
                title={`Open branch for "${excerptText}" in parallel split pane`}
              >
                {children}
              </button>
            );
          }

          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-900 underline underline-offset-4 font-medium hover:text-black transition-colors"
            >
              {children}
            </a>
          );
        },
        hr() {
          return <hr className="my-6 border-zinc-200/80" />;
        },
        table({ children }) {
          return (
            <div className="my-4 overflow-x-auto rounded-xl border border-zinc-200 shadow-xs">
              <table className="w-full text-left text-xs border-collapse divide-y divide-zinc-200">
                {children}
              </table>
            </div>
          );
        },
        thead({ children }) {
          return <thead className="bg-zinc-50 text-zinc-800 font-semibold">{children}</thead>;
        },
        tbody({ children }) {
          return <tbody className="divide-y divide-zinc-100 bg-white">{children}</tbody>;
        },
        tr({ children }) {
          return <tr className="hover:bg-zinc-50/50 transition-colors">{children}</tr>;
        },
        th({ children }) {
          return <th className="px-3.5 py-2.5 font-medium">{children}</th>;
        },
        td({ children }) {
          return (
            <td className="px-3.5 py-2 text-zinc-700 whitespace-pre-wrap leading-relaxed">
              {children}
            </td>
          );
        },
      }}
    >
      {processedContent}
    </ReactMarkdown>
  );
});
export function ChatMessage({
  message,
  tree,
  onRetry,
  onRegenerate,
  onSwitchBranch,
  onExploreBranch,
  onOpenSideBranch,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const contentRef = useRef<HTMLDivElement>(null);

  // Enable text selection tooltip for assistant responses only
  const { selection, clearSelection } = useTextSelection(
    isUser ? { current: null } : contentRef
  );

  // Find sibling versions under the same parent turn (e.g. regenerated answers)
  const siblingNodes = useMemo(() => {
    if (!tree || !message.parentId) return [];
    const parent = tree.nodes[message.parentId];
    if (!parent) return [];
    return parent.childrenIds
      .map((id) => tree.nodes[id])
      .filter(
        (n): n is TreeNode =>
          Boolean(n && n.role === message.role && !n.highlightedContext)
      );
  }, [tree, message.parentId, message.role]);

  const siblingIndex = useMemo(() => {
    return siblingNodes.findIndex((n) => n.id === message.id);
  }, [siblingNodes, message.id]);

  // Find all child branches created from this message that have highlighted context
  const branchedChildren = useMemo(() => {
    if (!tree) return [];
    return getNodeChildren(tree, message.id).filter(
      (child) => Boolean(child.highlightedContext)
    );
  }, [tree, message.id]);

  // Helper to get the deepest leaf of a specific branch
  const getBranchLeafId = useCallback(
    (userChild: TreeNode): string => {
      if (!tree) return userChild.id;
      const assistantChildren = getNodeChildren(tree, userChild.id);
      if (assistantChildren.length > 0) {
        let curr = assistantChildren[0];
        while (true) {
          const nextChildren = getNodeChildren(tree, curr.id);
          if (nextChildren.length > 0) {
            curr = nextChildren[0];
          } else {
            break;
          }
        }
        return curr.id;
      }
      return userChild.id;
    },
    [tree]
  );

  // Build inline branch link mappings for the markdown renderer
  const branchLinks: BranchLinkInfo[] = useMemo(() => {
    return branchedChildren.map((child) => ({
      excerpt: child.highlightedContext || "",
      leafId: getBranchLeafId(child),
    }));
  }, [branchedChildren, getBranchLeafId]);

  const handleSearch = (text: string) => {
    window.open(
      `https://www.google.com/search?q=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
    clearSelection();
  };

  const handleExplore = (text: string) => {
    if (onExploreBranch) {
      onExploreBranch(message.id, text);
    }
    clearSelection();
  };

  if (isUser) {
    return (
      <div id={message.id} className="py-3 px-4 sm:px-6 bg-transparent group/user">
        <div className="max-w-3xl mx-auto flex items-center justify-end gap-2">
          {message.content && (
            <CopyButton
              text={message.content}
              className="opacity-0 group-hover/user:opacity-100 transition-opacity"
              title="Copy prompt"
            />
          )}
          <div className="max-w-2xl rounded-2xl bg-zinc-100/90 text-zinc-900 px-4.5 py-3 border border-zinc-200/70 shadow-2xs">
            {message.highlightedContext && (
              <div className="text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200/80 rounded-md px-2 py-0.5 mb-2 inline-flex items-center space-x-1.5 shadow-2xs">
                <GitBranch className="w-3 h-3 text-emerald-600 shrink-0" />
                <span className="truncate">Sub-topic: &ldquo;{message.highlightedContext}&rdquo;</span>
              </div>
            )}
            <div className="text-[14.5px] leading-relaxed select-text font-normal whitespace-pre-wrap">
              {message.content}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id={message.id} className="py-3 px-4 sm:px-6 bg-white group">
      {/* Floating Exploration Tooltip on Text Selection */}
      {selection && (
        <SelectionTooltip
          position={selection.position}
          selectedText={selection.text}
          onExplore={handleExplore}
          onSearch={handleSearch}
          onClose={clearSelection}
        />
      )}

      <div className="max-w-3xl mx-auto flex space-x-3.5">
        {/* Assistant Avatar */}
        <div className="w-7 h-7 rounded-full bg-zinc-100 border border-zinc-200/80 flex items-center justify-center shrink-0 mt-0.5 text-zinc-800 shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-zinc-700" />
        </div>

        {/* Message Content Container */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Markdown Rendered Body */}
          <div
            ref={contentRef}
            className={`text-[15px] select-text ${
              message.isError ? "text-rose-700" : "text-zinc-800"
            } leading-[1.8] break-words`}
          >
            {message.content ? (
              <MarkdownRenderer
                content={message.content}
                branchLinks={branchLinks}
                onOpenSideBranch={onOpenSideBranch}
              />
            ) : message.isStreaming ? (
              /* Smooth Staggered Wave Thinking State */
              <div className="flex items-center space-x-2 py-1 select-none">
                <div className="flex space-x-1 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" />
                </div>
                <span className="text-xs font-medium text-zinc-400">Thinking...</span>
              </div>
            ) : null}

            {/* Smooth Breathing Streaming Caret */}
            {message.isStreaming && message.content && (
              <span className="inline-block w-[2px] h-[16px] ml-1 bg-zinc-900 animate-pulse align-middle rounded-full" />
            )}
          </div>

          {/* Action Row & Branch Switcher */}
          <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
            {!isUser && message.content ? (
              <div className="flex items-center space-x-1.5">
                {/* Sibling Version Switcher (< 1/2 >) */}
                {siblingNodes.length > 1 && siblingIndex !== -1 && (
                  <div className="flex items-center space-x-0.5 mr-1 text-xs text-zinc-500 font-medium">
                    <button
                      type="button"
                      disabled={siblingIndex <= 0}
                      onClick={() => onSwitchBranch?.(siblingNodes[siblingIndex - 1].id)}
                      className="p-0.5 rounded hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-zinc-600 transition-colors"
                      title="Previous version"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] select-none text-zinc-500 px-0.5">
                      {siblingIndex + 1}/{siblingNodes.length}
                    </span>
                    <button
                      type="button"
                      disabled={siblingIndex >= siblingNodes.length - 1}
                      onClick={() => onSwitchBranch?.(siblingNodes[siblingIndex + 1].id)}
                      className="p-0.5 rounded hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-zinc-600 transition-colors"
                      title="Next version"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Copy Button */}
                <CopyButton
                  text={message.content}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Copy response"
                />

                {/* Regenerate Button */}
                {onRegenerate && !message.isStreaming && (
                  <button
                    type="button"
                    onClick={() => onRegenerate(message.id)}
                    className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all opacity-0 group-hover:opacity-100 cursor-pointer flex items-center justify-center"
                    title="Regenerate response"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Retry Error Button */}
                {message.isError && onRetry && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRetry}
                    className="h-6 px-2 text-[11px] text-zinc-700 hover:text-zinc-950 border-zinc-200 flex items-center space-x-1 shadow-2xs cursor-pointer"
                    title="Retry generation"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
