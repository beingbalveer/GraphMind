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
  ArrowLeft,
  X,
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
import { IconButton } from "@/components/ui/icon-button";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal, ModalHeader, ModalBody } from "@/components/ui/modal";
import { CodeViewerModal } from "../chat/CodeViewerModal";
import { PdfViewerModal } from "../chat/PdfViewerModal";
import { TableViewerModal } from "../chat/TableViewerModal";

export interface FileLibraryViewProps {
  workspaceId: string;
  onBack?: () => void;
  onSelectFile?: (file: FileAttachment) => void;
}

export function FileLibraryView({
  workspaceId,
  onBack,
  onSelectFile,
}: FileLibraryViewProps) {
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
  const [isDraggingOver, setIsDraggingOver] = useState(false);

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
    loadFiles();
  }, [loadFiles]);

  const handleUploadFiles = async (fileList: FileList | File[]) => {
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

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleUploadFiles(e.target.files);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
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

  return (
    <div
      data-testid="file-library-view"
      className="w-full h-full flex flex-col bg-background min-w-0 relative overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag & drop overlay indicator */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-xs flex flex-col items-center justify-center border-2 border-dashed border-primary animate-in fade-in-50 duration-150 motion-reduce:animate-none">
          <Upload className="size-10 text-primary mb-3 animate-bounce motion-reduce:animate-none" />
          <h3 className="text-base font-semibold text-foreground">Drop files to upload</h3>
          <p className="text-xs text-foreground-muted mt-1">Files will be saved to your workspace library</p>
        </div>
      )}

      {/* Streamlined Top Toolbar */}
      <div className="border-b border-border bg-surface px-4 sm:px-6 py-3 shrink-0">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {onBack && (
              <IconButton
                label="Back to chat"
                onClick={onBack}
                variant="ghost"
                className="shrink-0"
              >
                <ArrowLeft className="size-4" />
              </IconButton>
            )}

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

            <Badge variant="secondary" className="font-mono text-2xs shrink-0 hidden md:inline-flex">
              {files.length} {files.length === 1 ? "file" : "files"}
            </Badge>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-full sm:w-64 relative">
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by name..."
                startIcon={<Search className="size-3.5 text-foreground-muted" />}
                inputSize="sm"
              />
              {searchQuery && (
                <IconButton
                  label="Clear search"
                  variant="ghost"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-1 top-1/2 -translate-y-1/2 size-6"
                >
                  <X className="size-3" />
                </IconButton>
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/*,application/pdf,.pdf,.csv,.tsv,.xlsx,.jsonl,.ndjson,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values,.txt,.md,.markdown,.py,.js,.jsx,.ts,.tsx,.json,.yaml,.yml,.toml,.sql,.html,.css,.scss,.sh,.bash,.zsh,.rs,.go,.c,.cpp,.h,.hpp,.java,.kt,.rb,.php,.cs,.swift,.dockerfile,.graphql,.proto,.vue,.svelte,.xml,.env,.log"
              className="hidden"
              onChange={handleFileInputChange}
            />
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="cursor-pointer shrink-0"
            >
              {isUploading ? (
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
              ) : (
                <Upload className="size-3.5 mr-1.5" />
              )}
              <span>Upload</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content: File Grid */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0 bg-background">
        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center text-foreground-muted space-y-2">
            <Loader2 className="size-6 animate-spin text-foreground" />
            <p className="text-xs">Loading library assets...</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="h-96 flex items-center justify-center">
            <EmptyState
              icon={<FolderOpen className="size-8" />}
              title={searchQuery ? "No matching files" : "No files in this category"}
              description={
                searchQuery
                  ? `No assets matched "${searchQuery}". Try clearing the search or category filter.`
                  : "Upload code files, documents, images, or drag and drop attachments to populate this workspace."
              }
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (searchQuery) setSearchQuery("");
                    else fileInputRef.current?.click();
                  }}
                  className="cursor-pointer"
                >
                  {searchQuery ? "Clear search" : "Upload first file"}
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredFiles.map((file) => {
              const isImage = file.fileCategory === "image" || file.mimeType.startsWith("image/");
              const isPdf = file.mimeType === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
              const isTabular =
                file.fileCategory === "tabular" ||
                [".csv", ".tsv", ".jsonl", ".ndjson", ".xlsx"].some((ext) =>
                  file.name.toLowerCase().endsWith(ext)
                );
              const isCode = file.fileCategory === "code";
              const isMd =
                file.name.toLowerCase().endsWith(".md") ||
                file.name.toLowerCase().endsWith(".markdown");
              const downloadUrl = resolveFileUrl(
                file.url || `/api/v1/workspaces/${workspaceId}/files/${file.id}/download`
              );

              // Status mapping
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
                  return;
                }
                if (isPdf) {
                  setViewingPdfFile(file);
                } else if (isTabular) {
                  setViewingTabularFile(file);
                } else if (isCode || isMd) {
                  setViewingCodeFile(file);
                } else if (isImage) {
                  setPreviewFile(file);
                }
              };

              return (
                <div
                  key={file.id}
                  className={`group relative flex flex-col rounded-xl border border-border bg-surface shadow-2xs transition-all hover:border-border-strong hover:shadow-xs overflow-hidden ${
                    !isInteractive ? "opacity-75" : ""
                  }`}
                >
                  {/* Card Thumbnail / Preview Area */}
                  <div
                    onClick={isInteractive ? handleLaunchViewer : undefined}
                    className={`relative flex h-32 w-full items-center justify-center overflow-hidden border-b border-border bg-background-secondary ${
                      isInteractive ? "cursor-pointer" : "cursor-not-allowed"
                    }`}
                  >
                    {isImage ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={resolveFileUrl(file.data || file.url || "")}
                        alt={file.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:group-hover:scale-100"
                        loading="lazy"
                      />
                    ) : isPdf ? (
                      <div className="flex flex-col items-center justify-center text-foreground-muted group-hover:text-foreground transition-colors">
                        <FileText className="size-8 stroke-[1.5] text-destructive" />
                        <span className="text-2xs font-mono font-semibold uppercase mt-1 text-foreground-subtle">
                          PDF
                        </span>
                      </div>
                    ) : isTabular ? (
                      <div className="flex flex-col items-center justify-center text-foreground-muted group-hover:text-foreground transition-colors">
                        <FileSpreadsheet className="size-8 stroke-[1.5] text-success" />
                        <span className="text-2xs font-mono font-semibold uppercase mt-1 text-foreground-subtle">
                          DATA
                        </span>
                      </div>
                    ) : isCode ? (
                      <div className="flex flex-col items-center justify-center text-foreground-muted group-hover:text-foreground transition-colors">
                        <Code className="size-8 stroke-[1.5] text-foreground" />
                        <span className="text-2xs font-mono font-semibold uppercase mt-1 text-foreground-subtle">
                          CODE
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-foreground-muted group-hover:text-foreground transition-colors">
                        <FileText className="size-8 stroke-[1.5]" />
                        <span className="text-2xs font-mono font-semibold uppercase mt-1 text-foreground-subtle">
                          DOC
                        </span>
                      </div>
                    )}

                    {/* Status Badge */}
                    <div className="absolute top-2 left-2 z-10">
                      {status === "processing" ? (
                        <Badge variant="warning" className="gap-1 shadow-2xs font-normal">
                          <Loader2 className="size-2.5 animate-spin" />
                          <span>Processing</span>
                        </Badge>
                      ) : status === "failed" ? (
                        <Badge variant="destructive" className="gap-1 shadow-2xs font-normal">
                          <AlertCircle className="size-2.5" />
                          <span>Failed</span>
                        </Badge>
                      ) : status === "unavailable" ? (
                        <Badge variant="secondary" className="shadow-2xs font-normal">
                          Unavailable
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="shadow-2xs font-normal">
                          Ready
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Card Metadata & Actions */}
                  <div className="flex flex-col flex-1 p-3 min-w-0 justify-between">
                    <div className="min-w-0">
                      <p
                        className="truncate text-xs font-semibold text-foreground"
                        title={file.name}
                      >
                        {file.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 text-2xs text-foreground-muted font-mono">
                        <span>{formatBytes(file.sizeBytes || 0)}</span>
                        <span>•</span>
                        <span className="capitalize">{file.fileCategory}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-border-subtle">
                      <div className="flex items-center gap-1">
                        {isInteractive && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleLaunchViewer}
                            className="h-7 px-2 text-2xs font-medium cursor-pointer"
                            title="Preview / open asset"
                          >
                            <ExternalLink className="size-3 mr-1" />
                            <span>Preview</span>
                          </Button>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <a
                          href={downloadUrl}
                          download={file.name}
                          className="inline-flex items-center justify-center size-7 rounded-lg text-foreground-subtle hover:text-foreground hover:bg-surface-hover transition-colors"
                          title="Download file"
                        >
                          <Download className="size-3.5 stroke-[1.75]" />
                        </a>
                        <IconButton
                          label={`Delete ${file.name}`}
                          onClick={() => setFileToDelete(file)}
                          variant="destructive"
                          className="size-7"
                          title="Delete file"
                        >
                          <Trash2 className="size-3.5 stroke-[1.75]" />
                        </IconButton>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Dialog for File Deletion */}
      <ConfirmDialog
        isOpen={Boolean(fileToDelete)}
        title="Delete file permanently?"
        description={
          fileToDelete
            ? `Are you sure you want to delete "${fileToDelete.name}"? Any references or embeddings for this file in workspace knowledge will be permanently removed.`
            : "Are you sure you want to delete this file?"
        }
        confirmText="Delete File"
        variant="destructive"
        onConfirm={() => {
          if (fileToDelete) {
            executeDelete(fileToDelete.id);
            setFileToDelete(null);
          }
        }}
        onClose={() => setFileToDelete(null)}
      />

      {/* Embedded Viewers */}
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

      {viewingPdfFile && (
        <PdfViewerModal
          isOpen={Boolean(viewingPdfFile)}
          onClose={() => setViewingPdfFile(null)}
          filename={viewingPdfFile.name}
          url={resolveFileUrl(
            viewingPdfFile.url || `/api/v1/workspaces/${workspaceId}/files/${viewingPdfFile.id}/download`
          )}
        />
      )}

      {viewingTabularFile && (
        <TableViewerModal
          isOpen={Boolean(viewingTabularFile)}
          onClose={() => setViewingTabularFile(null)}
          filename={viewingTabularFile.name}
          url={resolveFileUrl(
            viewingTabularFile.url || `/api/v1/workspaces/${workspaceId}/files/${viewingTabularFile.id}/download`
          )}
        />
      )}

      {/* Image Preview Modal */}
      {previewFile && (
        <Modal
          isOpen={Boolean(previewFile)}
          onClose={() => setPreviewFile(null)}
          size="2xl"
        >
          <ModalHeader
            title={previewFile.name}
            description={`${formatBytes(previewFile.sizeBytes || 0)} • Image Preview`}
            onClose={() => setPreviewFile(null)}
          />
          <ModalBody className="p-4 flex items-center justify-center bg-background-secondary min-h-[300px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolveFileUrl(previewFile.data || previewFile.url || "")}
              alt={previewFile.name}
              className="max-h-[70vh] max-w-full rounded-lg object-contain shadow-md"
            />
          </ModalBody>
        </Modal>
      )}
    </div>
  );
}
