"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowUp,
  Square,
  GitBranch,
  X,
  Plus,
  Upload,
  FolderOpen,
  Loader2,
  FileText,
  Code,
  Sparkles,
  MessageSquare,
  Compass,
  Layers,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MenuCard, MenuItem } from "@/components/ui/menu";
import { BranchContext } from "@/hooks/useChatStream";
import { FileAttachment } from "@graphmind/shared";
import { uploadWorkspaceFile } from "@/lib/workspaceApi";
import { FileLibraryModal } from "../library/FileLibraryModal";

interface ChatInputProps {
  onSendMessage: (
    prompt: string,
    attachments?: FileAttachment[],
    activeSkill?: string | null
  ) => void;
  onStopStreaming: () => void;
  isStreaming: boolean;
  workspaceId?: string;
  activeBranch?: BranchContext | null;
  onClearBranch?: () => void;
}

const CODE_EXTENSIONS = new Set([
  "py", "js", "ts", "tsx", "jsx", "json", "yaml", "yml", "toml", "sql",
  "html", "css", "scss", "sass", "sh", "bash", "zsh", "rs", "go", "c",
  "cpp", "h", "hpp", "java", "kt", "rb", "php", "cs", "swift", "dockerfile",
  "graphql", "proto", "vue", "svelte",
]);

