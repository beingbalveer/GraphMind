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

interface CodeViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  filename: string;
  content: string;
  language?: string;
  sizeBytes?: number;
  downloadUrl?: string;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return "";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
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

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
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

  const inferredLang =
    language || filename.split(".").pop()?.toLowerCase() || "text";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in-50 duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-5xl h-[88vh] rounded-2xl shadow-2xl border border-zinc-200/90 flex flex-col overflow-hidden animate-in zoom-in-98 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between shrink-0 select-none bg-zinc-50/80">
          <div className="flex items-center space-x-2.5 min-w-0 pr-4">
            <div
              className={`p-1.5 rounded-lg border shrink-0 ${
                isMarkdown
                  ? "bg-blue-50 border-blue-200/80 text-blue-600"
                  : "bg-emerald-50 border-emerald-200/80 text-emerald-600"
              }`}
            >
              {isMarkdown ? (
                <FileText className="w-4 h-4" />
              ) : (
                <FileCode className="w-4 h-4" />
              )}
            </div>
            <div className="flex items-center space-x-2 min-w-0">
              <span className="text-sm font-semibold text-zinc-950 truncate font-mono">
                {filename}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border font-mono ${
                  isMarkdown
                    ? "bg-blue-100 text-blue-800 border-blue-200/80"
                    : "bg-emerald-100 text-emerald-800 border-emerald-200/80"
                }`}
              >
                {isMarkdown ? "MARKDOWN" : inferredLang.toUpperCase()}
              </span>
              {sizeBytes && (
                <span className="text-xs text-zinc-400 font-mono hidden sm:inline">
                  ({formatBytes(sizeBytes)})
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Markdown Preview / Source Toggle */}
            {isMarkdown && (
              <div className="flex items-center bg-zinc-200/70 p-0.5 rounded-lg text-xs font-medium mr-1">
                <button
                  type="button"
                  onClick={() => setViewMode("preview")}
                  className={`px-2.5 py-1 rounded-md transition-all flex items-center space-x-1.5 cursor-pointer ${
                    viewMode === "preview"
                      ? "bg-white text-zinc-950 shadow-2xs font-semibold"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("raw")}
                  className={`px-2.5 py-1 rounded-md transition-all flex items-center space-x-1.5 cursor-pointer ${
                    viewMode === "raw"
                      ? "bg-white text-zinc-950 shadow-2xs font-semibold"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>Source</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white border border-zinc-200/90 hover:bg-zinc-50 text-zinc-700 text-xs font-medium transition-colors shadow-2xs cursor-pointer"
              title="Copy file contents"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Copy</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white border border-zinc-200/90 hover:bg-zinc-50 text-zinc-700 text-xs font-medium transition-colors shadow-2xs cursor-pointer"
              title="Download file"
            >
              <Download className="w-3.5 h-3.5 text-zinc-500" />
              <span>Download</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer ml-1"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {viewMode === "preview" ? (
          <div className="flex-1 overflow-auto p-6 sm:p-10 bg-white select-text">
            <div className="max-w-4xl mx-auto">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex, rehypeHighlight]}
                components={{
                  h1({ children }) {
                    return (
                      <h1 className="text-2xl sm:text-3xl font-bold text-zinc-950 mt-6 mb-4 pb-2 border-b border-zinc-200/80 tracking-tight first:mt-0">
                        {children}
                      </h1>
                    );
                  },
                  h2({ children }) {
                    return (
                      <h2 className="text-xl sm:text-2xl font-semibold text-zinc-900 mt-6 mb-3 pb-1 border-b border-zinc-100 tracking-tight">
                        {children}
                      </h2>
                    );
                  },
                  h3({ children }) {
                    return (
                      <h3 className="text-lg font-semibold text-zinc-800 mt-5 mb-2">
                        {children}
                      </h3>
                    );
                  },
                  p({ children }) {
                    return (
                      <p className="mb-4 text-zinc-800 leading-[1.8] text-[15px]">
                        {children}
                      </p>
                    );
                  },
                  ul({ children }) {
                    return (
                      <ul className="list-disc list-inside space-y-1.5 mb-4 pl-1 text-zinc-800 text-[15px]">
                        {children}
                      </ul>
                    );
                  },
                  ol({ children }) {
                    return (
                      <ol className="list-decimal list-inside space-y-1.5 mb-4 pl-1 text-zinc-800 text-[15px]">
                        {children}
                      </ol>
                    );
                  },
                  li({ children }) {
                    return <li className="leading-relaxed">{children}</li>;
                  },
                  blockquote({ children }) {
                    return (
                      <blockquote className="border-l-4 border-indigo-500 pl-4 italic text-zinc-700 my-4 bg-indigo-50/40 py-2 rounded-r-lg">
                        {children}
                      </blockquote>
                    );
                  },
                  table({ children }) {
                    return (
                      <div className="my-5 overflow-x-auto rounded-xl border border-zinc-200 shadow-2xs">
                        <table className="w-full text-left text-xs border-collapse divide-y divide-zinc-200">
                          {children}
                        </table>
                      </div>
                    );
                  },
                  thead({ children }) {
                    return (
                      <thead className="bg-zinc-50 text-zinc-900 font-semibold">
                        {children}
                      </thead>
                    );
                  },
                  tbody({ children }) {
                    return (
                      <tbody className="divide-y divide-zinc-100 bg-white">
                        {children}
                      </tbody>
                    );
                  },
                  tr({ children }) {
                    return (
                      <tr className="hover:bg-zinc-50/50 transition-colors">
                        {children}
                      </tr>
                    );
                  },
                  th({ children }) {
                    return (
                      <th className="px-4 py-3 font-semibold text-zinc-900">
                        {children}
                      </th>
                    );
                  },
                  td({ children }) {
                    return (
                      <td className="px-4 py-2.5 text-zinc-700 whitespace-pre-wrap leading-relaxed">
                        {children}
                      </td>
                    );
                  },
                  hr() {
                    return <hr className="my-6 border-zinc-200" />;
                  },
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  code({ children, className, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || "");
                    const isInline = !match;
                    if (isInline) {
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
                      <div className="my-4 rounded-xl overflow-hidden border border-zinc-800 bg-[#1e2227] text-zinc-100 font-mono text-[13px] leading-relaxed shadow-xs">
                        <div className="px-4 py-2 bg-[#181b1f] border-b border-zinc-800/80 text-[11.5px] text-zinc-400 font-medium flex items-center justify-between select-none">
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
          <div className="flex-1 overflow-auto p-4 sm:p-6 bg-zinc-50/60 select-text">
            <div className="rounded-xl border border-zinc-200/80 bg-white p-5 font-mono text-[13px] leading-relaxed text-zinc-800 overflow-x-auto shadow-2xs">
              <pre className="!bg-transparent !p-0 !m-0 whitespace-pre font-mono">
                <code>{content}</code>
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
