"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  Sliders,
  Key,
  Eye,
  EyeOff,
  RotateCcw,
  Check,
  Brain,
  Layers,
  ShieldCheck,
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
    name: "Google Gemini",
    icon: Sparkles,
    badge: "Recommended",
    models: [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", desc: "Fast, highly capable for structured tree thinking" },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", desc: "Advanced reasoning for deep architectural tasks" },
    ],
  },
  {
    id: "openai" as const,
    name: "OpenAI",
    icon: Brain,
    badge: "BYOK",
    models: [
      { id: "gpt-4o", name: "GPT-4o", desc: "High-intelligence flagship multimodal model" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", desc: "Fast, cost-efficient everyday model" },
    ],
  },
  {
    id: "mock" as const,
    name: "Mock Mode",
    icon: Layers,
    badge: "Local",
    models: [
      { id: "mock-stream", name: "Mock Stream Engine", desc: "Simulated offline streaming without API calls" },
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
  const [maxTokens, setMaxTokens] = useState(config.maxTokens);
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
      setMaxTokens(config.maxTokens);
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
      maxTokens,
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
    setMaxTokens(DEFAULT_LLM_CONFIG.maxTokens);
    setSystemPrompt(DEFAULT_LLM_CONFIG.systemPrompt);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-white rounded-2xl border border-zinc-200/90 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-100 border border-zinc-200/80 flex items-center justify-center text-zinc-900 shadow-2xs">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-950 tracking-tight">
                Model & AI Configuration
              </h2>
              <p className="text-xs text-zinc-500">
                Choose default inference models, parameters, and BYOK API keys
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-zinc-800">
          {/* 1. Provider Selection */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
              AI Provider
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {PROVIDERS.map((prov) => {
                const isSelected = selectedProvider === prov.id;
                const Icon = prov.icon;
                return (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => handleProviderSelect(prov.id)}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      isSelected
                        ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                        : "border-zinc-200/80 bg-zinc-50/50 hover:bg-zinc-100/80 hover:border-zinc-300 text-zinc-800"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <Icon className={`w-4 h-4 ${isSelected ? "text-zinc-200" : "text-zinc-600"}`} />
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                          isSelected
                            ? "bg-white/20 text-white"
                            : "bg-zinc-200/70 text-zinc-700"
                        }`}
                      >
                        {prov.badge}
                      </span>
                    </div>
                    <span className="font-semibold text-xs">{prov.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Model Selection under Selected Provider */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
              Model Selection ({currentProviderObj.name})
            </label>
            <div className="space-y-1.5">
              {currentProviderObj.models.map((m) => {
                const isSelected = selectedModel === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedModel(m.id)}
                    className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? "border-zinc-900 bg-zinc-50 text-zinc-950 font-medium ring-1 ring-zinc-900"
                        : "border-zinc-200 bg-white hover:bg-zinc-50/70 text-zinc-700"
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs text-zinc-900">{m.name}</div>
                      <div className="text-[11.5px] text-zinc-500">{m.desc}</div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-zinc-950 shrink-0 ml-2" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Bring Your Own Key (BYOK) */}
          <div className="space-y-2.5 pt-2 border-t border-zinc-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-900 uppercase tracking-wider flex items-center space-x-1.5">
                <Key className="w-3.5 h-3.5 text-zinc-500" />
                <span>Bring Your Own Key (BYOK)</span>
              </label>
              <span className="text-[11px] text-zinc-400 flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Stored locally in browser</span>
              </span>
            </div>

            {selectedProvider === "gemini" && (
              <div className="space-y-1.5">
                <label className="text-[11.5px] font-medium text-zinc-700">
                  Gemini API Key (Optional — overrides server key)
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showGeminiKey ? "text" : "password"}
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-3 py-2 pr-10 rounded-xl border border-zinc-200 text-xs font-mono text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 bg-zinc-50/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey((prev) => !prev)}
                    className="absolute right-2.5 p-1 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
                  >
                    {showGeminiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}

            {selectedProvider === "openai" && (
              <div className="space-y-1.5">
                <label className="text-[11.5px] font-medium text-zinc-700">
                  OpenAI API Key (Required for OpenAI models)
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showOpenAiKey ? "text" : "password"}
                    value={openaiApiKey}
                    onChange={(e) => setOpenaiApiKey(e.target.value)}
                    placeholder="sk-proj-..."
                    className="w-full px-3 py-2 pr-10 rounded-xl border border-zinc-200 text-xs font-mono text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 bg-zinc-50/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOpenAiKey((prev) => !prev)}
                    className="absolute right-2.5 p-1 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
                  >
                    {showOpenAiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}

            {selectedProvider === "mock" && (
              <p className="text-xs text-zinc-500 italic bg-zinc-50 p-2 rounded-lg border border-zinc-200/60">
                Mock mode runs fully offline. No API key required.
              </p>
            )}
          </div>

          {/* 4. Generation Parameters */}
          <div className="space-y-4 pt-2 border-t border-zinc-100">
            <label className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
              Generation Parameters
            </label>

            {/* Temperature Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-700">Temperature</span>
                <span className="font-mono font-semibold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded">
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
                className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-900"
              />
              <div className="flex justify-between text-[10px] text-zinc-400 font-medium">
                <span>0.0 (Precise / Code)</span>
                <span>0.7 (Balanced)</span>
                <span>1.0 (Creative)</span>
              </div>
            </div>

            {/* Max Output Tokens */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-700">Max Tokens</span>
                <span className="font-mono font-semibold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded">
                  {maxTokens}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[1024, 2048, 4096, 8192].map((tok) => (
                  <button
                    key={tok}
                    type="button"
                    onClick={() => setMaxTokens(tok)}
                    className={`py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                      maxTokens === tok
                        ? "bg-zinc-900 text-white border-zinc-900 shadow-2xs"
                        : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    {tok}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom System Prompt */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-700">Custom System Instructions</span>
                <span className="text-[10.5px] text-zinc-400">Optional</span>
              </div>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="e.g. You are a senior distributed systems architect. Provide concise code examples with time/space complexity analysis..."
                rows={3}
                className="w-full p-3 rounded-xl border border-zinc-200 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 bg-zinc-50/50 resize-none leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-zinc-50/80 border-t border-zinc-100 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center space-x-1.5 text-xs text-zinc-500 hover:text-zinc-900 transition-colors font-medium cursor-pointer"
            title="Reset model parameters to system defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs text-zinc-700 hover:text-zinc-950"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="text-xs bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm"
            >
              {savedFeedback ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400 mr-1" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Preferences</span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