const DOC_EXTENSIONS = new Set([
  "pdf", "txt", "md", "markdown", "csv", "tsv", "log", "env", "ini", "cfg", "conf", "xml",
]);

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function ChatInput({
  onSendMessage,
  onStopStreaming,
  isStreaming,
  workspaceId,
  activeBranch,
  onClearBranch,
}: ChatInputProps) {
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [isLibraryPickerOpen, setIsLibraryPickerOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [isSkillMenuOpen, setIsSkillMenuOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const skillMenuRef = useRef<HTMLDivElement>(null);

  // Close attach menu on click outside or Escape
  useEffect(() => {
    if (!isAttachMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setIsAttachMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsAttachMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAttachMenuOpen]);

  // Close skill menu on click outside or Escape
  useEffect(() => {
    if (!isSkillMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (skillMenuRef.current && !skillMenuRef.current.contains(e.target as Node)) {
        setIsSkillMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSkillMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSkillMenuOpen]);

  // Auto-focus and scroll to bottom when branching is triggered
  useEffect(() => {
    if (activeBranch && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [activeBranch]);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  }, [prompt]);

  // Process incoming files from file picker, drag & drop, or paste
  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileList = Array.from(files);
      if (fileList.length === 0) return;

      setIsUploading(true);
      try {
        for (const file of fileList) {
          const ext = file.name.split(".").pop()?.toLowerCase() || "";
          const isImage = file.type.startsWith("image/");
          const isPdf = ext === "pdf" || file.type === "application/pdf";
          const isCode = CODE_EXTENSIONS.has(ext);
          const isDoc = DOC_EXTENSIONS.has(ext) || file.type.startsWith("text/");

          let category = "other";
          if (isImage) {
            category = "image";
          } else if (isPdf) {
            category = "document";
          } else if (isCode) {
            category = "code";
          } else if (isDoc) {
            category = "document";
          }

          let dataUrl: string | undefined = undefined;
          let textContent: string | undefined = undefined;

          if (isImage || isPdf) {
            dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
          } else {
            // Read code / text file content
            textContent = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsText(file);
            });
          }

          let uploadedId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          let uploadedUrl: string | undefined = undefined;

          // If workspace is active, persist file to Workspace File Library
          if (workspaceId) {
            const res = await uploadWorkspaceFile(workspaceId, file);
            if (res) {
              uploadedId = res.id;
              uploadedUrl = res.url;
              if (res.extractedText) {
                textContent = res.extractedText;
              }
            }
          }

          const newAttachment: FileAttachment = {
            id: uploadedId,
            name: file.name,
            sizeBytes: file.size,
            mimeType: file.type || (isPdf ? "application/pdf" : isCode ? "text/plain" : "application/octet-stream"),
            fileCategory: category,
            url: uploadedUrl,
            data: dataUrl,
            extractedText: textContent,
          };

          setAttachments((prev) => [...prev, newAttachment]);
        }
      } catch (err) {
        console.warn("Failed to process attachment file:", err);
      } finally {
        setIsUploading(false);
      }
    },
    [workspaceId]
  );

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      e.preventDefault();
      processFiles(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPrompt = prompt.trim();
    if ((!cleanPrompt && attachments.length === 0) || isStreaming || isUploading) {
      return;
    }

    onSendMessage(
      cleanPrompt,
      attachments.length > 0 ? attachments : undefined,
      selectedSkill
    );
    setPrompt("");
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const canSubmit = (prompt.trim().length > 0 || attachments.length > 0) && !isStreaming && !isUploading;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4 sm:pb-6">
      <form
        onSubmit={handleSubmit}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`bg-white rounded-2xl border transition-all p-2.5 flex flex-col space-y-2 shadow-sm ${
          isDragOver
            ? "border-blue-400 bg-blue-50/20 shadow-md ring-2 ring-blue-100"
            : "border-zinc-200/90 hover:border-zinc-300 focus-within:border-zinc-400 focus-within:shadow-md"
        }`}
      >
        {/* Active Branch Context Pill */}
        {activeBranch && (
          <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-zinc-100/90 border border-zinc-200/90 text-xs text-zinc-700 animate-in fade-in-50 slide-in-from-bottom-1 duration-150">
            <div className="flex items-center space-x-1.5 min-w-0 pr-2">
              <GitBranch className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span className="font-semibold text-zinc-900 shrink-0">Sub-topic:</span>
              <span className="italic text-zinc-600 truncate">
                &ldquo;{activeBranch.highlightedText}&rdquo;
              </span>
            </div>
            {onClearBranch && (
              <button
                type="button"
                onClick={onClearBranch}
                className="text-zinc-400 hover:text-zinc-700 p-0.5 rounded transition-colors shrink-0 cursor-pointer"
                title="Cancel branch context"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Active Skill Context Pill */}
        {selectedSkill && (
          <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-indigo-50/90 border border-indigo-200/90 text-xs text-indigo-900 animate-in fade-in-50 slide-in-from-bottom-1 duration-150">
            <div className="flex items-center space-x-1.5 min-w-0 pr-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-pulse shrink-0" />
              <span className="font-semibold text-indigo-950 shrink-0">Skill:</span>
              <span className="truncate">
                {selectedSkill === "deep_research" && "⚡ Deep Research (Web & Graph Search)"}
                {selectedSkill === "code_architect" && "🏛️ Code Architect (Modularity & Design)"}
                {selectedSkill === "quiz_master" && "🎓 Quiz Master (Socratic Learning Checks)"}
                {!["deep_research", "code_architect", "quiz_master"].includes(selectedSkill) && selectedSkill}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedSkill(null)}
              className="text-indigo-400 hover:text-indigo-800 p-0.5 rounded transition-colors shrink-0 cursor-pointer"
              title="Deactivate skill"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Attachment Previews Tray */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-1 pt-1 pb-1 animate-in fade-in-50 duration-150">
            {attachments.map((att) => {
              const isImg = att.fileCategory === "image" || att.data?.startsWith("data:image/");
              const isCode = att.fileCategory === "code";

              if (isImg) {
                return (
                  <div
                    key={att.id}
                    className="relative group rounded-xl border border-zinc-200/90 bg-zinc-50 overflow-hidden shadow-2xs transition-all hover:border-zinc-300"
                  >
                    <div className="relative w-16 h-16 bg-zinc-100 flex items-center justify-center overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={att.data || att.url}
                        alt={att.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.id)}
                      className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white hover:bg-black transition-colors cursor-pointer"
                      title="Remove attachment"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              }

              const isPdf = att.mimeType === "application/pdf" || att.name.toLowerCase().endsWith(".pdf");

              return (
                <div
                  key={att.id}
                  className="relative group flex items-center space-x-2.5 px-3 py-2 rounded-xl border border-zinc-200/90 bg-zinc-50 hover:bg-zinc-100/80 shadow-2xs transition-all max-w-[240px]"
                >
                  <div
                    className={`p-1.5 rounded-lg bg-white border border-zinc-200/80 shrink-0 ${
                      isPdf ? "text-red-600 bg-red-50/50" : isCode ? "text-emerald-600" : "text-blue-600"
                    }`}
                  >
                    {isPdf ? (
                      <FileText className="w-4 h-4 text-red-600" />
                    ) : isCode ? (
                      <Code className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <FileText className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0 pr-4">
                    <span className="text-xs font-medium text-zinc-900 truncate" title={att.name}>
                      {att.name}
                    </span>
                    <div className="flex items-center space-x-1.5 text-[10px] text-zinc-500 font-mono">
                      {isPdf && (
                        <span className="font-bold text-red-600 bg-red-50 px-1 rounded text-[9px]">
                          PDF
                        </span>
                      )}
                      <span>{formatBytes(att.sizeBytes)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(att.id)}
                    className="absolute top-1.5 right-1.5 p-0.5 rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 transition-colors cursor-pointer"
                    title="Remove attachment"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}

            {isUploading && (
              <div className="h-14 px-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 flex items-center justify-center space-x-2 text-xs text-zinc-500">
                <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
                <span>Reading file...</span>
              </div>
            )}
          </div>
        )}

        {/* Textarea Input */}
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={
            activeBranch
              ? `Ask a follow-up about "${activeBranch.highlightedText.slice(0, 30)}..."`
              : "Message GraphMind, attach code or paste images..."
          }
          rows={1}
          disabled={isStreaming}
          className="w-full px-2 py-1.5 text-[15.5px] text-zinc-900 placeholder-zinc-400 bg-transparent resize-none outline-none font-normal max-h-48 leading-relaxed"
        />

        {/* Action Bar */}
        <div className="flex items-center justify-between pt-1 px-1">
          {/* Left tools: Plus (+) attachment button and popup menu */}
          <div className="relative flex items-center space-x-1.5" ref={attachMenuRef}>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,application/pdf,.pdf,.csv,.tsv,.xlsx,.jsonl,.ndjson,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values,.txt,.md,.markdown,.py,.js,.jsx,.ts,.tsx,.json,.yaml,.yml,.toml,.sql,.html,.css,.scss,.sh,.bash,.zsh,.rs,.go,.c,.cpp,.h,.hpp,.java,.kt,.rb,.php,.cs,.swift,.dockerfile,.graphql,.proto,.vue,.svelte,.xml,.env,.log"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  processFiles(e.target.files);
                  e.target.value = "";
                }
              }}
            />

            <button
              type="button"
              onClick={() => setIsAttachMenuOpen((prev) => !prev)}
              disabled={isStreaming || isUploading}
              className={`p-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isAttachMenuOpen
                  ? "bg-zinc-200 text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
              }`}
              title="Add attachment (image, PDF, spreadsheet, code, doc)"
            >
              <Plus className={`w-4 h-4 transition-transform duration-200 ${isAttachMenuOpen ? "rotate-45 text-zinc-950" : ""}`} />
            </button>

            {/* Attachment Dropdown Menu */}
            {isAttachMenuOpen && (
              <div className="absolute bottom-full left-0 mb-2 z-50 animate-in fade-in-50 zoom-in-95 duration-150">
                <MenuCard className="w-52">
                  <MenuItem
                    icon={<Upload className="w-4 h-4" />}
                    onClick={() => {
                      setIsAttachMenuOpen(false);
                      fileInputRef.current?.click();
                    }}
                  >
                    Upload from computer
                  </MenuItem>

                  {workspaceId && (
                    <MenuItem
                      icon={<FolderOpen className="w-4 h-4" />}
                      onClick={() => {
                        setIsAttachMenuOpen(false);
                        setIsLibraryPickerOpen(true);
                      }}
                    >
                      Attach from Library
                    </MenuItem>
                  )}
                </MenuCard>
              </div>
            )}

            {/* Skill Selector Button & Menu */}
            <div className="relative" ref={skillMenuRef}>
              <button
                type="button"
                onClick={() => setIsSkillMenuOpen((prev) => !prev)}
                disabled={isStreaming}
                className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer select-none ${
                  selectedSkill
                    ? "bg-indigo-50/80 border-indigo-200 text-indigo-700 hover:bg-indigo-100/70"
                    : isSkillMenuOpen
                    ? "bg-zinc-100 border-zinc-300 text-zinc-800"
                    : "border-transparent text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100"
                }`}
                title="Select active agent skill playbook"
              >
                <Sparkles className={`w-3.5 h-3.5 ${selectedSkill ? "text-indigo-600" : ""}`} />
                <span className="hidden sm:inline">
                  {selectedSkill === "deep_research"
                    ? "Research"
                    : selectedSkill === "code_architect"
                    ? "Architect"
                    : selectedSkill === "quiz_master"
                    ? "Quiz"
                    : "Skills"}
                </span>
              </button>

              {/* Floating Skill Menu */}
              {isSkillMenuOpen && (
                <div className="absolute bottom-full left-0 mb-2 z-50 animate-in fade-in-50 zoom-in-95 duration-150">
                  <MenuCard className="min-w-[210px]">
                    <MenuItem
                      icon={<MessageSquare className="w-4 h-4" />}
                      active={selectedSkill === null}
                      trailing={selectedSkill === null ? <span className="text-zinc-900 font-medium">✓</span> : null}
                      onClick={() => {
                        setSelectedSkill(null);
                        setIsSkillMenuOpen(false);
                      }}
                    >
                      Standard Chat
                    </MenuItem>

                    <MenuItem
                      icon={<Compass className="w-4 h-4" />}
                      active={selectedSkill === "deep_research"}
                      trailing={selectedSkill === "deep_research" ? <span className="text-zinc-900 font-medium">✓</span> : null}
                      onClick={() => {
                        setSelectedSkill("deep_research");
                        setIsSkillMenuOpen(false);
                      }}
                    >
                      Deep Research
                    </MenuItem>

                    <MenuItem
                      icon={<Layers className="w-4 h-4" />}
                      active={selectedSkill === "code_architect"}
                      trailing={selectedSkill === "code_architect" ? <span className="text-zinc-900 font-medium">✓</span> : null}
                      onClick={() => {
                        setSelectedSkill("code_architect");
                        setIsSkillMenuOpen(false);
                      }}
                    >
                      Code Architect
                    </MenuItem>

                    <MenuItem
                      icon={<GraduationCap className="w-4 h-4" />}
                      active={selectedSkill === "quiz_master"}
                      trailing={selectedSkill === "quiz_master" ? <span className="text-zinc-900 font-medium">✓</span> : null}
                      onClick={() => {
                        setSelectedSkill("quiz_master");
                        setIsSkillMenuOpen(false);
                      }}
                    >
                      Quiz Master
                    </MenuItem>
                  </MenuCard>
                </div>
              )}
            </div>
          </div>

          {/* Right Action: Send / Stop Button */}
          <div className="flex items-center">
            {isStreaming ? (
              <Button
                type="button"
                variant="destructive"
                size="iconSm"
                onClick={onStopStreaming}
                className="rounded-full h-7 w-7 cursor-pointer"
                title="Stop generating"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
              </Button>
            ) : (
              <button
                type="submit"
                disabled={!canSubmit}
                className="h-7 w-7 rounded-full bg-zinc-900 text-white hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 flex items-center justify-center transition-colors shadow-xs cursor-pointer disabled:cursor-not-allowed"
                title="Send message"
              >
                {isUploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                )}
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Attach from Workspace File Library Modal */}
      {workspaceId && isLibraryPickerOpen && (
        <FileLibraryModal
          isOpen={isLibraryPickerOpen}
          onClose={() => setIsLibraryPickerOpen(false)}
          workspaceId={workspaceId}
          onSelectFile={(selectedFile) => {
            setAttachments((prev) => {
              if (prev.some((a) => a.id === selectedFile.id)) return prev;
              return [...prev, selectedFile];
            });
            setIsLibraryPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}
