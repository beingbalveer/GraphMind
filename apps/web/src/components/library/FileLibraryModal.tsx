"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Upload,
  Image as ImageIcon,
  Download,
  Trash2,
  Search,
  ExternalLink,
  Loader2,
  FolderOpen,
  Code,
  FileText,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react";
import { FileAttachment } from "@graphmind/shared";
import {
  fetchWorkspaceFiles,
  uploadWorkspaceFile,
  deleteWorkspaceFile,
  resolveFileUrl,
} from "@/lib/workspaceApi";
import { formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal, ModalHeader, ModalBody } from "@/components/ui/modal";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CodeViewerModal } from "../chat/CodeViewerModal";
import { PdfViewerModal } from "../chat/PdfViewerModal";
import { TableViewerModal } from "../chat/TableViewerModal";

interface FileLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  onSelectFile?: (file: FileAttachment) => void;
}

export function FileLibraryModal({
  isOpen,
  onClose,
  workspaceId,
  onSelectFile,
}: FileLibraryModalProps) {
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [previewFile, setPreviewFile] = useState<FileAttachment | null>(null);
  const [viewingCodeFile, setViewingCodeFile] = useState<FileAttachment | null>(null);
  const [viewingPdfFile, setViewingPdfFile] = useState<FileAttachment | null>(null);
  const [viewingTabularFile, setViewingTabularFile] = useState<FileAttachment | null>(null);
  const [fileToDelete, setFileToDelete] = useState<FileAttachment | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    if (!workspaceId) return;
    setIsLoading(true);
    try {
      const categoryParam = selectedCategory === "all" ? undefined : selectedCategory;
      const data = await fetchWorkspaceFiles(workspaceId, categoryParam);
      setFiles(data);
    } catch (err) {
      console.warn("Failed to load workspace files:", err);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, selectedCategory]);

  useEffect(() => {
    if (isOpen) {
      loadFiles();
    }
  }, [isOpen, loadFiles]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < fileList.length; i++) {
        await uploadWorkspaceFile(workspaceId, fileList[i]);
      }
      await loadFiles();
    } catch (err) {
      console.warn("Upload failed:", err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const executeDelete = async (fileId: string) => {
    try {
      const success = await deleteWorkspaceFile(workspaceId, fileId);
      if (success) {
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
        if (previewFile?.id === fileId) setPreviewFile(null);
        if (viewingCodeFile?.id === fileId) setViewingCodeFile(null);
        if (viewingPdfFile?.id === fileId) setViewingPdfFile(null);
        if (viewingTabularFile?.id === fileId) setViewingTabularFile(null);
      }
    } catch (err) {
      console.warn("Delete failed:", err);
    }
  };

  const filteredFiles = files.filter((f) => {
    if (!searchQuery.trim()) return true;
    return f.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (!isOpen) return null;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="4xl" className="h-[640px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Shared Standard Header */}
        <ModalHeader
          title={
            <div className="flex items-center gap-2">
              <span>Workspace File Library</span>
              <Badge variant="secondary" className="font-mono text-2xs">
                {files.length}
              </Badge>
            </div>
          }
          description="Persistent assets, code files, and documents stored in this workspace."
          icon={<FolderOpen className="size-4 text-foreground" />}
          onClose={onClose}
        >
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept="image/*,application/pdf,.pdf,.csv,.tsv,.xlsx,.jsonl,.ndjson,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values,.txt,.md,.markdown,.py,.js,.jsx,.ts,.tsx,.json,.yaml,.yml,.toml,.sql,.html,.css,.scss,.sh,.bash,.zsh,.rs,.go,.c,.cpp,.h,.hpp,.java,.kt,.rb,.php,.cs,.swift,.dockerfile,.graphql,.proto,.vue,.svelte,.xml,.env,.log"
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="size-3.5 animate-spin mr-1.5" />
            ) : (
              <Upload className="size-3.5 mr-1.5" />
            )}
            <span>Upload Files</span>
          </Button>
        </ModalHeader>

        {/* Toolbar: Category Filters + Search */}
        <div className="px-5 py-3 border-b border-border flex flex-col sm:flex-row items-center justify-between gap-3 bg-background-secondary/50 shrink-0">
          <SegmentedTabs
            value={selectedCategory}
            onChange={(val) => setSelectedCategory(val)}
            size="sm"
            items={[
              { id: "all", label: "All" },
              { id: "image", label: "Images", icon: ImageIcon },
              { id: "tabular", label: "Tabular", icon: FileSpreadsheet },
              { id: "code", label: "Code", icon: Code },
              { id: "document", label: "Docs", icon: FileText },
            ]}
          />

          <div className="w-full sm:w-64">
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              startIcon={<Search className="size-3.5 text-foreground-muted" />}
              inputSize="sm"
            />
          </div>
        </div>

        {/* File Grid Body */}
        <ModalBody className="p-5 flex-1 overflow-y-auto min-h-0 bg-surface">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-foreground-muted space-y-2 py-16">
              <Loader2 className="size-6 animate-spin text-foreground" />
              <p className="text-xs">Loading library assets...</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="h-full flex items-center justify-center py-12">
              <EmptyState
                icon={<FolderOpen className="size-8" />}
                title="No files in this category"
                description="Upload code files, images, or drag and drop attachments into chat to save them here."
                action={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="size-3.5 mr-1.5" />
                    <span>Upload files</span>
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredFiles.map((file) => {
                const isImage = file.fileCategory === "image" || file.mimeType.startsWith("image/");
                const isPdf = file.mimeType === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
                const isTabular =
                  file.fileCategory === "tabular" ||
                  [".csv", ".tsv", ".jsonl", ".ndjson", ".xlsx"].some((ext) =>
                    file.name.toLowerCase().endsWith(ext)
                  );
                const isCode = file.fileCategory === "code";
                const isDoc = file.fileCategory === "document" && !isPdf && !isTabular;
                const isMd =
                  file.name.toLowerCase().endsWith(".md") ||
                  file.name.toLowerCase().endsWith(".markdown");
                const downloadUrl = resolveFileUrl(
                  file.url || `/api/v1/workspaces/${workspaceId}/files/${file.id}/download`
                );

                // Distinguish file processing state
                const rawStatus = (file.metadata?.status as string) || "ready";
                const status: "processing" | "ready" | "failed" | "unavailable" =
                  rawStatus === "processing" || rawStatus === "failed" || rawStatus === "unavailable"
                    ? rawStatus
                    : "ready";

                const isInteractive = status === "ready";

                const handleLaunchViewer = () => {
                  if (!isInteractive) return;
                  if (onSelectFile) {
                    onSelectFile(file);
                    onClose();
                  } else if (isImage) {
                    setPreviewFile(file);
                  } else if (isPdf) {
                    setViewingPdfFile(file);
                  } else if (isTabular) {
                    setViewingTabularFile(file);
                  } else if (isCode || isDoc || isMd || file.extractedText) {
                    setViewingCodeFile(file);
                  }
                };

                return (
                  <div
                    key={file.id}
                    onClick={handleLaunchViewer}
                    className={`group relative flex flex-col rounded-2xl border border-border bg-surface hover:border-border-strong hover:shadow-xs transition-all overflow-hidden ${
                      isInteractive ? "cursor-pointer" : "opacity-80"
                    }`}
                  >
                    {/* Viewport: Image, PDF, Tabular, Markdown, or Code Preview */}
                    <div className="h-36 bg-background-secondary/70 relative flex items-center justify-center overflow-hidden border-b border-border">
                      {status === "processing" ? (
                        <div className="flex flex-col items-center justify-center gap-1.5 text-foreground-muted p-3 text-center">
                          <Loader2 className="size-5 animate-spin text-foreground" />
                          <span className="text-2xs font-medium">Processing file...</span>
                        </div>
                      ) : status === "failed" ? (
                        <div className="flex flex-col items-center justify-center gap-1.5 text-destructive p-3 text-center">
                          <AlertCircle className="size-5" />
                          <span className="text-2xs font-medium">Processing failed</span>
                        </div>
                      ) : status === "unavailable" ? (
                        <div className="flex flex-col items-center justify-center gap-1.5 text-foreground-muted p-3 text-center">
                          <FolderOpen className="size-5 text-foreground-subtle" />
                          <span className="text-2xs font-medium">Unavailable</span>
                        </div>
                      ) : isImage ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={downloadUrl}
                          alt={file.name}
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-150"
                        />
                      ) : isPdf ? (
                        <div className="w-full h-full p-3 bg-muted/40 text-foreground flex flex-col justify-between select-none">
                          <div className="flex items-center justify-between text-xs">
                            <Badge variant="destructive" className="text-2xs px-1.5 py-0">
                              PDF
                            </Badge>
                            <FileText className="size-4 text-foreground-muted" />
                          </div>
                          <div className="text-xs text-foreground-muted line-clamp-3 leading-snug font-sans">
                            {file.extractedText
                              ? file.extractedText.slice(0, 120)
                              : "PDF document stored in workspace library."}
                          </div>
                          <div className="text-2xs text-foreground-muted font-medium">
                            Click to view PDF
                          </div>
                        </div>
                      ) : isTabular ? (
                        <div className="w-full h-full p-3 bg-muted/40 text-foreground flex flex-col justify-between select-none">
                          <div className="flex items-center justify-between text-xs">
                            <Badge variant="secondary" className="text-2xs px-1.5 py-0 uppercase">
                              {(file.metadata?.format as string) || file.name.split(".").pop() || "TABLE"}
                            </Badge>
                            <FileSpreadsheet className="size-4 text-foreground-muted" />
                          </div>
                          <div className="text-xs text-foreground-muted font-mono line-clamp-3 leading-snug">
                            {file.extractedText
                              ? file.extractedText.slice(0, 120)
                              : "Tabular spreadsheet dataset stored in workspace library."}
                          </div>
                          <div className="text-2xs text-foreground-muted font-medium">
                            {file.metadata?.row_count !== undefined
                              ? `${(file.metadata.row_count as number).toLocaleString()} rows · Explore`
                              : "Click to explore table"}
                          </div>
                        </div>
                      ) : isMd ? (
                        <div className="w-full h-full p-3 bg-muted/40 text-foreground flex flex-col justify-between select-none">
                          <div className="flex items-center justify-between text-xs">
                            <Badge variant="secondary" className="text-2xs px-1.5 py-0 uppercase">
                              MD
                            </Badge>
                            <FileText className="size-4 text-foreground-muted" />
                          </div>
                          <div className="text-xs text-foreground-muted line-clamp-3 leading-snug font-sans">
                            {file.extractedText
                              ? file.extractedText.slice(0, 120)
                              : "Markdown document stored in workspace library."}
                          </div>
                          <div className="text-2xs text-foreground-muted font-medium">
                            Click to preview markdown
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full p-3 bg-background-secondary text-foreground flex flex-col justify-between select-none">
                          <div className="flex items-center justify-between text-xs text-foreground-muted">
                            <span className="font-mono uppercase font-semibold text-foreground text-2xs">
                              {file.name.split(".").pop() || "txt"}
                            </span>
                            {isCode ? (
                              <Code className="size-3.5 text-foreground-muted" />
                            ) : (
                              <FileText className="size-3.5 text-foreground-muted" />
                            )}
                          </div>
                          <div className="font-mono text-2xs leading-tight text-foreground-muted overflow-hidden line-clamp-4 select-none opacity-80">
                            {file.extractedText
                              ? file.extractedText.slice(0, 150)
                              : "// File uploaded to library"}
                          </div>
                          <div className="text-2xs text-foreground-muted font-mono">
                            Click to view code
                          </div>
                        </div>
                      )}

                      {/* Top-Right Floating Action Cluster */}
                      <div className="absolute top-2 right-2 z-10 flex items-center space-x-1 p-0.5 rounded-xl bg-surface/95 backdrop-blur-md border border-border shadow-xs opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        {isInteractive && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLaunchViewer();
                            }}
                            title="Open preview"
                            aria-label="Open preview"
                          >
                            <ExternalLink className="size-3.5" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(downloadUrl, "_blank");
                          }}
                          title="Download asset"
                          aria-label="Download asset"
                        >
                          <Download className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFileToDelete(file);
                          }}
                          className="text-destructive hover:text-destructive hover:bg-destructive-bg"
                          title="Delete file"
                          aria-label="Delete file"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Metadata Footer */}
                    <div className="p-3">
                      <p className="text-xs font-medium text-foreground truncate" title={file.name}>
                        {file.name}
                      </p>
                      <div className="flex items-center justify-between text-xs text-foreground-muted mt-1">
                        <span>{formatBytes(file.sizeBytes)}</span>
                        {status !== "ready" ? (
                          <Badge
                            variant={
                              status === "processing"
                                ? "warning"
                                : status === "failed"
                                ? "destructive"
                                : "outline"
                            }
                            className="text-2xs font-mono uppercase"
                          >
                            {status}
                          </Badge>
                        ) : (
                          <span className="uppercase text-2xs font-mono tracking-wider text-foreground-muted">
                            {file.fileCategory || "file"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ModalBody>
      </Modal>

      {/* Shared Confirmation Dialog for Destructive Deletion */}
      <ConfirmDialog
        isOpen={Boolean(fileToDelete)}
        onClose={() => setFileToDelete(null)}
        onConfirm={() => {
          if (fileToDelete) {
            executeDelete(fileToDelete.id);
            setFileToDelete(null);
          }
        }}
        title="Delete file from library"
        description={`Are you sure you want to delete "${fileToDelete?.name}" from this workspace library? This action cannot be undone.`}
        confirmText="Delete File"
        variant="destructive"
      />

      {/* Full Resolution Image Lightbox */}
      {previewFile && (
        <div
          className="fixed inset-0 z-60 bg-overlay backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-surface rounded-2xl border border-border p-4 flex flex-col items-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolveFileUrl(previewFile.url || `/api/v1/workspaces/${workspaceId}/files/${previewFile.id}/download`)}
              alt={previewFile.name}
              className="max-h-[75vh] rounded-xl object-contain"
            />
            <div className="mt-4 flex items-center justify-between w-full px-2 text-foreground text-xs">
              <span className="font-medium truncate max-w-md">{previewFile.name}</span>
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.open(
                      resolveFileUrl(previewFile.url || `/api/v1/workspaces/${workspaceId}/files/${previewFile.id}/download`),
                      "_blank"
                    );
                  }}
                >
                  <Download className="size-3.5 mr-1.5" />
                  <span>Download</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewFile(null)}
                >
                  Close (Esc)
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* In-Page Code Viewer Modal */}
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

      {/* In-Page PDF Viewer Modal */}
      {viewingPdfFile && (
        <PdfViewerModal
          isOpen={Boolean(viewingPdfFile)}
          onClose={() => setViewingPdfFile(null)}
          filename={viewingPdfFile.name}
          url={resolveFileUrl(viewingPdfFile.url || `/api/v1/workspaces/${workspaceId}/files/${viewingPdfFile.id}/download`)}
          data={viewingPdfFile.data}
          sizeBytes={viewingPdfFile.sizeBytes}
        />
      )}

      {/* In-Page Table Viewer Modal */}
      {viewingTabularFile && (
        <TableViewerModal
          isOpen={Boolean(viewingTabularFile)}
          onClose={() => setViewingTabularFile(null)}
          filename={viewingTabularFile.name}
          url={resolveFileUrl(viewingTabularFile.url || `/api/v1/workspaces/${workspaceId}/files/${viewingTabularFile.id}/download`)}
          data={viewingTabularFile.data}
          extractedText={viewingTabularFile.extractedText}
          metadata={viewingTabularFile.metadata as Record<string, unknown>}
          sizeBytes={viewingTabularFile.sizeBytes}
        />
      )}
    </>
  );
}
