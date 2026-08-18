"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Square, Cpu } from "lucide-react";
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
        className="bg-white rounded-2xl border border-slate-200 shadow-lg p-2 flex flex-col space-y-2 transition-all focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100"
      >
        {/* Textarea Input */}
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isStreaming
              ? "GraphMind is generating response..."
              : "Ask anything about AI engineering, system design, code architecture... (Enter to send, Shift+Enter for newline)"
          }
          rows={1}
          disabled={isStreaming}
          className="w-full px-3 py-2 text-sm text-slate-900 placeholder-slate-400 bg-transparent resize-none outline-none font-medium max-h-48"
        />

        {/* Action Controls & Model Selector Bar */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100 px-1">
          {/* Model Selector */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700">
            <Cpu className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={isStreaming}
              className="bg-transparent border-none outline-none font-semibold text-slate-800 cursor-pointer pr-1 text-xs"
            >
              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
              <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="mock">Offline Mock Stream</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            {isStreaming ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={onStopStreaming}
                className="flex items-center space-x-1.5 shadow-xs"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Stop</span>
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                disabled={!prompt.trim()}
                title="Send Message"
              >
                <Send className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </form>
      <p className="text-[11px] text-center text-slate-400 mt-2">
        GraphMind Phase 1 Stream Engine • AI-Provider Agnostic • Markdown & Math typesetting supported
      </p>
    </div>
  );
}
