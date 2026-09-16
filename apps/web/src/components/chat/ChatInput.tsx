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
import { IconButton } from "@/components/ui/icon-button";
import { MenuCard, MenuItem } from "@/components/ui/menu";
import { Surface } from "@/components/ui/surface";
import { Textarea } from "@/components/ui/textarea";
import { BranchContext } from "@/hooks/useChatStream";
import { FileAttachment } from "@graphmind/shared";
import { uploadWorkspaceFile } from "@/lib/workspaceApi";
import { formatBytes } from "@/lib/utils";
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


interface SlashCommand {
  id: string | null;
  command: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: null,
    command: "/chat",
    label: "Standard Chat",
    description: "Default conversational assistant",
    icon: MessageSquare,
  },
  {
    id: "deep_research",
    command: "/research",
    label: "Deep Research",
    description: "Autonomous web and knowledge graph exploration",
    icon: Compass,
  },
  {
    id: "code_architect",
    command: "/code",
    label: "Code Architect",
    description: "System design, refactoring, and code review",
    icon: Layers,
  },
  {
    id: "quiz_master",
    command: "/quiz",
    label: "Quiz Master",
    description: "Interactive Socratic learning checks",
    icon: GraduationCap,
  },
];

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
  const [slashIndex, setSlashIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  // Slash commands trigger when input begins with "/" and hasn't started a space
  const isSlashMode = prompt.startsWith("/") && !prompt.includes(" ");
  const matchingSlashCommands = isSlashMode
    ? SLASH_COMMANDS.filter((cmd) =>
        cmd.command.toLowerCase().startsWith(prompt.toLowerCase())
      )
    : [];

  useEffect(() => {
    setSlashIndex(0);
  }, [prompt]);

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
    let cleanPrompt = prompt.trim();
    let effectiveSkill = selectedSkill;

    // Smart slash command parsing, e.g. "/research quantum computing"
    for (const cmd of SLASH_COMMANDS) {
      if (cleanPrompt.startsWith(cmd.command + " ")) {
        effectiveSkill = cmd.id;
        cleanPrompt = cleanPrompt.slice(cmd.command.length + 1).trim();
        break;
      }
    }

    if ((!cleanPrompt && attachments.length === 0) || isStreaming || isUploading) {
      return;
    }

    onSendMessage(
      cleanPrompt,
      attachments,
      effectiveSkill
    );
    setPrompt("");
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSlashMode && matchingSlashCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex((prev) => (prev + 1) % matchingSlashCommands.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex((prev) => (prev - 1 + matchingSlashCommands.length) % matchingSlashCommands.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const selected = matchingSlashCommands[slashIndex] || matchingSlashCommands[0];
        if (selected) {
          setSelectedSkill(selected.id);
          setPrompt("");
          if (textareaRef.current) {
            textareaRef.current.focus();
          }
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setPrompt("");
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const canSubmit = (prompt.trim().length > 0 || attachments.length > 0) && !isStreaming && !isUploading;

  return (
    <div className="w-full max-w-[var(--chat-content-max)] mx-auto px-4 pb-4 sm:pb-6">
      <form
        onSubmit={handleSubmit}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="relative"
      >
        <Surface
          variant="base"
          radius="card"
          className={`flex flex-col space-y-2 p-3 transition-colors motion-reduce:transition-none focus-within:border-border-strong ${
          isDragOver
            ? "bg-info/10 ring-2 ring-info/50"
            : "hover:bg-surface-hover"
        }`}
        >
        {/* Floating Slash Command Autocomplete Menu */}
        {isSlashMode && matchingSlashCommands.length > 0 && (
          <div className="absolute bottom-full left-0 mb-2 z-50 animate-in fade-in-50 zoom-in-95 duration-150 motion-reduce:animate-none">
            <MenuCard className="min-w-[240px]">
              {matchingSlashCommands.map((cmd, idx) => {
                const Icon = cmd.icon;
                const isHighlighted = idx === slashIndex;
                return (
                  <MenuItem
                    key={cmd.command}
                    icon={<Icon className="w-4 h-4 stroke-[1.75]" />}
                    active={isHighlighted}
                    onClick={() => {
                      setSelectedSkill(cmd.id);
                      setPrompt("");
                      textareaRef.current?.focus();
                    }}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-normal text-foreground-muted">
                        {cmd.command}
                      </span>
                      <span className="font-medium text-foreground">{cmd.label}</span>
                    </div>
                  </MenuItem>
                );
              })}
            </MenuCard>
          </div>
        )}

        {/* Active Branch Context Pill */}
        {activeBranch && (
          <div className="flex items-center justify-between rounded-xl bg-background-secondary px-3 py-1.5 text-xs text-foreground-muted animate-in fade-in-50 slide-in-from-bottom-1 duration-150 motion-reduce:animate-none">
            <div className="flex items-center space-x-1.5 min-w-0 pr-2">
              <GitBranch className="h-3.5 w-3.5 shrink-0" />
              <span className="shrink-0 font-semibold text-foreground">Sub-topic:</span>
              <span className="truncate italic">
                &ldquo;{activeBranch.highlightedText}&rdquo;
              </span>
            </div>
            {onClearBranch && (
              <IconButton
                label="Cancel branch context"
                onClick={onClearBranch}
                variant="ghost"
                className="shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </IconButton>
            )}
          </div>
        )}

        {/* Attachment Previews Tray */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-1 pb-1 pt-1 animate-in fade-in-50 duration-150 motion-reduce:animate-none">
            {attachments.map((att) => {
              const isImg = att.fileCategory === "image" || att.data?.startsWith("data:image/");
              const isCode = att.fileCategory === "code";

              if (isImg) {
                return (
                  <div
                    key={att.id}
                    className="group relative overflow-hidden rounded-xl border border-border bg-surface shadow-2xs transition-all hover:border-border-strong"
                  >
                    <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden bg-background-secondary">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={att.data || att.url}
                        alt={att.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <IconButton
                      label={`Remove ${att.name}`}
                      onClick={() => handleRemoveAttachment(att.id)}
                      variant="destructive"
                      className="absolute right-1 top-1 size-5 bg-foreground/60 text-background hover:bg-foreground"
                    >
                      <X className="w-3 h-3" />
                    </IconButton>
                  </div>
                );
              }

              const isPdf = att.mimeType === "application/pdf" || att.name.toLowerCase().endsWith(".pdf");

              return (
                <div
                  key={att.id}
                  className="group relative flex max-w-60 items-center space-x-2.5 rounded-xl border border-border bg-surface px-3 py-2 shadow-2xs transition-all hover:bg-surface-hover"
                >
                  <div
                    className={`shrink-0 rounded-lg border border-border-subtle bg-background-secondary p-1.5 ${
                      isPdf ? "bg-destructive-bg text-destructive" : isCode ? "text-success" : "text-info"
                    }`}
                  >
                    {isPdf ? (
                      <FileText className="h-4 w-4" />
                    ) : isCode ? (
                      <Code className="h-4 w-4" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0 pr-4">
                    <span className="truncate text-xs font-medium text-foreground" title={att.name}>
                      {att.name}
                    </span>
                    <div className="flex items-center space-x-1.5 font-mono text-2xs text-foreground-muted">
                      {isPdf && (
                        <span className="rounded bg-destructive-bg px-1 text-2xs font-bold text-destructive">
                          PDF
                        </span>
                      )}
                      <span>{formatBytes(att.sizeBytes)}</span>
                    </div>
                  </div>
                  <IconButton
                    label={`Remove ${att.name}`}
                    onClick={() => handleRemoveAttachment(att.id)}
                    variant="ghost"
                    className="absolute right-1.5 top-1.5 size-5"
                  >
                    <X className="w-3 h-3" />
                  </IconButton>
                </div>
              );
            })}

            {isUploading && (
              <div className="flex h-14 items-center justify-center space-x-2 rounded-xl border border-dashed border-border bg-surface px-3 text-xs text-foreground-muted">
                <Loader2 className="w-4 h-4 text-foreground-muted animate-spin motion-reduce:animate-none" />
                <span>Reading file...</span>
              </div>
            )}
          </div>
        )}

        {/* Textarea Input */}
        <Textarea
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
          variant="ghost"
          maxRowsClassName="max-h-48"
          className="min-h-0 border-0 bg-transparent px-3 py-1.5 text-base font-normal leading-relaxed shadow-none focus-visible:ring-0 focus:outline-none placeholder:text-foreground-muted/60"
        />

        {/* Action Bar */}
        <div className="flex items-center justify-between pt-1 px-1">
          {/* Left tools: Unified Plus (+) menu and Active Mode Chip */}
          <div className="flex items-center space-x-2">
            <div className="relative flex items-center" ref={attachMenuRef}>
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

              <IconButton
                label="Add attachment or select mode"
                onClick={() => setIsAttachMenuOpen((prev) => !prev)}
                disabled={isStreaming || isUploading}
                variant={isAttachMenuOpen ? "secondary" : "ghost"}
                className={`rounded-xl ${
                  isAttachMenuOpen
                    ? "text-foreground"
                    : "text-foreground-muted"
                }`}
              >
                <Plus className={`h-4 w-4 stroke-[1.75] transition-transform duration-200 motion-reduce:transition-none ${isAttachMenuOpen ? "rotate-45 text-foreground" : ""}`} />
              </IconButton>

              {/* Unified Action Dropdown Menu */}
              {isAttachMenuOpen && (
                <div className="absolute bottom-full left-0 mb-2 z-50 animate-in fade-in-50 zoom-in-95 duration-150 motion-reduce:animate-none">
                  <MenuCard className="min-w-[210px]">
                    <MenuItem
                      icon={<Upload className="w-4 h-4 stroke-[1.75]" />}
                      onClick={() => {
                        setIsAttachMenuOpen(false);
                        fileInputRef.current?.click();
                      }}
                    >
                      Upload from computer
                    </MenuItem>

                    {workspaceId && (
                      <MenuItem
                        icon={<FolderOpen className="w-4 h-4 stroke-[1.75]" />}
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
            </div>

            {/* Active Mode Compact Chip */}
            {selectedSkill && (
              <div className="flex select-none items-center space-x-1.5 rounded-xl bg-background-secondary px-2.5 py-1 text-xs text-foreground shadow-2xs animate-in fade-in-50 zoom-in-95 duration-150 motion-reduce:animate-none">
                {selectedSkill === "deep_research" ? (
                  <Compass className="h-3.5 w-3.5 shrink-0 stroke-[1.75]" />
                ) : selectedSkill === "code_architect" ? (
                  <Layers className="h-3.5 w-3.5 shrink-0 stroke-[1.75]" />
                ) : selectedSkill === "quiz_master" ? (
                  <GraduationCap className="h-3.5 w-3.5 shrink-0 stroke-[1.75]" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 shrink-0 stroke-[1.75]" />
                )}
                <span className="font-medium text-foreground">
                  {selectedSkill === "deep_research" && "Deep Research"}
                  {selectedSkill === "code_architect" && "Code Architect"}
                  {selectedSkill === "quiz_master" && "Quiz Master"}
                  {!["deep_research", "code_architect", "quiz_master"].includes(selectedSkill) && selectedSkill}
                </span>
                <IconButton
                  label="Clear mode"
                  onClick={() => setSelectedSkill(null)}
                  variant="ghost"
                  className="ml-0.5 shrink-0"
                >
                  <X className="w-3 h-3" />
                </IconButton>
              </div>
            )}
          </div>

          {/* Right Action: Send / Stop Button */}
          <div className="flex items-center">
            {isStreaming ? (
              <Button
                type="button"
                variant="destructive"
                size="icon-sm"
                onClick={onStopStreaming}
                aria-label="Stop generating"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
              </Button>
            ) : (
              <Button
                type="submit"
                variant="default"
                size="icon-sm"
                disabled={!canSubmit}
                aria-label="Send message"
              >
                {isUploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" />
                ) : (
                  <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                )}
              </Button>
            )}
          </div>
        </div>
        </Surface>
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
