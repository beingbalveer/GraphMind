"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Download,
  Copy,
  Check,
  FileCode,
  FileText,
  Eye,
  Code,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import { formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Badge } from "@/components/ui/badge";

interface CodeViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  filename: string;
  content: string;
  language?: string;
  sizeBytes?: number;
  downloadUrl?: string;
}

export function CodeViewerModal({
  isOpen,
  onClose,
  filename,
  content,
  language,
  sizeBytes,
  downloadUrl,
}: CodeViewerModalProps) {
  const [copied, setCopied] = useState(false);

  const isMarkdown =
    filename.toLowerCase().endsWith(".md") ||
    filename.toLowerCase().endsWith(".markdown");

  const [viewMode, setViewMode] = useState<"preview" | "raw">(
    isMarkdown ? "preview" : "raw"
  );

  useEffect(() => {
    setViewMode(isMarkdown ? "preview" : "raw");
  }, [filename, isMarkdown]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, "_blank");
      return;
    }
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lines = content.split("\n");
  const inferredLang =
    language ||
    filename.split(".").pop() ||
    (isMarkdown ? "markdown" : "text");

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="full" className="max-w-5xl h-[90vh]">
      {/* Header */}
      <div className="h-13 px-5 border-b border-border flex items-center justify-between shrink-0 select-none bg-surface">
        <div className="flex items-center gap-2.5 min-w-0 pr-4">
          <div
            className={`p-1.5 rounded-lg border ${
              isMarkdown
                ? "bg-blue-50 border-blue-200/80 text-blue-600 dark:bg-blue-950/40 dark:border-blue-900"
                : "bg-emerald-50 border-emerald-200/80 text-emerald-600 dark:bg-emerald-950/40 dark:border-emerald-900"
            }`}
          >
            {isMarkdown ? (
              <FileText className="w-4 h-4" />
            ) : (
              <FileCode className="w-4 h-4" />
            )}
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-foreground truncate">
              {filename}
            </span>
            <Badge variant={isMarkdown ? "info" : "success"}>
              {isMarkdown ? "MARKDOWN" : inferredLang.toUpperCase()}
            </Badge>
            {sizeBytes && (
              <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
                ({formatBytes(sizeBytes)})
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Markdown Preview / Source Toggle */}
          {isMarkdown && (
            <SegmentedTabs
              value={viewMode}
              onChange={(val) => setViewMode(val as "preview" | "raw")}
              size="sm"
              items={[
                { id: "preview", label: "Preview", icon: Eye },
                { id: "raw", label: "Source", icon: Code },
              ]}
            />
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            title="Copy file contents"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 mr-1" />
                <span className="text-emerald-700 font-semibold">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-zinc-500 mr-1" />
                <span>Copy</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownload}
            title="Download file"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            <span>Download</span>
          </Button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer ml-1"
            title="Close (Esc)"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Code Viewer Body */}
      <div className="flex-1 bg-zinc-950 overflow-auto text-zinc-200 font-mono text-xs flex flex-col min-h-0">
        {isMarkdown && viewMode === "preview" ? (
          <div className="p-6 sm:p-8 bg-surface text-foreground font-sans flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto prose prose-zinc prose-sm sm:prose-base dark:prose-invert">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeHighlight, rehypeKatex]}
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    const isInline = !match;
                    if (isInline) {
                      return (
                        <code
                          className="px-1.5 py-0.5 rounded-md bg-muted border border-border text-foreground font-mono text-xs font-medium"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    }
                    return (
                      <div className="my-4 rounded-xl overflow-hidden border border-zinc-800 bg-code-bg text-zinc-100 font-mono text-xs leading-relaxed shadow-xs">
                        <div className="px-4 py-2 bg-code-header-bg border-b border-zinc-800/80 text-xs text-zinc-400 font-medium flex items-center justify-between select-none">
                          <span className="lowercase font-mono text-zinc-400">
                            {match[1]}
                          </span>
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
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 overflow-auto min-h-0">
            {/* Line numbers gutter */}
            <div className="py-4 pl-4 pr-3 select-none text-right text-zinc-600 font-mono text-xs bg-zinc-900/60 border-r border-zinc-800/80 shrink-0 min-w-[3.5rem]">
              {lines.map((_, i) => (
                <div key={i} className="leading-6">
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Raw code content */}
            <pre className="p-4 overflow-auto flex-1 font-mono text-xs leading-6 text-zinc-200 whitespace-pre tab-4 select-text">
              <code>{content}</code>
            </pre>
          </div>
        )}
      </div>

      {/* Footer bar */}
      <div className="px-5 py-2 border-t border-zinc-800 bg-zinc-900 text-xs text-zinc-400 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2">
          <span>{lines.length} lines</span>
          <span>•</span>
          <span>{content.length.toLocaleString()} characters</span>
          {inferredLang && (
            <>
              <span>•</span>
              <span className="uppercase font-medium text-zinc-300">
                {inferredLang}
              </span>
            </>
          )}
        </div>
        <div className="text-zinc-400 text-xs">UTF-8</div>
      </div>
    </Modal>
  );
}
