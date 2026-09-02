"use client";

import React, { useRef, memo, useCallback, useMemo, useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import {
  Sparkles,
  RotateCcw,
  GitBranch,
  Pencil,
  ThumbsUp,
  ThumbsDown,
  X,
  Download,
  Code,
  FileText,
  FileSpreadsheet,
} from "lucide-react";

import {
  TreeNode,
  ConversationTree,
  FileAttachment,
  getNodeChildren,
  getBranchLinearLeafNode,
} from "@graphmind/shared";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { useTextSelection } from "@/hooks/useTextSelection";
import { SelectionTooltip } from "./SelectionTooltip";
import { CodeViewerModal } from "./CodeViewerModal";
import { PdfViewerModal } from "./PdfViewerModal";
import { TableViewerModal } from "./TableViewerModal";
import { resolveFileUrl } from "@/lib/workspaceApi";

export interface BranchLinkInfo {
  excerpt: string;
  leafId: string;
}

interface ChatMessageProps {
  message: TreeNode & { isStreaming?: boolean; isError?: boolean };
  tree?: ConversationTree | null;
  isLastUserMessage?: boolean;
  isLastAssistantMessage?: boolean;
  onRetry?: () => void;
  onRegenerate?: (nodeId: string) => void;
  onEditUserMessage?: (userNodeId: string, newContent: string) => void;
  onSwitchBranch?: (nodeId: string) => void;
  onExploreBranch?: (messageId: string, highlightedText: string) => void;
  onOpenSideBranch?: (childNodeId: string, excerpt: string) => void;
  onRateResponse?: (nodeId: string, rating: "up" | "down" | null) => void;
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
  isLastUserMessage = false,
  isLastAssistantMessage = false,
  onRetry,
  onRegenerate,
  onEditUserMessage,
  onSwitchBranch: _onSwitchBranch,
  onExploreBranch,
  onOpenSideBranch,
  onRateResponse,
}: ChatMessageProps) {

  const isUser = message.role === "user";
  const contentRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; name: string } | null>(null);
  const [viewingCodeFile, setViewingCodeFile] = useState<FileAttachment | null>(null);
  const [viewingPdfFile, setViewingPdfFile] = useState<FileAttachment | null>(null);
  const [viewingTabularFile, setViewingTabularFile] = useState<FileAttachment | null>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus and auto-resize textarea when entering edit mode
  useEffect(() => {
    if (isEditing && editTextareaRef.current) {
      editTextareaRef.current.focus();
      editTextareaRef.current.style.height = "auto";
      editTextareaRef.current.style.height = `${editTextareaRef.current.scrollHeight}px`;
    }
  }, [isEditing]);

  // Handle escape key to dismiss fullscreen lightbox
  useEffect(() => {
    if (!lightboxImage) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightboxImage(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxImage]);

  // Enable text selection tooltip for assistant responses only
  const { selection, clearSelection } = useTextSelection(
    isUser ? { current: null } : contentRef
  );

  // Find all child branches created from this message that have highlighted context
  const branchedChildren = useMemo(() => {
    if (!tree) return [];
    return getNodeChildren(tree, message.id).filter(
      (child) => Boolean(child.highlightedContext)
    );
  }, [tree, message.id]);

  // Helper to get the linear leaf of a specific branch
  const getBranchLeafId = useCallback(
    (userChild: TreeNode): string => {
      if (!tree) return userChild.id;
      return getBranchLinearLeafNode(tree, userChild.id).id;
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
    if (isEditing) {
      return (
        <div id={message.id} className="py-3 px-4 sm:px-6 bg-transparent">
          <div className="max-w-3xl mx-auto flex flex-col items-end">
            <div className="w-full max-w-2xl bg-white rounded-2xl border border-zinc-300 shadow-md p-3.5 space-y-2.5 transition-all">
              <textarea
                ref={editTextareaRef}
                value={editContent}
                onChange={(e) => {
                  setEditContent(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (editContent.trim()) {
                      onEditUserMessage?.(message.id, editContent.trim());
                      setIsEditing(false);
                    }
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setIsEditing(false);
                  }
                }}
                rows={2}
                className="w-full text-[14.5px] text-zinc-900 leading-relaxed outline-none resize-none bg-transparent"
                placeholder="Edit your message..."
              />
              <div className="flex items-center justify-end space-x-2 pt-1.5 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!editContent.trim()}
                  onClick={() => {
                    if (editContent.trim()) {
                      onEditUserMessage?.(message.id, editContent.trim());
                      setIsEditing(false);
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center space-x-1"
                >
                  <span>Save & Submit</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div id={message.id} className="py-3 px-4 sm:px-6 bg-transparent group/user">
        <div className="max-w-3xl mx-auto flex items-center justify-end gap-1.5">
          {/* Edit Prompt Button (Only on the last user message) */}
          {isLastUserMessage && onEditUserMessage && (
            <button
              type="button"
              onClick={() => {
                setEditContent(message.content);
                setIsEditing(true);
              }}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 opacity-0 group-hover/user:opacity-100 transition-all cursor-pointer flex items-center justify-center"
              title="Edit message"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Copy Button */}
          {message.content && (
            <CopyButton
              text={message.content}
              className="opacity-0 group-hover/user:opacity-100 transition-opacity"
              title="Copy prompt"
            />
          )}

          {/* Bubble */}
          <div className="max-w-2xl rounded-2xl bg-zinc-100/90 text-zinc-900 px-4.5 py-3 border border-zinc-200/70 shadow-2xs">
            {message.highlightedContext && (
              <div className="text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200/80 rounded-md px-2 py-0.5 mb-2 inline-flex items-center space-x-1.5 shadow-2xs">
                <GitBranch className="w-3 h-3 text-emerald-600 shrink-0" />
                <span className="truncate">Sub-topic: &ldquo;{message.highlightedContext}&rdquo;</span>
              </div>
            )}

            {/* Attached Assets (Images & Code/Documents) */}
            {(() => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const rawAttachments = message.attachments || (message.metadata as any)?.attachments;
              const attachmentsList = Array.isArray(rawAttachments)
                ? (rawAttachments as FileAttachment[])
                : [];
              if (attachmentsList.length === 0) return null;

              const imageAttachments = attachmentsList.filter(
                (a) => a.fileCategory === "image" || a.data?.startsWith("data:image/") || a.mimeType?.startsWith("image/")
              );
              const pdfAttachments = attachmentsList.filter(
                (a) => a.mimeType === "application/pdf" || a.name.toLowerCase().endsWith(".pdf")
              );
              const tabularAttachments = attachmentsList.filter(
                (a) =>
                  a.fileCategory === "tabular" ||
                  [".csv", ".tsv", ".jsonl", ".ndjson", ".xlsx"].some((ext) =>
                    a.name.toLowerCase().endsWith(ext)
                  )
              );
              const codeAttachments = attachmentsList.filter(
                (a) =>
                  !imageAttachments.includes(a) &&
                  !pdfAttachments.includes(a) &&
                  !tabularAttachments.includes(a)
              );

              return (
                <div className="flex flex-col space-y-2 mb-2.5">
                  {/* Image Thumbnails */}
                  {imageAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {imageAttachments.map((att, idx) => {
                        const src = att.data || (att.url ? resolveFileUrl(att.url) : "");
                        if (!src) return null;
                        return (
                          <div
                            key={att.id || idx}
                            className="relative rounded-xl overflow-hidden border border-zinc-200/90 bg-white max-w-xs shadow-2xs hover:border-zinc-300 transition-all cursor-pointer group/img"
                            onClick={() => setLightboxImage({ src, name: att.name || "Attachment" })}
                            title="Click to view full screen"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={src}
                              alt={att.name || "Attachment"}
                              className="max-h-60 rounded-xl object-contain group-hover/img:scale-[1.01] transition-transform duration-150"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* PDF Document Cards */}
                  {pdfAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {pdfAttachments.map((att, idx) => (
                        <div
                          key={att.id || idx}
                          onClick={() => setViewingPdfFile(att)}
                          className="flex items-center space-x-2.5 px-3 py-2 rounded-xl border border-red-200/90 bg-red-50/40 hover:bg-red-50/80 hover:border-red-300 hover:shadow-xs transition-all cursor-pointer group/pdf max-w-[260px]"
                          title="Click to view PDF in full screen"
                        >
                          <div className="p-1.5 rounded-lg bg-white border border-red-200 text-red-600 shrink-0 group-hover/pdf:scale-105 transition-transform">
                            <FileText className="w-4 h-4 text-red-600" />
                          </div>
                          <div className="flex flex-col min-w-0 pr-1">
                            <span className="text-xs font-semibold text-zinc-900 truncate">
                              {att.name}
                            </span>
                            <span className="text-[10px] text-red-600/80 font-medium">
                              PDF Document · Click to view
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tabular Dataset Cards */}
                  {tabularAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {tabularAttachments.map((att, idx) => {
                        const rowCount = (att.metadata as Record<string, unknown>)?.row_count as number | undefined;
                        const ext = att.name.split(".").pop()?.toUpperCase() || "TABLE";
                        return (
                          <div
                            key={att.id || idx}
                            onClick={() => setViewingTabularFile(att)}
                            className="flex items-center space-x-2.5 px-3 py-2 rounded-xl border border-emerald-200/90 bg-emerald-50/40 hover:bg-emerald-50/80 hover:border-emerald-300 hover:shadow-xs transition-all cursor-pointer group/table max-w-[260px]"
                            title="Click to explore table data"
                          >
                            <div className="p-1.5 rounded-lg bg-white border border-emerald-200 text-emerald-700 shrink-0 group-hover/table:scale-105 transition-transform">
                              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div className="flex flex-col min-w-0 pr-1">
                              <span className="text-xs font-semibold text-zinc-900 truncate font-mono">
                                {att.name}
                              </span>
                              <span className="text-[10px] text-emerald-700/90 font-medium">
                                {ext} {rowCount !== undefined ? `· ${rowCount.toLocaleString()} rows` : "· Click to explore"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Code & Plain Text Document Cards */}
                  {codeAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {codeAttachments.map((att, idx) => {
                        const isCode = att.fileCategory === "code";
                        return (
                          <div
                            key={att.id || idx}
                            onClick={() => setViewingCodeFile(att)}
                            className="flex items-center space-x-2.5 px-3 py-2 rounded-xl border border-zinc-200/90 bg-white hover:border-zinc-300 hover:shadow-xs transition-all cursor-pointer group/card max-w-[260px]"
                            title="Click to view file content"
                          >
                            <div className="p-1.5 rounded-lg bg-zinc-100 border border-zinc-200/80 text-zinc-700 shrink-0 group-hover/card:bg-zinc-200 transition-colors">
                              {isCode ? (
                                <Code className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <FileText className="w-4 h-4 text-blue-600" />
                              )}
                            </div>
                            <div className="flex flex-col min-w-0 pr-1">
                              <span className="text-xs font-medium text-zinc-900 truncate font-mono">
                                {att.name}
                              </span>
                              <span className="text-[10px] text-zinc-400 font-mono">
                                {att.fileCategory?.toUpperCase() || "FILE"} · View
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="text-[14.5px] leading-relaxed select-text font-normal whitespace-pre-wrap">
              {message.content}
            </div>
          </div>
        </div>

        {/* In-Page Full Screen Image Lightbox */}
        {lightboxImage && (
          <div
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in-50 duration-150"
            onClick={() => setLightboxImage(null)}
          >
            <div
              className="relative max-w-5xl max-h-[92vh] flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top action bar */}
              <div className="w-full flex items-center justify-between pb-3 text-white/90 text-xs">
                <span className="font-medium truncate max-w-md">{lightboxImage.name}</span>
                <div className="flex items-center space-x-2">
                  <a
                    href={lightboxImage.src}
                    download={lightboxImage.name}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center space-x-1.5 cursor-pointer"
                    title="Download image"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setLightboxImage(null)}
                    className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                    title="Close preview (Esc)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Centered Image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxImage.src}
                alt={lightboxImage.name}
                className="max-h-[82vh] max-w-[92vw] rounded-xl object-contain shadow-2xl border border-white/15 animate-in zoom-in-95 duration-150"
              />
            </div>
          </div>
        )}

        {/* In-Page Full Screen Code Viewer Modal */}
        {viewingCodeFile && (
          <CodeViewerModal
            isOpen={Boolean(viewingCodeFile)}
            onClose={() => setViewingCodeFile(null)}
            filename={viewingCodeFile.name}
            content={viewingCodeFile.extractedText || "No content extracted for this file."}
            sizeBytes={viewingCodeFile.sizeBytes}
            downloadUrl={viewingCodeFile.url ? resolveFileUrl(viewingCodeFile.url) : undefined}
          />
        )}

        {/* In-Page Full Screen PDF Viewer Modal */}
        {viewingPdfFile && (
          <PdfViewerModal
            isOpen={Boolean(viewingPdfFile)}
            onClose={() => setViewingPdfFile(null)}
            filename={viewingPdfFile.name}
            url={viewingPdfFile.url ? resolveFileUrl(viewingPdfFile.url) : undefined}
            data={viewingPdfFile.data}
            sizeBytes={viewingPdfFile.sizeBytes}
          />
        )}

        {/* In-Page Full Screen Table Viewer Modal */}
        {viewingTabularFile && (
          <TableViewerModal
            isOpen={Boolean(viewingTabularFile)}
            onClose={() => setViewingTabularFile(null)}
            filename={viewingTabularFile.name}
            url={viewingTabularFile.url ? resolveFileUrl(viewingTabularFile.url) : undefined}
            data={viewingTabularFile.data}
            extractedText={viewingTabularFile.extractedText}
            metadata={viewingTabularFile.metadata as Record<string, unknown>}
            sizeBytes={viewingTabularFile.sizeBytes}
          />
        )}
      </div>
    );
  }

  return (
    <div id={message.id} className="py-3 px-4 sm:px-6 bg-white group">
      {/* Floating Exploration Tooltip on Text Selection */}
      {selection && (
        <SelectionTooltip
          selection={selection}
          onExplore={handleExplore}
          onSearch={handleSearch}
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

          {/* Action Row */}
          <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
            {!isUser && message.content ? (
              <div className="flex items-center space-x-1.5">
                {/* Copy Button */}
                <CopyButton
                  text={message.content}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Copy response"
                />

                {/* Response Rating: Thumbs Up */}
                {onRateResponse && !message.isStreaming && (
                  <button
                    type="button"
                    onClick={() =>
                      onRateResponse(
                        message.id,
                        (message.metadata?.rating as string) === "up" ? null : "up"
                      )
                    }
                    className={`p-1 rounded-md transition-all cursor-pointer flex items-center justify-center opacity-0 group-hover:opacity-100 ${
                      (message.metadata?.rating as string) === "up"
                        ? "text-zinc-700 bg-zinc-100/90 border border-zinc-200/80 shadow-2xs"
                        : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100/60"
                    }`}
                    title={
                      (message.metadata?.rating as string) === "up"
                        ? "Remove positive rating"
                        : "Good response (thumbs up)"
                    }
                  >
                    <ThumbsUp
                      className={`w-3.5 h-3.5 ${
                        (message.metadata?.rating as string) === "up"
                          ? "fill-zinc-400/50 stroke-[1.8]"
                          : ""
                      }`}
                    />
                  </button>
                )}

                {/* Response Rating: Thumbs Down */}
                {onRateResponse && !message.isStreaming && (
                  <button
                    type="button"
                    onClick={() =>
                      onRateResponse(
                        message.id,
                        (message.metadata?.rating as string) === "down" ? null : "down"
                      )
                    }
                    className={`p-1 rounded-md transition-all cursor-pointer flex items-center justify-center opacity-0 group-hover:opacity-100 ${
                      (message.metadata?.rating as string) === "down"
                        ? "text-zinc-700 bg-zinc-100/90 border border-zinc-200/80 shadow-2xs"
                        : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100/60"
                    }`}
                    title={
                      (message.metadata?.rating as string) === "down"
                        ? "Remove negative rating"
                        : "Poor response (thumbs down)"
                    }
                  >
                    <ThumbsDown
                      className={`w-3.5 h-3.5 ${
                        (message.metadata?.rating as string) === "down"
                          ? "fill-zinc-400/50 stroke-[1.8]"
                          : ""
                      }`}
                    />
                  </button>
                )}




                {/* Regenerate Button (Only on the last assistant message) */}
                {onRegenerate && isLastAssistantMessage && !message.isStreaming && (
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

