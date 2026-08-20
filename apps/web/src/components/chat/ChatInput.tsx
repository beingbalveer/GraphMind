"use client";

import React, { useState, useRef, useEffect } from "react";
import { ArrowUp, Square, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

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
        className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:border-slate-300 p-2.5 flex flex-col space-y-2 transition-all focus-within:border-slate-400 focus-within:shadow-md"
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
          className="w-full px-2 py-1.5 text-[15px] text-slate-900 placeholder-slate-400 bg-transparent resize-none outline-none font-normal max-h-48 leading-relaxed"
        />

        {/* Action Bar */}
        <div className="flex items-center justify-between pt-1 px-1">
          {/* Model Selector Pill */}
          <div className="relative inline-flex items-center">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={isStreaming}
              className="appearance-none bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-medium text-xs rounded-lg pl-2.5 pr-6 py-1 cursor-pointer outline-none transition-colors disabled:opacity-50"
            >
              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
              <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="mock">Offline Mock Stream</option>
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 pointer-events-none absolute right-2" />
          </div>

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
                className="h-7 w-7 rounded-full bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 flex items-center justify-center transition-colors shadow-xs"
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
