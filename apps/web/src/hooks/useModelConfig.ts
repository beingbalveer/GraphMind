"use client";

import { useState, useEffect, useCallback } from "react";

export interface LLMConfig {
  provider: "gemini" | "openai" | "mock";
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  geminiApiKey: string;
  openaiApiKey: string;
}

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: "gemini",
  model: "gemini-2.5-flash",
  temperature: 0.7,
  maxTokens: 4096,
  systemPrompt: "",
  geminiApiKey: "",
  openaiApiKey: "",
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
      return undefined;
    },
    [config.geminiApiKey, config.openaiApiKey]
  );

  return {
    config,
    isLoaded,
    updateConfig,
    resetDefaults,
    getEffectiveApiKey,
  };
}
