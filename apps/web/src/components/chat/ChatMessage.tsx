"use client";

import React, { useState, useRef, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { User, Sparkles, Copy, Check, RotateCcw, GitBranch } from "lucide-react";
import { TreeNode, ConversationTree } from "@graphmind/shared";
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
}

function CodeBlock({ children, className, ...props }: any) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "";

  // Extract raw text content from React children for clipboard copy
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

// Memoized markdown renderer to prevent DOM re-creation that destroys active browser text selections
const MarkdownRenderer = memo(function MarkdownRenderer({
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
        p({ children, ...props }: any) {
          return (
            <p className="first:mt-0 mt-3.5 mb-3.5 leading-[1.8] text-[15.5px]" {...props}>
              {children}
            </p>
          );
        },
        h1({ children, ...props }: any) {
          return (
            <h1 className="text-xl font-bold text-zinc-900 first:mt-0 mt-7 mb-3 tracking-tight" {...props}>
              {children}
            </h1>
          );
        },
        h2({ children, ...props }: any) {
          return (
            <h2 className="text-[17px] font-semibold text-zinc-900 first:mt-0 mt-6 mb-2.5 tracking-tight" {...props}>
              {children}
            </h2>
          );
        },
        h3({ children, ...props }: any) {
          return (
            <h3 className="text-[15.5px] font-semibold text-zinc-900 first:mt-0 mt-5 mb-2" {...props}>
              {children}
            </h3>
          );
        },
        h4({ children, ...props }: any) {
          return (
            <h4 className="text-sm font-semibold text-zinc-900 first:mt-0 mt-4 mb-1.5" {...props}>
              {children}
            </h4>
          );
        },
        hr({ ...props }: any) {
          return <hr className="my-7 border-t border-zinc-200/80" {...props} />;
        },
        ul({ children, ...props }: any) {
          return (
            <ul className="first:mt-0 my-3.5 pl-5 list-disc space-y-2 text-[15px] leading-[1.75]" {...props}>
              {children}
            </ul>
          );
        },
        ol({ children, ...props }: any) {
          return (
            <ol className="first:mt-0 my-3.5 pl-5 list-decimal space-y-2 text-[15px] leading-[1.75]" {...props}>
              {children}
            </ol>
          );
        },
        li({ children, ...props }: any) {
          return (
            <li className="pl-1" {...props}>
              {children}
            </li>
          );
        },
        strong({ children, ...props }: any) {
          return (
            <strong className="font-semibold text-zinc-950" {...props}>
              {children}
            </strong>
          );
        },
        blockquote({ children, ...props }: any) {
          return (
            <blockquote className="my-4 border-l-2 border-zinc-300 pl-4 italic text-zinc-600" {...props}>
              {children}
            </blockquote>
          );
        },
        table({ children, ...props }: any) {
          return (
            <div className="my-5 overflow-x-auto rounded-xl border border-zinc-200/90 bg-white shadow-xs">
              <table className="w-full text-left border-collapse" {...props}>
                {children}
              </table>
            </div>
          );
        },
        thead({ children, ...props }: any) {
          return (
            <thead className="bg-zinc-50/90 border-b border-zinc-200/90 text-zinc-700" {...props}>
              {children}
            </thead>
          );
        },
        th({ children, ...props }: any) {
          return (
            <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wider text-zinc-700 align-middle" {...props}>
              {children}
            </th>
          );
        },
        td({ children, ...props }: any) {
          return (
            <td className="px-4 py-3.5 text-[13.5px] leading-relaxed text-zinc-700 border-t border-zinc-100 align-top" {...props}>
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
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Enable text selection tooltip for assistant responses only
  const { selection, clearSelection } = useTextSelection(
    isUser ? { current: null } : contentRef
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
