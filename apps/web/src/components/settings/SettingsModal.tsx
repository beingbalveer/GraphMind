"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Sparkles,
  Sliders,
  Palette,
  FolderGit2,
  Keyboard,
  Info,
  Check,
  RotateCcw,
  Eye,
  EyeOff,
  Cpu,
  Bot,
  Zap,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SettingRow, SettingSection } from "@/components/ui/setting-row";
import { LLMConfig, LLMProvider, DEFAULT_LLM_CONFIG } from "@/hooks/useModelConfig";
import { WorkspaceItem } from "@/lib/workspaceApi";
import { cn } from "@/lib/utils";

export type SettingsTabId =
  | "models"
  | "general"
  | "appearance"
  | "workspaces"
  | "shortcuts"
  | "about";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: LLMConfig;
  onSaveConfig: (updates: Partial<LLMConfig>) => void;
  onResetDefaults: () => void;
  currentWorkspace?: WorkspaceItem | null;
  initialTab?: SettingsTabId;
}

interface ProviderMeta {
  id: LLMProvider;
  name: string;
  tagline: string;
  badge?: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PROVIDER_METAS: ProviderMeta[] = [
  { id: "gemini", name: "Google Gemini", tagline: "Fast multi-modal & reasoning", badge: "Recommended", icon: Sparkles },
  { id: "anthropic", name: "Anthropic Claude", tagline: "High-intelligence reasoning & code", icon: Bot },
  { id: "openai", name: "OpenAI GPT", tagline: "Industry standard models", icon: Cpu },
  { id: "deepseek", name: "DeepSeek", tagline: "Open reasoning models (R1 & V3)", icon: Zap },
  { id: "ollama", name: "Ollama", tagline: "Local inference without cloud keys", icon: Sliders },
  { id: "mock", name: "Mock Engine", tagline: "Zero-latency offline test stream", icon: Info },
];

const MODELS_BY_PROVIDER: Record<LLMProvider, Array<{ id: string; name: string; desc?: string }>> = {
  gemini: [
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", desc: "Default ultra-fast responsive model" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", desc: "Complex reasoning & deep logic" },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", desc: "High-throughput fallback" },
  ],
  openai: [
    { id: "gpt-4o", name: "GPT-4o", desc: "Flagship omni intelligence" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini", desc: "Fast & lightweight" },
    { id: "o3-mini", name: "o3-mini", desc: "STEM & math reasoning" },
  ],
  anthropic: [
    { id: "claude-3-7-sonnet", name: "Claude 3.7 Sonnet", desc: "Hybrid reasoning architecture" },
    { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", desc: "Exceptional coding & nuance" },
    { id: "claude-3-5-haiku", name: "Claude 3.5 Haiku", desc: "High-speed lightweight Claude" },
  ],
  deepseek: [
    { id: "deepseek-reasoner", name: "DeepSeek R1", desc: "Chain-of-thought open reasoning" },
    { id: "deepseek-chat", name: "DeepSeek V3", desc: "General chat & generation" },
  ],
  ollama: [
    { id: "deepseek-r1", name: "DeepSeek R1 (Local)", desc: "Local Ollama tag" },
    { id: "llama3.3", name: "Llama 3.3", desc: "Meta open foundation" },
    { id: "qwen2.5-coder", name: "Qwen 2.5 Coder", desc: "Targeted code generation" },
    { id: "mistral", name: "Mistral", desc: "General 7B instruction model" },
  ],
  mock: [{ id: "mock-stream", name: "Mock Stream Engine", desc: "Simulated token stream" }],
};

export function SettingsModal({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onResetDefaults,
  currentWorkspace,
  initialTab = "models",
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);

  // Model & LLM Settings
  const [selectedProvider, setSelectedProvider] = useState<LLMProvider>(config.provider);
  const [selectedModel, setSelectedModel] = useState(config.model);
  const [temperature, setTemperature] = useState(config.temperature);
  const [systemPrompt, setSystemPrompt] = useState(config.systemPrompt);
  const [geminiApiKey, setGeminiApiKey] = useState(config.geminiApiKey || "");
  const [openaiApiKey, setOpenaiApiKey] = useState(config.openaiApiKey || "");
  const [anthropicApiKey, setAnthropicApiKey] = useState(config.anthropicApiKey || "");
  const [deepseekApiKey, setDeepseekApiKey] = useState(config.deepseekApiKey || "");
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState(config.ollamaBaseUrl || "http://localhost:11434/v1");
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenAiKey, setShowOpenAiKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showDeepseekKey, setShowDeepseekKey] = useState(false);

  // General Settings
  const [autoScroll, setAutoScroll] = useState(true);
  const [enableLatex, setEnableLatex] = useState(true);
  const [streamSpeed, setStreamSpeed] = useState<"fast" | "natural">("fast");

  // Appearance Settings
  const [compactDensity, setCompactDensity] = useState(false);

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedProvider(config.provider);
      setSelectedModel(config.model);
      setTemperature(config.temperature);
      setSystemPrompt(config.systemPrompt);
      setGeminiApiKey(config.geminiApiKey || "");
      setOpenaiApiKey(config.openaiApiKey || "");
      setAnthropicApiKey(config.anthropicApiKey || "");
      setDeepseekApiKey(config.deepseekApiKey || "");
      setOllamaBaseUrl(config.ollamaBaseUrl || "http://localhost:11434/v1");
      setSaveState("idle");
      setErrorMessage(null);
    }
  }, [isOpen, config]);

  const hasUnsavedChanges = useMemo(() => {
    return (
      selectedProvider !== config.provider ||
      selectedModel !== config.model ||
      temperature !== config.temperature ||
      systemPrompt !== config.systemPrompt ||
      geminiApiKey !== (config.geminiApiKey || "") ||
      openaiApiKey !== (config.openaiApiKey || "") ||
      anthropicApiKey !== (config.anthropicApiKey || "") ||
      deepseekApiKey !== (config.deepseekApiKey || "") ||
      ollamaBaseUrl !== (config.ollamaBaseUrl || "http://localhost:11434/v1")
    );
  }, [
    selectedProvider,
    selectedModel,
    temperature,
    systemPrompt,
    geminiApiKey,
    openaiApiKey,
    anthropicApiKey,
    deepseekApiKey,
    ollamaBaseUrl,
    config,
  ]);

  if (!isOpen) return null;

  const handleProviderSelect = (providerId: LLMProvider) => {
    setSelectedProvider(providerId);
    const available = MODELS_BY_PROVIDER[providerId];
    if (available && available.length > 0) {
      setSelectedModel(available[0].id);
    }
  };

  const handleSave = async () => {
    setErrorMessage(null);

    // Explicit validation check
    if (selectedProvider === "ollama" && ollamaBaseUrl.trim()) {
      try {
        new URL(ollamaBaseUrl.trim());
      } catch {
        setErrorMessage("Invalid Ollama Server URL. Please enter a valid http:// or https:// URL.");
        setSaveState("error");
        return;
      }
    }

    setSaveState("saving");
    try {
      onSaveConfig({
        provider: selectedProvider,
        model: selectedModel,
        temperature,
        systemPrompt,
        geminiApiKey: geminiApiKey.trim(),
        openaiApiKey: openaiApiKey.trim(),
        anthropicApiKey: anthropicApiKey.trim(),
        deepseekApiKey: deepseekApiKey.trim(),
        ollamaBaseUrl: ollamaBaseUrl.trim() || "http://localhost:11434/v1",
      });
      setSaveState("saved");
      setTimeout(() => {
        setSaveState("idle");
        onClose();
      }, 400);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save configuration.");
      setSaveState("error");
    }
  };

  const handleReset = () => {
    onResetDefaults();
    setSelectedProvider(DEFAULT_LLM_CONFIG.provider);
    setSelectedModel(DEFAULT_LLM_CONFIG.model);
    setTemperature(DEFAULT_LLM_CONFIG.temperature);
    setSystemPrompt(DEFAULT_LLM_CONFIG.systemPrompt);
    setGeminiApiKey(DEFAULT_LLM_CONFIG.geminiApiKey);
    setOpenaiApiKey(DEFAULT_LLM_CONFIG.openaiApiKey);
    setAnthropicApiKey(DEFAULT_LLM_CONFIG.anthropicApiKey);
    setDeepseekApiKey(DEFAULT_LLM_CONFIG.deepseekApiKey);
    setOllamaBaseUrl(DEFAULT_LLM_CONFIG.ollamaBaseUrl);
    setSaveState("idle");
    setErrorMessage(null);
  };

  interface NavItem {
    id: SettingsTabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }

  interface NavSection {
    title: string;
    items: NavItem[];
  }

  const navSections: NavSection[] = [
    {
      title: "Configuration",
      items: [
        { id: "models", label: "Models & AI", icon: Sparkles },
        { id: "workspaces", label: "Workspaces", icon: FolderGit2 },
        { id: "general", label: "General", icon: Sliders, badge: "Roadmap" },
        { id: "appearance", label: "Appearance", icon: Palette, badge: "Roadmap" },
      ],
    },
    {
      title: "Reference",
      items: [
        { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
        { id: "about", label: "About", icon: Info },
      ],
    },
  ];

  return (
    <>
      <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="4xl"
      className="h-[620px] max-h-[92vh] flex-col sm:flex-row p-0 overflow-hidden border-border-subtle shadow-modal"
    >
      {/* Left Sidebar Navigation */}
      <aside className="w-full sm:w-56 bg-background-secondary border-r border-border-subtle flex flex-col shrink-0 p-3 select-none">
        <div className="h-13 px-3 flex items-center shrink-0 border-b border-border-subtle/80 mb-2">
          <h2 className="text-sm font-semibold text-foreground tracking-tight">
            Settings
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {navSections.map((sec) => (
            <div key={sec.title} className="space-y-1">
              <span className="text-2xs font-semibold text-foreground-muted uppercase tracking-wider px-3">
                {sec.title}
              </span>
              <div className="space-y-0.5 mt-1">
                {sec.items.map((item) => {
                  const isSelected = activeTab === item.id;
                  const Icon = item.icon;
                  return (
                    <Button
                      key={item.id}
                      type="button"
                      variant={isSelected ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setActiveTab(item.id)}
                      className={cn(
                        "w-full justify-between h-auto py-2 px-3 text-xs font-medium transition-all text-left cursor-pointer rounded-lg shadow-none",
                        isSelected
                          ? "bg-surface text-foreground font-semibold shadow-xs border border-border"
                          : "text-foreground-muted hover:bg-surface-hover hover:text-foreground border border-transparent"
                      )}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isSelected ? "text-foreground" : "text-foreground-muted"
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="text-2xs font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md shrink-0">
                          {item.badge}
                        </span>
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Version Info */}
        <div className="pt-2.5 border-t border-border-subtle px-3 py-1 flex items-center justify-between text-2xs text-foreground-muted">
          <span>GraphMind</span>
          <span className="font-mono text-2xs text-foreground-muted/80">v0.1.0</span>
        </div>
      </aside>

      {/* Right Detail Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
        {/* Standardized Header: h-13 with border-b */}
        <div className="h-13 px-6 border-b border-border-subtle flex items-center justify-between shrink-0 bg-surface">
          <div>
            <h1 className="text-sm font-semibold text-foreground tracking-tight">
              {activeTab === "models" && "Models & AI"}
              {activeTab === "workspaces" && "Workspaces & Data"}
              {activeTab === "general" && "General Settings"}
              {activeTab === "appearance" && "Appearance & UI"}
              {activeTab === "shortcuts" && "Keyboard Shortcuts"}
              {activeTab === "about" && "About GraphMind"}
            </h1>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-foreground">
          {/* 1. MODELS TAB */}
          {activeTab === "models" && (
            <div className="space-y-6">
              {/* Provider Selection Cards */}
              <div className="space-y-2.5">
                <div>
                  <h3 className="text-xs font-semibold text-foreground tracking-tight">
                    AI Provider
                  </h3>
                  <p className="text-xs text-foreground-muted mt-0.5">
                    Select the AI model engine and authentication method.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PROVIDER_METAS.map((p) => {
                    const isSelected = selectedProvider === p.id;
                    const Icon = p.icon;
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleProviderSelect(p.id)}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-start space-x-3 select-none ${
                          isSelected
                            ? "bg-surface border-foreground/30 shadow-xs ring-1 ring-foreground/20"
                            : "bg-surface border-border-subtle hover:border-border hover:bg-surface-hover"
                        }`}
                      >
                        <div
                          className={`size-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground-muted"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-foreground tracking-tight">
                              {p.name}
                            </span>
                            {p.badge && (
                              <span className="text-2xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                                {p.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-2xs text-foreground-muted truncate mt-0.5">
                            {p.tagline}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="size-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 mt-1">
                            <Check className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Provider Authentication Details */}
              <SettingSection title="Authentication & Key Config">
                {selectedProvider === "gemini" && (
                  <SettingRow
                    label="Gemini API Key"
                    description="Optional BYOK. Stored locally in your browser to override the server key."
                  >
                    <div className="w-full sm:w-72">
                      <Input
                        type={showGeminiKey ? "text" : "password"}
                        value={geminiApiKey}
                        onChange={(e) => setGeminiApiKey(e.target.value)}
                        placeholder="AIzaSy... (uses server key if blank)"
                        className="font-mono text-2xs"
                        endIcon={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setShowGeminiKey((prev) => !prev)}
                            className="size-6 p-0 text-foreground-muted hover:text-foreground"
                          >
                            {showGeminiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </Button>
                        }
                      />
                    </div>
                  </SettingRow>
                )}

                {selectedProvider === "openai" && (
                  <SettingRow
                    label="OpenAI API Key"
                    description="Required for OpenAI models. Stored strictly in local browser storage."
                  >
                    <div className="w-full sm:w-72">
                      <Input
                        type={showOpenAiKey ? "text" : "password"}
                        value={openaiApiKey}
                        onChange={(e) => setOpenaiApiKey(e.target.value)}
                        placeholder="sk-proj-..."
                        className="font-mono text-2xs"
                        endIcon={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setShowOpenAiKey((prev) => !prev)}
                            className="size-6 p-0 text-foreground-muted hover:text-foreground"
                          >
                            {showOpenAiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </Button>
                        }
                      />
                    </div>
                  </SettingRow>
                )}

                {selectedProvider === "anthropic" && (
                  <SettingRow
                    label="Anthropic API Key"
                    description="Required for Claude models. Stored strictly in local browser storage."
                  >
                    <div className="w-full sm:w-72">
                      <Input
                        type={showAnthropicKey ? "text" : "password"}
                        value={anthropicApiKey}
                        onChange={(e) => setAnthropicApiKey(e.target.value)}
                        placeholder="sk-ant-api03-..."
                        className="font-mono text-2xs"
                        endIcon={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setShowAnthropicKey((prev) => !prev)}
                            className="size-6 p-0 text-foreground-muted hover:text-foreground"
                          >
                            {showAnthropicKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </Button>
                        }
                      />
                    </div>
                  </SettingRow>
                )}

                {selectedProvider === "deepseek" && (
                  <SettingRow
                    label="DeepSeek API Key"
                    description="Required for DeepSeek R1 & V3 models. Stored locally."
                  >
                    <div className="w-full sm:w-72">
                      <Input
                        type={showDeepseekKey ? "text" : "password"}
                        value={deepseekApiKey}
                        onChange={(e) => setDeepseekApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="font-mono text-2xs"
                        endIcon={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setShowDeepseekKey((prev) => !prev)}
                            className="size-6 p-0 text-foreground-muted hover:text-foreground"
                          >
                            {showDeepseekKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </Button>
                        }
                      />
                    </div>
                  </SettingRow>
                )}

                {selectedProvider === "ollama" && (
                  <SettingRow
                    label="Ollama Server URL"
                    description="Local or remote Ollama HTTP endpoint. No cloud key required."
                  >
                    <div className="w-full sm:w-72">
                      <Input
                        type="text"
                        value={ollamaBaseUrl}
                        onChange={(e) => setOllamaBaseUrl(e.target.value)}
                        placeholder="http://localhost:11434/v1"
                        className="font-mono text-2xs"
                      />
                    </div>
                  </SettingRow>
                )}

                {selectedProvider === "mock" && (
                  <SettingRow
                    label="Mock Engine Status"
                    description="Simulated zero-latency streaming mode."
                  >
                    <span className="text-xs text-foreground-muted italic">
                      Zero credentials or network access required.
                    </span>
                  </SettingRow>
                )}
              </SettingSection>

              {/* Inference Parameters */}
              <SettingSection title="Inference & Model Parameters">
                <SettingRow
                  label="Active Model"
                  description="Selected foundation model for inference."
                  align="top"
                >
                  <div className="space-y-2 w-full sm:w-80">
                    <div className="flex flex-wrap gap-1.5">
                      {MODELS_BY_PROVIDER[selectedProvider].map((m) => {
                        const isSelected = selectedModel === m.id;
                        return (
                          <Button
                            key={m.id}
                            type="button"
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedModel(m.id)}
                            className={cn(
                              "h-7 px-2.5 text-xs font-medium rounded-lg",
                              isSelected
                                ? "font-semibold shadow-2xs"
                                : "text-foreground hover:bg-surface-hover"
                            )}
                          >
                            {m.name}
                          </Button>
                        );
                      })}
                    </div>
                    {selectedProvider === "ollama" && (
                      <div className="pt-1">
                        <Input
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                          placeholder="Custom tag (e.g. deepseek-r1:14b)"
                          className="font-mono text-2xs"
                        />
                      </div>
                    )}
                  </div>
                </SettingRow>

                <SettingRow
                  label="Temperature"
                  description="Randomness: 0.0 (Strict / Code) ↔ 1.0 (Creative)."
                >
                  <div className="flex items-center space-x-3 w-48">
                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.05"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="w-full h-1 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <span className="font-mono text-xs font-semibold text-foreground w-8 text-right">
                      {temperature.toFixed(2)}
                    </span>
                  </div>
                </SettingRow>

                <SettingRow
                  label="System Instructions"
                  description="Custom system prompt injected into the AI context."
                  align="top"
                >
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="e.g. You are a senior software architect. Provide direct and focused explanations..."
                    rows={3}
                    className="w-full sm:w-80 p-2.5 rounded-xl border border-border text-xs text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-surface resize-none leading-relaxed transition-colors shadow-2xs"
                  />
                </SettingRow>
              </SettingSection>
            </div>
          )}

          {/* 2. WORKSPACES TAB */}
          {activeTab === "workspaces" && (
            <div className="space-y-5">
              <SettingSection title="Workspace & Storage Vault">
                <SettingRow
                  label="Current Workspace"
                  description={currentWorkspace?.description || "Primary workspace vault for conversation trees."}
                >
                  <span className="font-semibold text-xs text-foreground bg-muted px-2.5 py-1 rounded-md border border-border-subtle">
                    {currentWorkspace?.name || "Main Workspace"}
                  </span>
                </SettingRow>
                <SettingRow
                  label="Database Persistence"
                  description="Conversations and branch nodes are saved to PostgreSQL."
                >
                  <span className="text-2xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Connected
                  </span>
                </SettingRow>
              </SettingSection>
            </div>
          )}

          {/* 3. GENERAL TAB */}
          {activeTab === "general" && (
            <div className="space-y-5">
              <SettingSection title="Streaming & Execution">
                <SettingRow
                  label="Stream Token Speed"
                  badge="Roadmap"
                  description="Controls token pacing during live streaming."
                  disabled
                >
                  <SegmentedTabs
                    items={[
                      { id: "fast", label: "Instant" },
                      { id: "natural", label: "Natural" },
                    ]}
                    value={streamSpeed}
                    onChange={(val) => setStreamSpeed(val as "fast" | "natural")}
                    size="sm"
                  />
                </SettingRow>

                <SettingRow
                  label="Auto-scroll to Bottom"
                  badge="Roadmap"
                  description="Automatically follow streaming chat output."
                  disabled
                >
                  <Switch checked={autoScroll} onCheckedChange={setAutoScroll} disabled />
                </SettingRow>

                <SettingRow
                  label="KaTeX LaTeX Math Rendering"
                  badge="Roadmap"
                  description="Render mathematical equations and formula expressions."
                  disabled
                >
                  <Switch checked={enableLatex} onCheckedChange={setEnableLatex} disabled />
                </SettingRow>
              </SettingSection>
            </div>
          )}

          {/* 4. APPEARANCE TAB */}
          {activeTab === "appearance" && (
            <div className="space-y-5">
              <SettingSection title="Theme & Display">
                <SettingRow
                  label="Interface Appearance"
                  badge="Roadmap"
                  description="Select application color scheme."
                  disabled
                >
                  <SegmentedTabs
                    items={[
                      { id: "light", label: "Light" },
                      { id: "dark", label: "Dark" },
                    ]}
                    value="light"
                    onChange={() => {}}
                    size="sm"
                  />
                </SettingRow>

                <SettingRow
                  label="Compact Message Density"
                  badge="Roadmap"
                  description="Reduce vertical padding in chat stream."
                  disabled
                >
                  <Switch checked={compactDensity} onCheckedChange={setCompactDensity} disabled />
                </SettingRow>
              </SettingSection>
            </div>
          )}

          {/* 5. KEYBOARD SHORTCUTS TAB */}
          {activeTab === "shortcuts" && (
            <div className="space-y-5">
              <SettingSection title="Global Hotkeys">
                <SettingRow label="Command Palette" description="Search chats, branches, and execute commands">
                  <kbd className="px-2 py-1 bg-muted border border-border rounded-md text-xs font-mono text-foreground">⌘K</kbd>
                </SettingRow>
                <SettingRow label="Toggle Left Sidebar" description="Collapse or expand the sidebar rail">
                  <kbd className="px-2 py-1 bg-muted border border-border rounded-md text-xs font-mono text-foreground">⌘B</kbd>
                </SettingRow>
                <SettingRow label="Start New Chat" description="Open fresh thread in current workspace">
                  <kbd className="px-2 py-1 bg-muted border border-border rounded-md text-xs font-mono text-foreground">⌘N</kbd>
                </SettingRow>
                <SettingRow label="Open Settings" description="Configure models and preferences">
                  <kbd className="px-2 py-1 bg-muted border border-border rounded-md text-xs font-mono text-foreground">⌘,</kbd>
                </SettingRow>
                <SettingRow label="Send Message" description="Submit prompt in active chat branch">
                  <kbd className="px-2 py-1 bg-muted border border-border rounded-md text-xs font-mono text-foreground">Enter</kbd>
                </SettingRow>
                <SettingRow label="New Line" description="Insert linebreak without sending message">
                  <kbd className="px-2 py-1 bg-muted border border-border rounded-md text-xs font-mono text-foreground">Shift + Enter</kbd>
                </SettingRow>
                <SettingRow label="Dismiss Modal / Drawer" description="Close active overlay dialog">
                  <kbd className="px-2 py-1 bg-muted border border-border rounded-md text-xs font-mono text-foreground">Esc</kbd>
                </SettingRow>
              </SettingSection>
            </div>
          )}

          {/* 6. ABOUT TAB */}
          {activeTab === "about" && (
            <div className="space-y-5">
              <SettingSection title="GraphMind Architecture">
                <SettingRow label="Version" description="GraphMind Spatial AI Platform">
                  <span className="font-mono text-xs text-foreground bg-muted px-2 py-0.5 rounded border border-border-subtle">
                    v0.1.0-beta
                  </span>
                </SettingRow>
                <SettingRow label="Framework" description="Next.js 15 App Router · Tailwind CSS · FastAPI">
                  <span className="text-xs text-foreground-muted">Phase 2 Branching</span>
                </SettingRow>
              </SettingSection>
            </div>
          )}
        </div>

        {/* Modal Footer Actions: Standardized */}
        <div className="h-13 px-6 bg-background-secondary/60 border-t border-border-subtle flex items-center justify-between shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center space-x-1.5 text-xs text-foreground-muted hover:text-foreground"
            title="Reset to default settings"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            <span>Reset to defaults</span>
          </Button>

          <div className="flex items-center space-x-2">
            {errorMessage && (
              <span className="text-xs text-destructive font-medium mr-2" role="alert">
                {errorMessage}
              </span>
            )}
            {hasUnsavedChanges && saveState === "idle" && !errorMessage && (
              <Badge variant="outline" className="text-2xs font-mono text-foreground-muted">
                Unsaved changes
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saveState === "saving"}
            >
              {saveState === "saving" ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  <span>Saving...</span>
                </>
              ) : saveState === "saved" ? (
                <>
                  <Check className="w-3.5 h-3.5 text-success mr-1.5" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save changes</span>
              )}
            </Button>
          </div>
        </div>
      </main>
    </Modal>

    {/* Destructive Confirm Dialog for Settings Reset */}
    <ConfirmDialog
      isOpen={showResetConfirm}
      onClose={() => setShowResetConfirm(false)}
      onConfirm={() => {
        handleReset();
        setShowResetConfirm(false);
      }}
      title="Reset settings to defaults"
      description="Are you sure you want to reset all model settings and preferences? Custom API keys and endpoints will be removed."
      confirmText="Reset Defaults"
      variant="destructive"
    />
    </>
  );
}
