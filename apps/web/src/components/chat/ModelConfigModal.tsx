"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  Eye,
  EyeOff,
  RotateCcw,
  Check,
  Brain,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LLMConfig, DEFAULT_LLM_CONFIG } from "@/hooks/useModelConfig";

interface ModelConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: LLMConfig;
  onSaveConfig: (updates: Partial<LLMConfig>) => void;
  onResetDefaults: () => void;
}

const PROVIDERS = [
  {
    id: "gemini" as const,
    name: "Gemini",
    icon: Sparkles,
    models: [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    ],
  },
  {
    id: "openai" as const,
    name: "OpenAI",
    icon: Brain,
    models: [
      { id: "gpt-4o", name: "GPT-4o" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini" },
    ],
  },
  {
    id: "mock" as const,
    name: "Mock Mode",
    icon: Layers,
    models: [
      { id: "mock-stream", name: "Mock Stream Engine" },
    ],
  },
];

export function ModelConfigModal({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onResetDefaults,
}: ModelConfigModalProps) {
  const [selectedProvider, setSelectedProvider] = useState(config.provider);
  const [selectedModel, setSelectedModel] = useState(config.model);
  const [temperature, setTemperature] = useState(config.temperature);
  const [systemPrompt, setSystemPrompt] = useState(config.systemPrompt);
  const [geminiApiKey, setGeminiApiKey] = useState(config.geminiApiKey);
  const [openaiApiKey, setOpenaiApiKey] = useState(config.openaiApiKey);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenAiKey, setShowOpenAiKey] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  // Sync state when modal opens with new config
  useEffect(() => {
    if (isOpen) {
      setSelectedProvider(config.provider);
      setSelectedModel(config.model);
      setTemperature(config.temperature);
      setSystemPrompt(config.systemPrompt);
      setGeminiApiKey(config.geminiApiKey);
      setOpenaiApiKey(config.openaiApiKey);
      setSavedFeedback(false);
    }
  }, [isOpen, config]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentProviderObj = PROVIDERS.find((p) => p.id === selectedProvider) || PROVIDERS[0];

  const handleProviderSelect = (providerId: "gemini" | "openai" | "mock") => {
    setSelectedProvider(providerId);
    const targetObj = PROVIDERS.find((p) => p.id === providerId);
    if (targetObj && targetObj.models.length > 0) {
      setSelectedModel(targetObj.models[0].id);
    }
  };

  const handleSave = () => {
    onSaveConfig({
      provider: selectedProvider,
      model: selectedModel,
      temperature,
      systemPrompt,
      geminiApiKey: geminiApiKey.trim(),
      openaiApiKey: openaiApiKey.trim(),
    });
    setSavedFeedback(true);
    setTimeout(() => {
      setSavedFeedback(false);
      onClose();
    }, 400);
  };

  const handleReset = () => {
    onResetDefaults();
    setSelectedProvider(DEFAULT_LLM_CONFIG.provider);
    setSelectedModel(DEFAULT_LLM_CONFIG.model);
    setTemperature(DEFAULT_LLM_CONFIG.temperature);
    setSystemPrompt(DEFAULT_LLM_CONFIG.systemPrompt);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/25 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-2xl border border-zinc-200/80 shadow-xl overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-white">
          <h2 className="text-sm font-semibold text-zinc-900 tracking-tight">
            Model Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-sm text-zinc-800">
          {/* 1. Provider Segmented Pill Bar (Material 3) */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
              Provider
            </span>
            <div className="flex p-1 bg-zinc-100/80 rounded-xl border border-zinc-200/50">
              {PROVIDERS.map((prov) => {
                const isSelected = selectedProvider === prov.id;
                const Icon = prov.icon;
                return (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => handleProviderSelect(prov.id)}
                    className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? "bg-white text-zinc-900 shadow-xs font-semibold"
                        : "text-zinc-500 hover:text-zinc-900"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-zinc-900" : "text-zinc-400"}`} />
                    <span>{prov.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. API Key (BYOK) - Positioned at top under Provider */}
          {selectedProvider === "gemini" && (
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                Gemini API Key (Optional)
              </label>
              <div className="relative flex items-center">
                <input
                  type={showGeminiKey ? "text" : "password"}
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="AIzaSy... (uses server key by default)"
                  className="w-full px-3 py-2 pr-9 rounded-xl border border-zinc-200 text-xs font-mono text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-zinc-50/40"
                />
                <button
                  type="button"
                  onClick={() => setShowGeminiKey((prev) => !prev)}
                  className="absolute right-2 p-1 text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
                >
                  {showGeminiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}

          {selectedProvider === "openai" && (
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                OpenAI API Key
              </label>
              <div className="relative flex items-center">
                <input
                  type={showOpenAiKey ? "text" : "password"}
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                  placeholder="sk-proj-..."
                  className="w-full px-3 py-2 pr-9 rounded-xl border border-zinc-200 text-xs font-mono text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-zinc-50/40"
                />
                <button
                  type="button"
                  onClick={() => setShowOpenAiKey((prev) => !prev)}
                  className="absolute right-2 p-1 text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
                >
                  {showOpenAiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}

          {/* 3. Model Selection */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
              Model
            </span>
            <div className="space-y-1.5">
              {currentProviderObj.models.map((m) => {
                const isSelected = selectedModel === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedModel(m.id)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? "border-blue-300 bg-blue-50/40 text-zinc-950 font-medium ring-1 ring-blue-400/20"
                        : "border-zinc-200/70 bg-zinc-50/30 hover:bg-zinc-50 hover:border-zinc-300 text-zinc-700"
                    }`}
                  >
                    <span className="text-xs font-medium">{m.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>


          {/* 4. Temperature Slider */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Temperature</span>
              <span className="font-mono text-xs font-medium text-zinc-600">
                {temperature.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-800"
            />
            <div className="flex justify-between text-[10.5px] text-zinc-400">
              <span>Precise</span>
              <span>Balanced</span>
              <span>Creative</span>
            </div>
          </div>

          {/* 5. Custom System Instructions */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
              System instructions
            </span>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="e.g. You are a senior engineer. Provide concise code examples..."
              rows={3}
              className="w-full p-3 rounded-xl border border-zinc-200 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-zinc-50/40 resize-none leading-relaxed"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 bg-zinc-50/70 border-t border-zinc-100 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center space-x-1 text-xs text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
            title="Reset to default"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset to default</span>
          </button>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs text-zinc-600 hover:text-zinc-900 h-8 px-3 rounded-lg"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="text-xs bg-zinc-900 text-white hover:bg-zinc-800 h-8 px-3.5 rounded-lg shadow-xs cursor-pointer"
            >
              {savedFeedback ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400 mr-1" />
                  <span>Saved</span>
                </>
              ) : (
                <span>Save</span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
