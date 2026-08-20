"use client";

import React, { useState, useRef, useEffect } from "react";
import { ArrowUp, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModelSelector } from "./ModelSelector";

interface ChatInputProps {
  onSendMessage: (prompt: string, provider: string, model: string) => void;
  onStopStreaming: () => void;
  isStreaming: boolean;
}

export function ChatInput({
  onSendMessage,
  onStopStreaming,
  isStreaming,
}: ChatInputProps) {
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

    const provider = selectedModel.startsWith("gemini")
      ? "gemini"
      : selectedModel.startsWith("gpt")
      ? "openai"
      : "mock";

    onSendMessage(prompt.trim(), provider, selectedModel);
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
        {/* Textarea Input */}
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message GraphMind..."
          rows={1}
          disabled={isStreaming}
          className="w-full px-2 py-1.5 text-[15.5px] text-zinc-900 placeholder-zinc-400 bg-transparent resize-none outline-none font-normal max-h-48 leading-relaxed"
        />

        {/* Action Bar */}
        <div className="flex items-center justify-between pt-1 px-1">
          {/* Custom Accessible Model Selector */}
          <ModelSelector
            selectedModel={selectedModel}
            onSelectModel={setSelectedModel}
            disabled={isStreaming}
          />

          {/* Send / Stop Button */}
          <div className="flex items-center">
            {isStreaming ? (
              <Button
                type="button"
                variant="destructive"
                size="iconSm"
                onClick={onStopStreaming}
                className="rounded-full h-7 w-7"
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
