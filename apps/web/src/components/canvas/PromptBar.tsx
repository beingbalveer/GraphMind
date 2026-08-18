"use client";

import React, { useState } from "react";
import { Send, Sparkles, Loader2, Cpu } from "lucide-react";
import { useGraphStore } from "@/store/useGraphStore";

export function PromptBar() {
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const { sendPrompt, isStreaming } = useGraphStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isStreaming) return;

    const provider = selectedModel.startsWith("gemini")
      ? "gemini"
      : selectedModel.startsWith("gpt")
      ? "openai"
      : "mock";

    sendPrompt(prompt.trim(), provider, selectedModel);
    setPrompt("");
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-2xl px-4 pointer-events-auto">
      <form
        onSubmit={handleSubmit}
        className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-2xl p-2 flex items-center space-x-2 transition-all hover:border-slate-300"
      >
        {/* Model Selector Pill */}
        <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100/80 border border-slate-200/60 text-xs font-medium text-slate-700">
          <Cpu className="w-3.5 h-3.5 text-sky-600 shrink-0" />
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={isStreaming}
            className="bg-transparent border-none outline-none font-semibold text-slate-800 cursor-pointer pr-1"
          >
            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
            <option value="gpt-4o-mini">GPT-4o Mini</option>
            <option value="mock">Offline Mock Stream</option>
          </select>
        </div>

        {/* Input Text Area */}
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            isStreaming
              ? "AI is streaming response into graph node..."
              : "Ask anything to create a new graph node..."
          }
          disabled={isStreaming}
          className="flex-1 bg-transparent px-2 text-xs text-slate-800 placeholder-slate-400 outline-none font-medium"
        />

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!prompt.trim() || isStreaming}
          className={`p-2.5 rounded-xl transition-all font-semibold flex items-center justify-center ${
            !prompt.trim() || isStreaming
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-sky-600 hover:bg-sky-700 text-white shadow-md"
          }`}
        >
          {isStreaming ? (
            <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>
    </div>
  );
}
