"use client";

import React from "react";
import { X, Download, FileText } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";

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
      <div className="h-13 px-5 border-b border-border flex items-center justify-between shrink-0 select-none bg-surface">
        <div className="flex items-center gap-2.5 min-w-0 pr-4">
          <div className="p-1.5 rounded-lg bg-muted border border-border text-foreground">
            <FileText className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-foreground truncate">
              {filename}
            </span>
            <Badge variant="destructive">PDF</Badge>
            {initialPage && (
              <Badge variant="secondary">Page {initialPage}</Badge>
            )}
            {sizeBytes && (
              <span className="text-xs text-foreground-muted font-mono hidden sm:inline">
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

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* PDF Viewer Body */}
      <div className="flex-1 bg-background-secondary relative overflow-hidden flex items-center justify-center">
        {pdfSource ? (
          <iframe
            src={pdfSource}
            className="w-full h-full border-none"
            title={filename}
          />
        ) : (
          <div className="p-8 text-center text-foreground-muted space-y-2">
            <FileText className="w-12 h-12 mx-auto text-foreground-subtle" />
            <p className="text-sm font-medium">Unable to load PDF preview.</p>
            <p className="text-xs text-foreground-subtle">
              The file content is not available for inline viewing.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
