"use client";

import React, { useState, useRef, memo, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { User, Sparkles, Copy, Check, RotateCcw, GitBranch } from "lucide-react";
import { TreeNode, ConversationTree, getNodeChildren } from "@graphmind/shared";
import { Button } from "@/components/ui/button";
import { useTextSelection } from "@/hooks/useTextSelection";
import { SelectionTooltip } from "./SelectionTooltip";
import { BranchSwitcher } from "./BranchSwitcher";

interface ChatMessageProps {
  message: TreeNode & { isStreaming?: boolean; isError?: boolean };
  tree?: ConversationTree | null;
  activeChildId?: string;
  onRetry?: () => void;
  onExploreBranch?: (messageId: string, highlightedText: string) => void;
  onSelectBranch?: (nodeId: string) => void;
  onOpenSideBranch?: (childNodeId: string, excerpt: string) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CodeBlock({ children, className, ...props }: any) {
  const [copied, setCopied] = useState(false);
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

  const handleCopyCode = async () => {
    const codeText = getRawCode(children).replace(/\n$/, "");
    if (!codeText) return;
    await navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
    <div className="my-5 rounded-xl overflow-hidden border border-zinc-800 bg-[#1e2227] text-zinc-100 font-mono text-[13px] leading-relaxed shadow-xs">
      <div className="px-4 py-2 bg-[#181b1f] border-b border-zinc-800/80 text-[11.5px] text-zinc-400 font-medium flex items-center justify-between select-none">
        <span className="lowercase font-mono text-zinc-400">{language || "code"}</span>
        <button
          onClick={handleCopyCode}
          className="flex items-center space-x-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-4 overflow-x-auto">
        <code className={className} {...props}>
          {children}
        </code>
      </div>
    </div>
  );
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
}: {
  content: string;
}) {
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
      {content}
    </ReactMarkdown>
  );
});

export function ChatMessage({
  message,
  tree,
  activeChildId,
  onRetry,
  onExploreBranch,
  onSelectBranch,
  onOpenSideBranch,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Enable text selection tooltip for assistant responses only
  const { selection, clearSelection } = useTextSelection(
    isUser ? { current: null } : contentRef
  );

  // Find all child branches created from this message that have highlighted context
  const branchedChildren = React.useMemo(() => {
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

  const handleCopy = async () => {
    if (!message.content) return;
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExplore = (text: string) => {
    if (onExploreBranch) {
      onExploreBranch(message.id, text);
    }
    clearSelection();
  };

  return (
    <div
      id={message.id}
      className="py-5 px-4 sm:px-6 bg-white group transition-colors relative"
    >
      {/* Floating Selection Tooltip */}
      {!isUser && selection && (
        <SelectionTooltip selection={selection} onExplore={handleExplore} />
      )}

      <div className="max-w-3xl mx-auto flex gap-3.5 sm:gap-4.5 animate-in fade-in duration-200">
        {/* Role Avatar aligned with first text baseline */}
        <div className="shrink-0 pt-0.5">
          {isUser ? (
            <div className="w-6 h-6 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200/80 flex items-center justify-center font-bold text-xs">
              <User className="w-3.5 h-3.5" />
            </div>
          ) : (
            <div
              className={`w-6 h-6 rounded-full ${
                message.isError ? "bg-rose-600" : "bg-zinc-900"
              } text-white flex items-center justify-center font-bold text-xs shadow-xs`}
            >
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          )}
        </div>

        {/* Message Content Container */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Highlighted Sub-topic Context Badge */}
          {message.highlightedContext && (
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-zinc-100/90 border border-zinc-200/80 text-xs text-zinc-700 select-none mb-1.5">
              <GitBranch className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span className="font-semibold text-zinc-900 shrink-0">Sub-topic:</span>
              <span className="italic text-zinc-600 truncate max-w-md">
                &ldquo;{message.highlightedContext}&rdquo;
              </span>
            </div>
          )}

          {/* Markdown Rendered Body with Explicit Element Styling */}
          <div
            ref={contentRef}
            className={`text-[15.5px] ${
              message.isError ? "text-rose-700" : "text-zinc-900"
            } leading-[1.8] break-words`}
          >
            {message.content ? (
              <MarkdownRenderer content={message.content} />
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
              <span className="inline-block w-[2.5px] h-[15px] ml-1 bg-zinc-900 animate-pulse align-middle rounded-full" />
            )}
          </div>

          {/* Interactive Clickable Branch Pills Spawned from this Message */}
          {branchedChildren.length > 0 && (
            <div className="pt-2 flex flex-wrap items-center gap-1.5 select-none">
              <span className="text-[11px] text-zinc-400 font-medium mr-1">Branches:</span>
              {branchedChildren.map((child) => (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => onOpenSideBranch?.(getBranchLeafId(child), child.highlightedContext || "")}
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-zinc-100/90 hover:bg-zinc-200/90 border border-zinc-200/80 text-xs text-zinc-800 font-medium cursor-pointer transition-all hover:scale-[1.02] active:scale-98 shadow-2xs group"
                  title="Open parallel branch in right split pane"
                >
                  <GitBranch className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-900" />
                  <span className="italic truncate max-w-[220px]">
                    &ldquo;{child.highlightedContext}&rdquo;
                  </span>
                  <span className="text-[10px] text-zinc-400 font-normal">↗</span>
                </button>
              ))}
            </div>
          )}

          {/* Action Row & Branch Switcher */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
            {!isUser && message.content ? (
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-6 px-2 text-[11px] text-zinc-400 hover:text-zinc-800 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Copy response"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-600">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>

                {message.isError && onRetry && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRetry}
                    className="h-6 px-2 text-[11px] text-zinc-700 hover:text-zinc-950 border-zinc-200 flex items-center space-x-1 shadow-2xs"
                    title="Retry generation"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Retry</span>
                  </Button>
                )}
              </div>
            ) : <div />}

            {/* Sibling Branch Switcher for multiple pathways */}
            {tree && onSelectBranch && (
              <BranchSwitcher
                tree={tree}
                parentNodeId={message.id}
                activeChildId={activeChildId}
                onSelectBranch={onSelectBranch}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
