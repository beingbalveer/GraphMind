"use client";

import React, { useEffect, useState } from "react";
import { X, Download, Copy, Check, FileCode } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

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

  const inferredLang = language || filename.split(".").pop()?.toLowerCase() || "text";
  const markdownCode = "```" + inferredLang + "\n" + content + "\n```";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-50 duration-150"
      onClick={onClose}
    >
      <div
        className="bg-[#181b1f] w-full max-w-4xl max-h-[88vh] rounded-2xl shadow-2xl border border-zinc-800 flex flex-col overflow-hidden animate-in zoom-in-98 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#141619] border-b border-zinc-800 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center space-x-2.5 min-w-0 pr-4">
            <div className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300">
              <FileCode className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-center space-x-2 min-w-0">
              <span className="text-sm font-medium text-zinc-100 truncate font-mono">
                {filename}
              </span>
              {sizeBytes && (
                <span className="text-[11px] text-zinc-500 font-mono">
                  ({formatBytes(sizeBytes)})
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
              title="Copy file contents"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
              title="Download file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer ml-1"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="flex-1 overflow-auto p-4 font-mono text-[13px] leading-relaxed text-zinc-200 select-text">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={{
              pre({ children }) {
                return <pre className="bg-transparent m-0 p-0">{children}</pre>;
              },
              code({ children, className }) {
                return <code className={className}>{children}</code>;
              },
            }}
          >
            {markdownCode}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
