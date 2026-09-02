"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { ArrowUp, Square, GitBranch, X, Paperclip, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BranchContext } from "@/hooks/useChatStream";
import { FileAttachment } from "@graphmind/shared";
import { uploadWorkspaceFile } from "@/lib/workspaceApi";

interface ChatInputProps {
  onSendMessage: (prompt: string, attachments?: FileAttachment[]) => void;
  onStopStreaming: () => void;
  isStreaming: boolean;
  workspaceId?: string;
  activeBranch?: BranchContext | null;
  onClearBranch?: () => void;
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

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const fileList = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (fileList.length === 0) return;

      setIsUploading(true);
      try {
        for (const file of fileList) {
          // Read base64 data URL for preview and multimodal transmission
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          let uploadedId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          let uploadedUrl: string | undefined = undefined;

          // If workspace is active, persist file to Workspace File Library
          if (workspaceId) {
            const res = await uploadWorkspaceFile(workspaceId, file);
            if (res) {
              uploadedId = res.id;
              uploadedUrl = res.url;
            }
          }

          const newAttachment: FileAttachment = {
            id: uploadedId,
            name: file.name,
            sizeBytes: file.size,
            mimeType: file.type || "image/png",
            fileCategory: "image",
            url: uploadedUrl,
            data: dataUrl,
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

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      processFiles(imageFiles);
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

    onSendMessage(cleanPrompt, attachments.length > 0 ? attachments : undefined);
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

        {/* Attachment Previews Tray */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-1 pt-1 pb-1 animate-in fade-in-50 duration-150">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="relative group rounded-xl border border-zinc-200/90 bg-zinc-50 overflow-hidden shadow-2xs transition-all hover:border-zinc-300"
              >
                {att.data || att.url ? (
                  <div className="relative w-16 h-16 bg-zinc-100 flex items-center justify-center overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={att.data || att.url}
                      alt={att.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 flex flex-col items-center justify-center p-1 text-[10px] text-zinc-500 text-center">
                    <span className="truncate max-w-full font-medium">{att.name}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(att.id)}
                  className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white hover:bg-black transition-colors cursor-pointer"
                  title="Remove attachment"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {isUploading && (
              <div className="w-16 h-16 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
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
              : "Message GraphMind or paste images..."
          }
          rows={1}
          disabled={isStreaming}
          className="w-full px-2 py-1.5 text-[15.5px] text-zinc-900 placeholder-zinc-400 bg-transparent resize-none outline-none font-normal max-h-48 leading-relaxed"
        />

        {/* Action Bar */}
        <div className="flex items-center justify-between pt-1 px-1">
          {/* Left tools: Paperclip attachment button */}
          <div className="flex items-center space-x-1.5">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
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
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming || isUploading}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Attach image (PNG, JPG, WebP)"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <span className="text-[11px] text-zinc-400 select-none pl-1 hidden sm:inline">
              Press <kbd className="font-sans px-1 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-zinc-500 text-[10px]">Enter</kbd> to send
            </span>
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
    </div>
  );
}
