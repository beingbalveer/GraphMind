"use client";

import React, { useState, useRef, useEffect } from "react";
import { ArrowUp, Square, GitBranch, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BranchContext } from "@/hooks/useChatStream";

interface ChatInputProps {
  onSendMessage: (prompt: string) => void;
  onStopStreaming: () => void;
  isStreaming: boolean;
  activeBranch?: BranchContext | null;
  onClearBranch?: () => void;
}

export function ChatInput({
  onSendMessage,
  onStopStreaming,
  isStreaming,
  activeBranch,
  onClearBranch,
}: ChatInputProps) {
  const [prompt, setPrompt] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isStreaming) return;

    onSendMessage(prompt.trim());
    setPrompt("");
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

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4 sm:pb-6">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-zinc-200/90 shadow-sm hover:border-zinc-300 p-2.5 flex flex-col space-y-2 transition-all focus-within:border-zinc-400 focus-within:shadow-md"
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

        {/* Textarea Input */}
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            activeBranch
              ? `Ask a follow-up about "${activeBranch.highlightedText.slice(0, 30)}..."`
              : "Message GraphMind..."
          }
          rows={1}
          disabled={isStreaming}
          className="w-full px-2 py-1.5 text-[15.5px] text-zinc-900 placeholder-zinc-400 bg-transparent resize-none outline-none font-normal max-h-48 leading-relaxed"
        />

        {/* Action Bar */}
        <div className="flex items-center justify-between pt-1 px-1">
          <div className="text-[11px] text-zinc-400 select-none pl-1">
            Press <kbd className="font-sans px-1 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-zinc-500 text-[10px]">Enter</kbd> to send
          </div>

          {/* Send / Stop Button */}
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
                disabled={!prompt.trim()}
                className="h-7 w-7 rounded-full bg-zinc-900 text-white hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 flex items-center justify-center transition-colors shadow-xs cursor-pointer disabled:cursor-not-allowed"
                title="Send message"
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

