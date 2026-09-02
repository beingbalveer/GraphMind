"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
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
} from "lucide-react";
import { FileAttachment } from "@graphmind/shared";
import {
  fetchWorkspaceFiles,
  uploadWorkspaceFile,
  deleteWorkspaceFile,
} from "@/lib/workspaceApi";
import { CodeViewerModal } from "../chat/CodeViewerModal";
import { PdfViewerModal } from "../chat/PdfViewerModal";

interface FileLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  onSelectFile?: (file: FileAttachment) => void;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
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

  const handleDelete = async (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this file from the workspace library?")) {
      return;
    }

    try {
      const success = await deleteWorkspaceFile(workspaceId, fileId);
      if (success) {
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
        if (previewFile?.id === fileId) {
          setPreviewFile(null);
        }
        if (viewingCodeFile?.id === fileId) {
          setViewingCodeFile(null);
        }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in-50 duration-150">
      <div className="bg-white w-full max-w-4xl h-[640px] max-h-[90vh] rounded-2xl shadow-xl border border-zinc-200/90 flex flex-col overflow-hidden animate-in zoom-in-98 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-zinc-100 border border-zinc-200/80 text-zinc-700">
              <FolderOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-semibold text-zinc-950">Workspace File Library</h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 border border-zinc-200/80">
                  {files.length}
                </span>
              </div>
              <p className="text-xs text-zinc-500">
                Persistent assets, code files, and documents stored in this workspace.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/*,.txt,.md,.markdown,.py,.js,.jsx,.ts,.tsx,.json,.yaml,.yml,.toml,.sql,.html,.css,.scss,.sh,.bash,.zsh,.rs,.go,.c,.cpp,.h,.hpp,.java,.kt,.rb,.php,.cs,.swift,.dockerfile,.graphql,.proto,.vue,.svelte,.xml,.csv,.tsv,.env,.log"
              className="hidden"
              onChange={handleUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            >
              {isUploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>Upload Files</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Toolbar: Category Filters + Search */}
        <div className="px-6 py-3 border-b border-zinc-100 flex items-center justify-between gap-4 bg-zinc-50/50 shrink-0">
          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                selectedCategory === "all"
                  ? "bg-white text-zinc-950 shadow-2xs border border-zinc-200 font-semibold"
                  : "text-zinc-600 hover:text-zinc-950"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory("image")}
              className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                selectedCategory === "image"
                  ? "bg-white text-zinc-950 shadow-2xs border border-zinc-200 font-semibold"
                  : "text-zinc-600 hover:text-zinc-950"
              }`}
            >
              <ImageIcon className="w-3 h-3 text-zinc-500" />
              <span>Images</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory("code")}
              className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                selectedCategory === "code"
                  ? "bg-white text-zinc-950 shadow-2xs border border-zinc-200 font-semibold"
                  : "text-zinc-600 hover:text-zinc-950"
              }`}
            >
              <Code className="w-3 h-3 text-emerald-600" />
              <span>Code</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory("document")}
              className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                selectedCategory === "document"
                  ? "bg-white text-zinc-950 shadow-2xs border border-zinc-200 font-semibold"
                  : "text-zinc-600 hover:text-zinc-950"
              }`}
            >
              <FileText className="w-3 h-3 text-blue-600" />
              <span>Docs</span>
            </button>
          </div>

          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-zinc-200/90 bg-white text-xs text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400 shadow-2xs"
            />
          </div>
        </div>

        {/* File Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
              <p className="text-xs">Loading library assets...</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
              <div className="p-4 rounded-2xl bg-zinc-100 border border-zinc-200/80 text-zinc-400">
                <FolderOpen className="w-8 h-8" />
              </div>
              <div className="max-w-sm">
                <h3 className="text-sm font-semibold text-zinc-900">No files in this category</h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Upload code files, images, or drag and drop attachments into chat to save them here.
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 rounded-xl border border-zinc-200 hover:border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-800 shadow-2xs transition-colors cursor-pointer"
              >
                Upload files
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredFiles.map((file) => {
                const isImage = file.fileCategory === "image" || file.mimeType.startsWith("image/");
                const isPdf = file.mimeType === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
                const isCode = file.fileCategory === "code";
                const isDoc = file.fileCategory === "document" && !isPdf;
                const downloadUrl = file.url || `/api/v1/workspaces/${workspaceId}/files/${file.id}/download`;

                return (
                  <div
                    key={file.id}
                    onClick={() => {
                      if (onSelectFile) {
                        onSelectFile(file);
                        onClose();
                      } else if (isImage) {
                        setPreviewFile(file);
                      } else if (isPdf) {
                        setViewingPdfFile(file);
                      } else if (isCode || isDoc || file.extractedText) {
                        setViewingCodeFile(file);
                      }
                    }}
                    className="group relative flex flex-col rounded-xl border border-zinc-200/90 bg-white hover:border-zinc-300 hover:shadow-sm transition-all overflow-hidden cursor-pointer"
                  >
                    {/* Viewport: Image, PDF, or Code Preview */}
                    <div className="h-36 bg-zinc-100/70 relative flex items-center justify-center overflow-hidden border-b border-zinc-100">
                      {isImage ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={downloadUrl}
                          alt={file.name}
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-150"
                        />
                      ) : isPdf ? (
                        <div className="w-full h-full p-3 bg-red-50/60 text-zinc-700 flex flex-col justify-between select-none border-b border-red-100">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-red-600 bg-red-100/80 border border-red-200/60 px-1.5 py-0.5 rounded text-[10px]">
                              PDF
                            </span>
                            <FileText className="w-4 h-4 text-red-600" />
                          </div>
                          <div className="text-[11px] text-zinc-600 line-clamp-3 leading-snug font-sans">
                            {file.extractedText
                              ? file.extractedText.slice(0, 120)
                              : "PDF document stored in workspace library."}
                          </div>
                          <div className="text-[10px] text-red-600 font-medium">
                            Click to view PDF
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full p-3 bg-zinc-900 text-zinc-300 flex flex-col justify-between select-none">
                          <div className="flex items-center justify-between text-[11px] text-zinc-400">
                            <span className="font-mono uppercase font-semibold text-emerald-400">
                              {file.name.split(".").pop() || "txt"}
                            </span>
                            {isCode ? (
                              <Code className="w-3.5 h-3.5 text-zinc-500" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-zinc-500" />
                            )}
                          </div>
                          <div className="font-mono text-[10.5px] leading-tight text-zinc-400 overflow-hidden line-clamp-4 select-none opacity-80">
                            {file.extractedText
                              ? file.extractedText.slice(0, 150)
                              : "// File uploaded to library"}
                          </div>
                          <div className="text-[10px] text-zinc-500 font-mono">
                            Click to view code
                          </div>
                        </div>
                      )}

                      {/* Action Hover Strip */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isImage) {
                              setPreviewFile(file);
                            } else if (isPdf) {
                              setViewingPdfFile(file);
                            } else {
                              setViewingCodeFile(file);
                            }
                          }}
                          className="p-1.5 rounded-lg bg-white/90 text-zinc-800 hover:bg-white transition-colors cursor-pointer shadow-xs"
                          title="Open preview"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={downloadUrl}
                          download={file.name}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg bg-white/90 text-zinc-800 hover:bg-white transition-colors cursor-pointer shadow-xs"
                          title="Download asset"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(file.id, e)}
                          className="p-1.5 rounded-lg bg-red-600/90 text-white hover:bg-red-600 transition-colors cursor-pointer shadow-xs"
                          title="Delete file"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Metadata Footer */}
                    <div className="p-3">
                      <p className="text-xs font-medium text-zinc-900 truncate" title={file.name}>
                        {file.name}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-1">
                        <span>{formatBytes(file.sizeBytes)}</span>
                        <span className="uppercase text-[10px] font-mono tracking-wider text-zinc-500">
                          {file.fileCategory || "file"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Full Resolution Image Lightbox */}
      {previewFile && (
        <div
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-transparent flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewFile.url || `/api/v1/workspaces/${workspaceId}/files/${previewFile.id}/download`}
              alt={previewFile.name}
              className="max-h-[82vh] rounded-xl object-contain shadow-2xl border border-white/20"
            />
            <div className="mt-3 flex items-center justify-between w-full px-2 text-white/90 text-xs">
              <span className="font-medium truncate max-w-md">{previewFile.name}</span>
              <div className="flex items-center space-x-3">
                <a
                  href={previewFile.url || `/api/v1/workspaces/${workspaceId}/files/${previewFile.id}/download`}
                  download={previewFile.name}
                  className="hover:text-white flex items-center space-x-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="hover:text-white cursor-pointer"
                >
                  Close (Esc)
                </button>
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
          downloadUrl={viewingCodeFile.url}
        />
      )}

      {/* In-Page PDF Viewer Modal */}
      {viewingPdfFile && (
        <PdfViewerModal
          isOpen={Boolean(viewingPdfFile)}
          onClose={() => setViewingPdfFile(null)}
          filename={viewingPdfFile.name}
          url={viewingPdfFile.url || `/api/v1/workspaces/${workspaceId}/files/${viewingPdfFile.id}/download`}
          data={viewingPdfFile.data}
          sizeBytes={viewingPdfFile.sizeBytes}
        />
      )}
    </div>
  );
}
