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
import { IconButton } from "@/components/ui/icon-button";
import { Modal, ModalHeader, ModalBody } from "@/components/ui/modal";
import { Surface } from "@/components/ui/surface";
import { useTextSelection } from "@/hooks/useTextSelection";
import { SelectionTooltip } from "./SelectionTooltip";
import { CodeViewerModal } from "./CodeViewerModal";
import { PdfViewerModal } from "./PdfViewerModal";
import { TableViewerModal } from "./TableViewerModal";
import { AgentToolCallsBanner } from "./AgentToolCallsBanner";
import { QuizCard } from "./QuizCard";
import { ToolCallItem } from "@/hooks/useChatStream";
import { resolveFileUrl } from "@/lib/workspaceApi";

export interface BranchLinkInfo {
  excerpt: string;
  leafId: string;
}

export interface RagSourceItem {
  ref_index: number;
  ref_tag: string;
  chunk_id: string;
  file_id: string;
  filename: string;
  page_number?: number;
  section_header?: string;
  score: number;
  snippet?: string;
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
  workspaceId?: string;
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
function CodeBlock({ children, className, workspaceId, ...props }: any) {
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

  // Interactive Quiz Card renderer for Phase 6 Knowledge Evolution
  if (language === "quiz") {
    return <QuizCard rawCode={rawCode} workspaceId={workspaceId} />;
  }

  if (!language && !className?.includes("hljs")) {
    return (
      <code
        className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-xs font-medium text-foreground"
        {...props}
      >
        {children}
      </code>
    );
  }

  return (
    <div className="group/code my-5 overflow-hidden rounded-xl border border-border bg-code-bg font-mono text-xs leading-relaxed text-code-foreground shadow-xs">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs font-medium select-none bg-code-header-bg">
        <span className="font-mono lowercase text-foreground-muted">{language || "code"}</span>
        <CopyButton
          text={rawCode}
          className="p-1 text-foreground-muted hover:bg-surface-hover hover:text-foreground"
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
  workspaceId,
}: {
  content: string;
  branchLinks?: BranchLinkInfo[];
  onOpenSideBranch?: (childNodeId: string, excerpt: string) => void;
  workspaceId?: string;
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        code(codeProps: any) {
          return <CodeBlock {...codeProps} workspaceId={workspaceId} />;
        },
        p({ children }) {
          return <p className="mb-4 last:mb-0 leading-[1.8]">{children}</p>;
        },
        h1({ children }) {
          return (
            <h1 className="text-xl font-bold text-foreground mt-6 mb-3 tracking-tight">
              {children}
            </h1>
          );
        },
        h2({ children }) {
          return (
            <h2 className="text-lg font-semibold text-foreground mt-5 mb-2.5 tracking-tight">
              {children}
            </h2>
          );
        },
        h3({ children }) {
          return (
            <h3 className="text-base font-semibold text-foreground mt-4 mb-2">
              {children}
            </h3>
          );
        },
        ul({ children }) {
          return (
            <ul className="list-disc list-inside space-y-1.5 mb-4 pl-1 text-foreground">
              {children}
            </ul>
          );
        },
        ol({ children }) {
          return (
            <ol className="list-decimal list-inside space-y-1.5 mb-4 pl-1 text-foreground">
              {children}
            </ol>
          );
        },
        li({ children }) {
          return <li className="leading-relaxed">{children}</li>;
        },
        blockquote({ children }) {
          return (
            <blockquote className="my-4 rounded-r-lg border-l-2 border-border-strong bg-background-secondary py-1.5 pl-4 italic text-foreground-muted">
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
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onOpenSideBranch?.(leafId, excerptText);
                }}
                className="inline h-auto rounded-none p-0 align-baseline font-medium text-primary underline decoration-primary/50 underline-offset-2 hover:bg-transparent hover:text-primary"
                title={`Open branch for "${excerptText}" in parallel split pane`}
              >
                {children}
              </Button>
            );
          }

          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-4 transition-colors hover:text-primary/80"
            >
              {children}
            </a>
          );
        },
        hr() {
          return <hr className="my-6 border-border" />;
        },
        table({ children }) {
          return (
            <div className="my-4 overflow-x-auto rounded-xl border border-border shadow-xs">
              <table className="w-full border-collapse divide-y divide-border text-left text-xs">
                {children}
              </table>
            </div>
          );
        },
        thead({ children }) {
          return <thead className="bg-background-secondary font-semibold text-foreground">{children}</thead>;
        },
        tbody({ children }) {
          return <tbody className="divide-y divide-border-subtle bg-surface">{children}</tbody>;
        },
        tr({ children }) {
          return <tr className="transition-colors hover:bg-surface-hover">{children}</tr>;
        },
        th({ children }) {
          return <th className="px-3.5 py-2.5 font-medium">{children}</th>;
        },
        td({ children }) {
          return (
            <td className="whitespace-pre-wrap px-3.5 py-2 leading-relaxed text-foreground-muted">
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
  workspaceId,
}: ChatMessageProps) {

  const isUser = message.role === "user";
  const contentRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; name: string } | null>(null);
  const [viewingCodeFile, setViewingCodeFile] = useState<FileAttachment | null>(null);
  const [viewingPdfFile, setViewingPdfFile] = useState<FileAttachment | null>(null);
  const [viewingTabularFile, setViewingTabularFile] = useState<FileAttachment | null>(null);
  const [viewingRagPdf, setViewingRagPdf] = useState<{
    filename: string;
    fileId: string;
    page?: number;
  } | null>(null);
  const [viewingRagSnippet, setViewingRagSnippet] = useState<RagSourceItem | null>(null);
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
        <div id={message.id} className="bg-transparent px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-[var(--chat-content-max)] flex-col items-end">
            <Surface variant="raised" radius="card" className="w-full max-w-2xl space-y-2.5 p-3.5 shadow-md transition-all">
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
                className="w-full resize-none bg-transparent text-sm leading-relaxed text-foreground outline-none"
                placeholder="Edit your message..."
              />
              <div className="flex items-center justify-end space-x-2 border-t border-border-subtle pt-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!editContent.trim()}
                  onClick={() => {
                    if (editContent.trim()) {
                      onEditUserMessage?.(message.id, editContent.trim());
                      setIsEditing(false);
                    }
                  }}
                >
                  <span>Save & Submit</span>
                </Button>
              </div>
            </Surface>
          </div>
        </div>
      );
    }

    return (
      <div id={message.id} className="group/user bg-transparent px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[var(--chat-content-max)] items-center justify-end gap-1.5">
          {/* Edit Prompt Button (Only on the last user message) */}
          {isLastUserMessage && onEditUserMessage && (
            <IconButton
              label="Edit message"
              onClick={() => {
                setEditContent(message.content);
                setIsEditing(true);
              }}
              className="opacity-0 transition-opacity group-hover/user:opacity-100 group-focus-within/user:opacity-100"
              title="Edit message"
            >
              <Pencil aria-hidden="true" className="size-3.5" />
            </IconButton>
          )}

          {/* Copy Button */}
          {message.content && (
            <CopyButton
              text={message.content}
              className="opacity-0 transition-opacity group-hover/user:opacity-100 group-focus-within/user:opacity-100"
              title="Copy prompt"
            />
          )}

          {/* Bubble */}
          <Surface variant="muted" radius="card" className="max-w-2xl border-0 bg-muted px-4 py-3 text-foreground shadow-2xs sm:px-5">
            {message.highlightedContext && (
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-md border border-success/30 bg-success-bg px-2 py-0.5 text-2xs font-medium text-success shadow-2xs">
                <GitBranch className="size-3 shrink-0" />
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
                <Surface variant="base" radius="widget" className="mb-2.5 flex flex-col space-y-2 border-0 bg-transparent">
                  {/* Image Thumbnails */}
                  {imageAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {imageAttachments.map((att, idx) => {
                        const src = att.data || (att.url ? resolveFileUrl(att.url) : "");
                        if (!src) return null;
                        return (
                          <Button
                            key={att.id || idx}
                            variant="outline"
                            size="default"
                            className="group/img relative h-auto max-w-xs overflow-hidden rounded-xl p-0 shadow-2xs"
                            onClick={() => setLightboxImage({ src, name: att.name || "Attachment" })}
                            title="Click to view full screen"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={src}
                              alt={att.name || "Attachment"}
                              className="max-h-60 rounded-xl object-contain group-hover/img:scale-[1.01] transition-transform duration-150"
                            />
                          </Button>
                        );
                      })}
                    </div>
                  )}

                  {/* PDF Document Cards */}
                  {pdfAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {pdfAttachments.map((att, idx) => (
                        <Button
                          key={att.id || idx}
                          variant="outline"
                          size="default"
                          onClick={() => setViewingPdfFile(att)}
                          className="group/pdf flex h-auto max-w-[260px] items-center space-x-2.5 rounded-xl border-success/30 bg-success-bg px-3 py-2 text-left hover:bg-success-bg hover:shadow-xs"
                          title="Click to view PDF in full screen"
                        >
                          <div className="shrink-0 rounded-lg border border-success/30 bg-surface p-1.5 text-success transition-transform group-hover/pdf:scale-105">
                            <FileText className="size-4" />
                          </div>
                          <div className="flex flex-col min-w-0 pr-1">
                            <span className="truncate text-xs font-semibold text-foreground">
                              {att.name}
                            </span>
                            <span className="text-2xs font-medium text-success">
                              PDF Document · Click to view
                            </span>
                          </div>
                        </Button>
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
                          <Button
                            key={att.id || idx}
                            variant="outline"
                            size="default"
                            onClick={() => setViewingTabularFile(att)}
                            className="group/table flex h-auto max-w-[260px] items-center space-x-2.5 rounded-xl border-info/30 bg-info-bg px-3 py-2 text-left hover:bg-info-bg hover:shadow-xs"
                            title="Click to explore table data"
                          >
                            <div className="shrink-0 rounded-lg border border-info/30 bg-surface p-1.5 text-info transition-transform group-hover/table:scale-105">
                              <FileSpreadsheet className="size-4" />
                            </div>
                            <div className="flex flex-col min-w-0 pr-1">
                              <span className="truncate font-mono text-xs font-semibold text-foreground">
                                {att.name}
                              </span>
                              <span className="text-2xs font-medium text-info">
                                {ext} {rowCount !== undefined ? `· ${rowCount.toLocaleString()} rows` : "· Click to explore"}
                              </span>
                            </div>
                          </Button>
                        );
                      })}
                    </div>
                  )}

                  {/* Code & Plain Text Document Cards */}
                  {codeAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {codeAttachments.map((att, idx) => {
                        const isCode = att.fileCategory === "code";
                        const isMd =
                          att.name.toLowerCase().endsWith(".md") ||
                          att.name.toLowerCase().endsWith(".markdown");
                        const label = isMd
                          ? "MARKDOWN"
                          : att.fileCategory?.toUpperCase() || "FILE";

                        return (
                          <Button
                            key={att.id || idx}
                            variant="outline"
                            size="default"
                            onClick={() => setViewingCodeFile(att)}
                            className={`group/card flex h-auto max-w-[260px] items-center space-x-2.5 rounded-xl px-3 py-2 text-left ${
                              isMd
                                ? "border-info/30 bg-info-bg hover:bg-info-bg hover:shadow-xs"
                                : "border-border bg-surface hover:bg-surface-hover hover:shadow-xs"
                            }`}
                            title={
                              isMd
                                ? "Click to preview markdown"
                                : "Click to view file content"
                            }
                          >
                            <div
                              className={`p-1.5 rounded-lg border shrink-0 transition-colors ${
                                isMd
                                ? "border-info/30 bg-surface text-info transition-transform group-hover/card:scale-105"
                                : "border-border bg-muted text-foreground-muted group-hover/card:bg-surface-hover"
                              }`}
                            >
                              {isMd ? (
                                <FileText className="size-4" />
                              ) : isCode ? (
                                <Code className="size-4 text-success" />
                              ) : (
                                <FileText className="size-4" />
                              )}
                            </div>
                            <div className="flex flex-col min-w-0 pr-1">
                              <span className="truncate font-mono text-xs font-medium text-foreground">
                                {att.name}
                              </span>
                              <span
                                className={`text-2xs font-mono ${
                                  isMd
                                    ? "font-medium text-info"
                                    : "text-foreground-subtle"
                                }`}
                              >
                                {label} · {isMd ? "Preview" : "View"}
                              </span>
                            </div>
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </Surface>
              );
            })()}

            <div className="rounded-2xl bg-muted text-sm font-normal leading-relaxed select-text whitespace-pre-wrap">
              {message.content}
            </div>
          </Surface>
        </div>

        {/* In-Page Full Screen Image Lightbox */}
        {lightboxImage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 text-foreground backdrop-blur-sm animate-in fade-in-50 duration-150"
            onClick={() => setLightboxImage(null)}
          >
            <div
              className="relative max-w-5xl max-h-[92vh] flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top action bar */}
              <div className="flex w-full items-center justify-between pb-3 text-xs">
                <span className="font-medium truncate max-w-md">{lightboxImage.name}</span>
                <div className="flex items-center space-x-2">
                  <a
                    href={lightboxImage.src}
                    download={lightboxImage.name}
                    className="flex items-center space-x-1.5 rounded-lg bg-surface/10 px-2.5 py-1 text-foreground transition-colors hover:bg-surface/20"
                    title="Download image"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                  <IconButton
                    label="Close preview"
                    onClick={() => setLightboxImage(null)}
                    className="bg-surface/10 text-foreground hover:bg-surface/20 hover:text-foreground"
                    title="Close preview (Esc)"
                  >
                    <X aria-hidden="true" className="size-4" />
                  </IconButton>
                </div>
              </div>

              {/* Centered Image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxImage.src}
                alt={lightboxImage.name}
                className="max-h-[82vh] max-w-[92vw] rounded-xl border border-border object-contain shadow-2xl animate-in zoom-in-95 duration-150"
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
    <div id={message.id} className="group bg-transparent px-4 py-3 sm:px-6">
      {/* Floating Exploration Tooltip on Text Selection */}
      {selection && (
        <SelectionTooltip
          selection={selection}
          onExplore={handleExplore}
          onSearch={handleSearch}
        />
      )}


      <div className="mx-auto flex max-w-[var(--chat-content-max)] space-x-3.5">
        {/* Assistant Avatar */}
        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5 text-foreground shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-foreground" />
        </div>

        {/* Message Content Container */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Real-time Agent Tool Execution Actions */}
          {Boolean(message.metadata?.toolCalls) && (
            <AgentToolCallsBanner
              toolCalls={message.metadata?.toolCalls as ToolCallItem[]}
            />
          )}

          {/* Grounded RAG Knowledge Base Sources Strip */}
          {Boolean(
            message.metadata?.ragSources &&
              (message.metadata.ragSources as RagSourceItem[]).length > 0
          ) && (
            <Surface variant="muted" radius="widget" className="mb-2 space-y-1.5 border-0 bg-info-bg p-2.5 select-none animate-in fade-in-50 duration-150">
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-foreground">
                <Sparkles className="size-3.5 text-info" />
                <span>Verified Sources</span>
                <span className="rounded-full bg-surface px-1.5 py-0.5 text-2xs font-bold text-info">
                  {(message.metadata?.ragSources as RagSourceItem[]).length}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(message.metadata?.ragSources as RagSourceItem[]).map((src) => {
                  const isPdf = src.filename.toLowerCase().endsWith(".pdf");
                  return (
                    <Button
                      key={`${src.chunk_id}-${src.ref_index}`}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (isPdf) {
                          setViewingRagPdf({
                            filename: src.filename,
                            fileId: src.file_id,
                            page: src.page_number,
                          });
                        } else {
                          setViewingRagSnippet(src);
                        }
                      }}
                      className="group/src h-auto items-center space-x-1.5 border-info/30 bg-surface px-2.5 py-1 text-xs text-foreground-muted hover:bg-surface-hover hover:shadow-xs"
                      title={
                        src.snippet
                          ? `Snippet: ${src.snippet.slice(0, 160)}...`
                          : src.filename
                      }
                    >
                      <FileText className="size-3.5 text-info" />
                      <span className="max-w-[200px] truncate font-medium text-foreground">
                        {src.filename}
                      </span>
                      {src.page_number && (
                        <span className="rounded bg-info-bg px-1 py-0.5 font-mono text-2xs font-semibold text-info">
                          p. {src.page_number}
                        </span>
                      )}
                    </Button>
                  );
                })}
              </div>
            </Surface>
          )}

          {/* Markdown Rendered Body */}
          <div
            ref={contentRef}
            className={`text-base select-text ${
              message.isError ? "text-destructive" : "text-foreground"
            } leading-[1.8] break-words`}
          >
            {message.content ? (
              <MarkdownRenderer
                content={message.content}
                branchLinks={branchLinks}
                onOpenSideBranch={onOpenSideBranch}
                workspaceId={
                  workspaceId ||
                  (tree as unknown as { workspaceId?: string })?.workspaceId ||
                  (message as unknown as { workspaceId?: string })?.workspaceId
                }
              />
            ) : message.isStreaming ? (
              /* Smooth Staggered Wave Thinking State */
              <div className="flex items-center space-x-2 py-1 select-none">
                <div className="flex space-x-1 items-center">
                  <span className="size-1.5 animate-bounce rounded-full bg-foreground-subtle [animation-delay:-0.3s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-foreground-subtle [animation-delay:-0.15s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-foreground-subtle" />
                </div>
                <span className="text-xs font-medium text-foreground-subtle">Thinking...</span>
              </div>
            ) : null}

            {/* Smooth Breathing Streaming Caret */}
            {message.isStreaming && message.content && (
              <span className="ml-1 inline-block h-4 w-0.5 animate-pulse rounded-full bg-foreground align-middle" />
            )}
          </div>

          {/* Action Row */}
          <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
            {!isUser && message.content ? (
              <div className="flex items-center space-x-1">
                {/* Copy Button */}
                <CopyButton
                  text={message.content}
                  className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                  title="Copy response"
                />

                {/* Response Rating: Thumbs Up */}
                {onRateResponse && !message.isStreaming && (
                  <IconButton
                    label={(message.metadata?.rating as string) === "up" ? "Remove positive rating" : "Good response"}
                    onClick={() =>
                      onRateResponse(
                        message.id,
                        (message.metadata?.rating as string) === "up" ? null : "up"
                      )
                    }
                    className={`opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${
                      (message.metadata?.rating as string) === "up"
                        ? "bg-muted text-foreground opacity-100"
                        : "text-foreground-subtle"
                    }`}
                    title={
                      (message.metadata?.rating as string) === "up"
                        ? "Remove positive rating"
                        : "Good response (thumbs up)"
                    }
                  >
                    <ThumbsUp aria-hidden="true"
                      className={`w-3.5 h-3.5 ${
                        (message.metadata?.rating as string) === "up"
                          ? "fill-foreground-muted/50 stroke-[1.8]"
                          : "stroke-[1.75]"
                      }`}
                    />
                  </IconButton>
                )}

                {/* Response Rating: Thumbs Down */}
                {onRateResponse && !message.isStreaming && (
                  <IconButton
                    label={(message.metadata?.rating as string) === "down" ? "Remove negative rating" : "Poor response"}
                    onClick={() =>
                      onRateResponse(
                        message.id,
                        (message.metadata?.rating as string) === "down" ? null : "down"
                      )
                    }
                    className={`opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${
                      (message.metadata?.rating as string) === "down"
                        ? "bg-muted text-foreground opacity-100"
                        : "text-foreground-subtle"
                    }`}
                    title={
                      (message.metadata?.rating as string) === "down"
                        ? "Remove negative rating"
                        : "Poor response (thumbs down)"
                    }
                  >
                    <ThumbsDown aria-hidden="true"
                      className={`w-3.5 h-3.5 ${
                        (message.metadata?.rating as string) === "down"
                          ? "fill-foreground-muted/50 stroke-[1.8]"
                          : "stroke-[1.75]"
                      }`}
                    />
                  </IconButton>
                )}

                {/* Regenerate Button (Only on the last assistant message) */}
                {onRegenerate && isLastAssistantMessage && !message.isStreaming && (
                  <IconButton
                    label="Regenerate response"
                    onClick={() => onRegenerate(message.id)}
                    className="opacity-0 text-foreground-subtle transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                    title="Regenerate response"
                  >
                    <RotateCcw aria-hidden="true" className="size-3.5 stroke-[1.75]" />
                  </IconButton>
                )}



                {/* Retry Error Button */}
                {message.isError && onRetry && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRetry}
                    className="flex h-6 space-x-1 border-border px-2 text-2xs text-foreground-muted shadow-2xs hover:text-foreground"
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

        {/* Full-Screen PDF Viewer for Grounded RAG Citation */}
        {viewingRagPdf && (
          <PdfViewerModal
            isOpen={Boolean(viewingRagPdf)}
            onClose={() => setViewingRagPdf(null)}
            filename={viewingRagPdf.filename}
            url={resolveFileUrl(viewingRagPdf.fileId)}
            initialPage={viewingRagPdf.page}
          />
        )}

        {/* Snippet Viewer Modal for Grounded Sources */}
        {viewingRagSnippet && (
          <Modal
            isOpen={Boolean(viewingRagSnippet)}
            onClose={() => setViewingRagSnippet(null)}
            size="2xl"
          >
            <ModalHeader
              title={viewingRagSnippet.filename}
              description={
                viewingRagSnippet.section_header
                  ? `§ ${viewingRagSnippet.section_header}`
                  : undefined
              }
              icon={<FileText className="size-4 text-info" />}
              onClose={() => setViewingRagSnippet(null)}
            >
              {viewingRagSnippet.page_number && (
                <span className="rounded bg-info-bg px-1.5 py-0.5 font-mono text-2xs font-semibold text-info">
                  Page {viewingRagSnippet.page_number}
                </span>
              )}
            </ModalHeader>
            <ModalBody className="p-5 font-mono text-xs text-foreground whitespace-pre-wrap leading-relaxed bg-background-secondary/30 max-h-[70vh]">
              {viewingRagSnippet.snippet || "No snippet content available."}
            </ModalBody>
          </Modal>
        )}
      </div>
    </div>
  );
}
