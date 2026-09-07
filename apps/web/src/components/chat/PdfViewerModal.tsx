"use client";

import React from "react";
import { X, Download, FileText } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  filename: string;
  url?: string;
  data?: string;
  sizeBytes?: number;
  initialPage?: number;
}

export function PdfViewerModal({
  isOpen,
  onClose,
  filename,
  url,
  data,
  sizeBytes,
  initialPage,
}: PdfViewerModalProps) {
  if (!isOpen) return null;

  const baseSource = data || url;
  const pdfSource = baseSource && initialPage ? `${baseSource}#page=${initialPage}` : baseSource;

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
    <Modal isOpen={isOpen} onClose={onClose} size="full" className="max-w-5xl h-[90vh]">
      {/* Header */}
      <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between shrink-0 select-none bg-zinc-50/80">
        <div className="flex items-center gap-2.5 min-w-0 pr-4">
          <div className="p-1.5 rounded-lg bg-red-50 border border-red-200/80 text-red-600">
            <FileText className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-zinc-900 truncate">
              {filename}
            </span>
            <span className="px-1.5 py-0.5 rounded text-2xs font-bold bg-red-100 text-red-700">
              PDF
            </span>
            {initialPage && (
              <span className="px-1.5 py-0.5 rounded text-2xs font-semibold bg-zinc-200/70 text-zinc-800">
                Page {initialPage}
              </span>
            )}
            {sizeBytes && (
              <span className="text-xs text-zinc-400 font-mono hidden sm:inline">
                ({formatBytes(sizeBytes)})
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownload}
            title="Download PDF"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            <span>Download</span>
          </Button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer ml-1"
            title="Close (Esc)"
            aria-label="Close dialog"
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
    </Modal>
  );
}
