"use client";

import { useState, useEffect, useCallback } from "react";

export type LLMProvider =
  | "gemini"
  | "openai"
  | "anthropic"
  | "deepseek"
  | "ollama"
  | "mock";

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  geminiApiKey: string;
  openaiApiKey: string;
  anthropicApiKey: string;
  deepseekApiKey: string;
  ollamaBaseUrl: string;
}

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: "gemini",
  model: "gemini-2.5-flash",
  temperature: 0.7,
  maxTokens: 4096,
  systemPrompt: "",
  geminiApiKey: "",
  openaiApiKey: "",
  anthropicApiKey: "",
  deepseekApiKey: "",
  ollamaBaseUrl: "http://localhost:11434/v1",
};

const STORAGE_KEY = "graphmind:llm-config";

export function useModelConfig() {
  const [config, setConfig] = useState<LLMConfig>(DEFAULT_LLM_CONFIG);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load configuration from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setConfig((prev) => ({
          ...prev,
          ...parsed,
        }));
      }
    } catch {
      // Fallback to default config on error
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save configuration changes to localStorage
  const updateConfig = useCallback((updates: Partial<LLMConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // localStorage failure fallback
      }
      return next;
    });
  }, []);

  // Reset to default settings (preserving API keys if desired or full reset)
  const resetDefaults = useCallback((preserveKeys = true) => {
    setConfig((prev) => {
      const next: LLMConfig = {
        ...DEFAULT_LLM_CONFIG,
        geminiApiKey: preserveKeys ? prev.geminiApiKey : "",
        openaiApiKey: preserveKeys ? prev.openaiApiKey : "",
        anthropicApiKey: preserveKeys ? prev.anthropicApiKey : "",
        deepseekApiKey: preserveKeys ? prev.deepseekApiKey : "",
        ollamaBaseUrl: preserveKeys ? prev.ollamaBaseUrl : "http://localhost:11434/v1",
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage fallback
      }
      return next;
    });
  }, []);

  const getEffectiveApiKey = useCallback(
    (providerName: string): string | undefined => {
      if (providerName === "gemini" || providerName === "google") {
        return config.geminiApiKey.trim() || undefined;
      }
      if (providerName === "openai") {
        return config.openaiApiKey.trim() || undefined;
      }
      if (providerName === "anthropic" || providerName === "claude") {
        return config.anthropicApiKey.trim() || undefined;
      }
      if (providerName === "deepseek") {
        return config.deepseekApiKey.trim() || undefined;
      }
      return undefined;
    },
    [config.geminiApiKey, config.openaiApiKey, config.anthropicApiKey, config.deepseekApiKey]
  );

  const getEffectiveBaseUrl = useCallback(
    (providerName: string): string | undefined => {
      if (providerName === "ollama") {
        return config.ollamaBaseUrl.trim() || undefined;
      }
      return undefined;
    },
    [config.ollamaBaseUrl]
  );

  return {
    config,
    isLoaded,
    updateConfig,
    resetDefaults,
    getEffectiveApiKey,
    getEffectiveBaseUrl,
  };
}
