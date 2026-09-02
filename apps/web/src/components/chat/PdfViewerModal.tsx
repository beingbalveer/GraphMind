"use client";

import React, { useEffect } from "react";
import { X, Download, FileText } from "lucide-react";

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  filename: string;
  url?: string;
  data?: string;
  sizeBytes?: number;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return "";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function PdfViewerModal({
  isOpen,
  onClose,
  filename,
  url,
  data,
  sizeBytes,
}: PdfViewerModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const pdfSource = data || url;

  const handleDownload = () => {
    if (url) {
      const downloadUrl = url.includes("?") ? `${url}&download=true` : `${url}?download=true`;
      window.open(downloadUrl, "_blank");
      return;
    }
    if (data) {
      const a = document.createElement("a");
      a.href = data;
      a.download = filename;
      a.click();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in-50 duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl border border-zinc-200/90 flex flex-col overflow-hidden animate-in zoom-in-98 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between shrink-0 select-none bg-zinc-50/80">
          <div className="flex items-center space-x-2.5 min-w-0 pr-4">
            <div className="p-1.5 rounded-lg bg-red-50 border border-red-200/80 text-red-600">
              <FileText className="w-4 h-4" />
            </div>
            <div className="flex items-center space-x-2 min-w-0">
              <span className="text-sm font-semibold text-zinc-900 truncate">
                {filename}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                PDF
              </span>
              {sizeBytes && (
                <span className="text-xs text-zinc-400 font-mono hidden sm:inline">
                  ({formatBytes(sizeBytes)})
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-white border border-zinc-200/90 hover:bg-zinc-50 text-zinc-700 text-xs font-medium transition-colors shadow-2xs cursor-pointer"
              title="Download PDF"
            >
              <Download className="w-3.5 h-3.5 text-zinc-500" />
              <span>Download</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer ml-1"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* PDF Viewer Body */}
        <div className="flex-1 bg-zinc-100 relative overflow-hidden flex items-center justify-center">
          {pdfSource ? (
            <iframe
              src={pdfSource}
              className="w-full h-full border-none"
              title={filename}
            />
          ) : (
            <div className="p-8 text-center text-zinc-500 space-y-2">
              <FileText className="w-12 h-12 mx-auto text-zinc-400" />
              <p className="text-sm font-medium">Unable to load PDF preview.</p>
              <p className="text-xs text-zinc-400">
                The file content is not available for inline viewing.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
