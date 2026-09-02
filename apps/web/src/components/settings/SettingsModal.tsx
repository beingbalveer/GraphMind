"use client";

import React, { useState, useEffect } from "react";
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
  Bot,
  Laptop,
  Cpu,
  Zap,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SegmentedTabs, SegmentedTabItem } from "@/components/ui/segmented-tabs";
import { SettingRow, SettingSection } from "@/components/ui/setting-row";
import { LLMConfig, LLMProvider, DEFAULT_LLM_CONFIG } from "@/hooks/useModelConfig";
import { WorkspaceItem } from "@/lib/workspaceApi";

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

const PROVIDER_OPTIONS: SegmentedTabItem<LLMProvider>[] = [
  { id: "gemini", label: "Gemini", icon: Sparkles },
  { id: "openai", label: "OpenAI", icon: Bot },
  { id: "anthropic", label: "Anthropic", icon: Cpu },
  { id: "deepseek", label: "DeepSeek", icon: Zap },
  { id: "ollama", label: "Ollama", icon: Server },
  { id: "mock", label: "Mock Mode", icon: Laptop },
];

const MODELS_BY_PROVIDER: Record<LLMProvider, Array<{ id: string; name: string }>> = {
  gemini: [
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
  ],
  openai: [
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini" },
    { id: "o3-mini", name: "o3-mini" },
  ],
  anthropic: [
    { id: "claude-3-7-sonnet", name: "Claude 3.7 Sonnet" },
    { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet" },
    { id: "claude-3-5-haiku", name: "Claude 3.5 Haiku" },
  ],
  deepseek: [
    { id: "deepseek-reasoner", name: "DeepSeek R1" },
    { id: "deepseek-chat", name: "DeepSeek V3" },
  ],
  ollama: [
    { id: "deepseek-r1", name: "DeepSeek R1 (Local)" },
    { id: "llama3.3", name: "Llama 3.3" },
    { id: "qwen2.5-coder", name: "Qwen 2.5 Coder" },
    { id: "mistral", name: "Mistral" },
  ],
  mock: [{ id: "mock-stream", name: "Mock Stream Engine" }],
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

  const [savedFeedback, setSavedFeedback] = useState(false);

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

  const handleProviderSelect = (providerId: LLMProvider) => {
    setSelectedProvider(providerId);
    const available = MODELS_BY_PROVIDER[providerId];
    if (available && available.length > 0) {
      setSelectedModel(available[0].id);
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
      anthropicApiKey: anthropicApiKey.trim(),
      deepseekApiKey: deepseekApiKey.trim(),
      ollamaBaseUrl: ollamaBaseUrl.trim() || "http://localhost:11434/v1",
    });
    setSavedFeedback(true);
    setTimeout(() => {
      setSavedFeedback(false);
      onClose();
    }, 350);
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
      title: "Settings",
      items: [
        { id: "models", label: "Models & AI", icon: Sparkles },
        { id: "general", label: "General", icon: Sliders, badge: "Roadmap" },
        { id: "appearance", label: "Appearance", icon: Palette, badge: "Roadmap" },
        { id: "workspaces", label: "Workspaces", icon: FolderGit2 },
      ],
    },
    {
      title: "Shortcuts & Info",
      items: [
        { id: "shortcuts", label: "Keyboard Shortcuts", icon: Keyboard },
        { id: "about", label: "About GraphMind", icon: Info },
      ],
    },
  ];


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-zinc-950/30 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl h-[600px] bg-white rounded-2xl border border-zinc-200/90 shadow-2xl overflow-hidden flex flex-col sm:flex-row animate-in zoom-in-95 duration-150">
        {/* Left Sidebar Navigation */}
        <aside className="w-full sm:w-56 bg-zinc-50/80 border-r border-zinc-200/70 flex flex-col shrink-0 p-3 select-none">
          <div className="px-3 py-2.5 mb-1">
            <h2 className="text-xs font-semibold text-zinc-900 tracking-tight">
              Settings
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {navSections.map((sec) => (
              <div key={sec.title} className="space-y-1">
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-3">
                  {sec.title}
                </span>
                <div className="space-y-0.5 mt-1">
                  {sec.items.map((item) => {
                    const isSelected = activeTab === item.id;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all text-left cursor-pointer ${
                          isSelected
                            ? "bg-zinc-200/70 text-zinc-950 font-semibold"
                            : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <Icon
                            className={`w-4 h-4 shrink-0 ${
                              isSelected ? "text-zinc-900" : "text-zinc-500"
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </div>
                        {item.badge && (
                          <span className="text-[9.5px] font-medium text-amber-700 bg-amber-50 border border-amber-200/60 px-1.5 py-0.2 rounded-md shrink-0">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>


          {/* Footer User / Version Badge */}
          <div className="pt-2 border-t border-zinc-200/60 px-3 py-1 flex items-center justify-between text-[11px] text-zinc-400">
            <span>GraphMind v0.1.0</span>
            <span className="font-mono">Web</span>
          </div>
        </aside>

        {/* Right Detail Content Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-white">
          {/* Content Header with Close Button */}
          <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0">
            <div>
              <h1 className="text-base font-semibold text-zinc-950 tracking-tight">
                {activeTab === "models" && "Models & AI"}
                {activeTab === "general" && "General Settings"}
                {activeTab === "appearance" && "Appearance & UI"}
                {activeTab === "workspaces" && "Workspaces"}
                {activeTab === "shortcuts" && "Keyboard Shortcuts"}
                {activeTab === "about" && "About GraphMind"}
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                {activeTab === "models" && "Configure LLM providers, BYOK API keys, and generation parameters."}
                {activeTab === "general" && "Configure agent execution, streaming delivery, and behavior."}
                {activeTab === "appearance" && "Customize themes, font sizes, and layout density."}
                {activeTab === "workspaces" && "Manage connected workspaces and storage engines."}
                {activeTab === "shortcuts" && "Quick reference for power-user shortcuts."}
                {activeTab === "about" && "GraphMind spatial reasoning and hierarchical AI workspace."}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content Scrollable Body */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-zinc-800">
            {/* 1. MODELS TAB */}
            {activeTab === "models" && (
              <div className="space-y-5">
                <SettingSection title="AI Provider & Authentication">
                  <SettingRow
                    label="Provider"
                    description="Select which AI ecosystem powers inference."
                  >
                    <SegmentedTabs
                      items={PROVIDER_OPTIONS}
                      value={selectedProvider}
                      onChange={handleProviderSelect}
                      size="sm"
                    />
                  </SettingRow>

                  {selectedProvider === "gemini" && (
                    <SettingRow
                      label="Gemini API Key"
                      description="Optional. Stored locally in your browser to override server key."
                    >
                      <Input
                        type={showGeminiKey ? "text" : "password"}
                        value={geminiApiKey}
                        onChange={(e) => setGeminiApiKey(e.target.value)}
                        placeholder="AIzaSy... (uses server key by default)"
                        className="font-mono text-[11px]"
                        endIcon={
                          <button
                            type="button"
                            onClick={() => setShowGeminiKey((prev) => !prev)}
                            className="p-1 hover:text-zinc-700 cursor-pointer"
                          >
                            {showGeminiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        }
                      />
                    </SettingRow>
                  )}

                  {selectedProvider === "openai" && (
                    <SettingRow
                      label="OpenAI API Key"
                      description="Required for OpenAI models. Stored locally in your browser."
                    >
                      <Input
                        type={showOpenAiKey ? "text" : "password"}
                        value={openaiApiKey}
                        onChange={(e) => setOpenaiApiKey(e.target.value)}
                        placeholder="sk-proj-..."
                        className="font-mono text-[11px]"
                        endIcon={
                          <button
                            type="button"
                            onClick={() => setShowOpenAiKey((prev) => !prev)}
                            className="p-1 hover:text-zinc-700 cursor-pointer"
                          >
                            {showOpenAiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        }
                      />
                    </SettingRow>
                  )}

                  {selectedProvider === "anthropic" && (
                    <SettingRow
                      label="Anthropic API Key"
                      description="Required for Claude 3.7 / 3.5 Sonnet. Stored locally in your browser."
                    >
                      <Input
                        type={showAnthropicKey ? "text" : "password"}
                        value={anthropicApiKey}
                        onChange={(e) => setAnthropicApiKey(e.target.value)}
                        placeholder="sk-ant-api03-..."
                        className="font-mono text-[11px]"
                        endIcon={
                          <button
                            type="button"
                            onClick={() => setShowAnthropicKey((prev) => !prev)}
                            className="p-1 hover:text-zinc-700 cursor-pointer"
                          >
                            {showAnthropicKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        }
                      />
                    </SettingRow>
                  )}

                  {selectedProvider === "deepseek" && (
                    <SettingRow
                      label="DeepSeek API Key"
                      description="Required for DeepSeek R1 & V3. Stored locally in your browser."
                    >
                      <Input
                        type={showDeepseekKey ? "text" : "password"}
                        value={deepseekApiKey}
                        onChange={(e) => setDeepseekApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="font-mono text-[11px]"
                        endIcon={
                          <button
                            type="button"
                            onClick={() => setShowDeepseekKey((prev) => !prev)}
                            className="p-1 hover:text-zinc-700 cursor-pointer"
                          >
                            {showDeepseekKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        }
                      />
                    </SettingRow>
                  )}

                  {selectedProvider === "ollama" && (
                    <SettingRow
                      label="Ollama Server URL"
                      description="Local or remote Ollama HTTP endpoint. No cloud key needed."
                    >
                      <Input
                        type="text"
                        value={ollamaBaseUrl}
                        onChange={(e) => setOllamaBaseUrl(e.target.value)}
                        placeholder="http://localhost:11434/v1"
                        className="font-mono text-[11px]"
                      />
                    </SettingRow>
                  )}
                </SettingSection>

                <SettingSection title="Inference & Model Parameters">
                  <SettingRow
                    label="Active Model"
                    description={`Foundation model for ${selectedProvider.toUpperCase()}`}
                    align="top"
                  >
                    <div className="space-y-2 w-full sm:w-80">
                      <div className="flex flex-wrap gap-1.5">
                        {MODELS_BY_PROVIDER[selectedProvider].map((m) => {
                          const isSelected = selectedModel === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setSelectedModel(m.id)}
                              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                                isSelected
                                  ? "border-blue-300 bg-blue-50/50 text-blue-950 font-semibold ring-1 ring-blue-400/20"
                                  : "border-zinc-200 bg-zinc-50/50 hover:bg-zinc-100/70 text-zinc-700"
                              }`}
                            >
                              {m.name}
                            </button>
                          );
                        })}
                      </div>
                      {selectedProvider === "ollama" && (
                        <div className="pt-1">
                          <Input
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            placeholder="Or enter custom tag (e.g. deepseek-r1:14b)"
                            className="font-mono text-[11px]"
                          />
                        </div>
                      )}
                    </div>
                  </SettingRow>

                  <SettingRow
                    label="Temperature"
                    description="Controls randomness: 0.0 (Precise / Code) ↔ 1.0 (Creative)."
                  >
                    <div className="flex items-center space-x-3 w-48">
                      <input
                        type="range"
                        min="0.0"
                        max="1.0"
                        step="0.05"
                        value={temperature}
                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                        className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-800"
                      />
                      <span className="font-mono text-xs font-semibold text-zinc-800 w-8 text-right">
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
                      className="w-full sm:w-80 p-2.5 rounded-lg border border-zinc-200/90 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-zinc-50/50 resize-none leading-relaxed"
                    />
                  </SettingRow>
                </SettingSection>
              </div>
            )}

            {/* 2. GENERAL TAB */}
            {activeTab === "general" && (
              <div className="space-y-5">
                <SettingSection title="Streaming & Execution">
                  <SettingRow
                    label="Stream Token Speed"
                    badge="Coming soon"
                    description="Controls token pacing during live streaming."
                    disabled
                  >
                    <SegmentedTabs
                      items={[
                        { id: "fast", label: "Instant / Fast" },
                        { id: "natural", label: "Natural Typing" },
                      ]}
                      value={streamSpeed}
                      onChange={(val) => setStreamSpeed(val as "fast" | "natural")}
                      size="sm"
                    />
                  </SettingRow>

                  <SettingRow
                    label="Auto-scroll to Bottom"
                    badge="Coming soon"
                    description="Automatically scroll view during response generation."
                    disabled
                  >
                    <Switch checked={autoScroll} onCheckedChange={setAutoScroll} disabled />
                  </SettingRow>

                  <SettingRow
                    label="LaTeX & Math Formula Rendering"
                    badge="Coming soon"
                    description="Render KaTeX mathematical equations and symbols."
                    disabled
                  >
                    <Switch checked={enableLatex} onCheckedChange={setEnableLatex} disabled />
                  </SettingRow>
                </SettingSection>
              </div>
            )}

            {/* 3. APPEARANCE TAB */}
            {activeTab === "appearance" && (
              <div className="space-y-5">
                <SettingSection title="Theme & Display">
                  <SettingRow
                    label="Interface Theme"
                    badge="Coming soon"
                    description="Select application color appearance."
                    disabled
                  >
                    <SegmentedTabs
                      items={[
                        { id: "light", label: "Light (Default)" },
                        { id: "dark", label: "Dark" },
                      ]}
                      value="light"
                      onChange={() => {}}
                      size="sm"
                    />
                  </SettingRow>

                  <SettingRow
                    label="Compact Message Density"
                    badge="Coming soon"
                    description="Reduce padding and spacing between chat message bubbles."
                    disabled
                  >
                    <Switch checked={compactDensity} onCheckedChange={setCompactDensity} disabled />
                  </SettingRow>
                </SettingSection>
              </div>
            )}


            {/* 4. WORKSPACES TAB */}
            {activeTab === "workspaces" && (
              <div className="space-y-5">
                <SettingSection title="Active Workspace">
                  <SettingRow
                    label="Current Workspace"
                    description={currentWorkspace?.description || "Primary workspace vault for conversation trees."}
                  >
                    <span className="font-semibold text-xs text-zinc-900 bg-zinc-100 px-2.5 py-1 rounded-md">
                      {currentWorkspace?.name || "Main Workspace"}
                    </span>
                  </SettingRow>
                  <SettingRow
                    label="Database Persistence"
                    description="Conversations and branch nodes are saved in PostgreSQL."
                  >
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Connected
                    </span>
                  </SettingRow>
                </SettingSection>
              </div>
            )}

            {/* 5. KEYBOARD SHORTCUTS TAB */}
            {activeTab === "shortcuts" && (
              <div className="space-y-5">
                <SettingSection title="Keyboard Navigation">
                  <SettingRow label="Open Command Palette" description="Global search across all nodes and chats">
                    <kbd className="px-2 py-1 bg-zinc-100 border border-zinc-200 rounded text-xs font-mono text-zinc-700">⌘K</kbd>
                  </SettingRow>
                  <SettingRow label="Start New Chat" description="Clear context and begin fresh root conversation">
                    <kbd className="px-2 py-1 bg-zinc-100 border border-zinc-200 rounded text-xs font-mono text-zinc-700">⌘N</kbd>
                  </SettingRow>
                  <SettingRow label="Send Prompt" description="Submit message to active branch">
                    <kbd className="px-2 py-1 bg-zinc-100 border border-zinc-200 rounded text-xs font-mono text-zinc-700">Enter</kbd>
                  </SettingRow>
                  <SettingRow label="New Line in Chat" description="Insert newline without sending">
                    <kbd className="px-2 py-1 bg-zinc-100 border border-zinc-200 rounded text-xs font-mono text-zinc-700">Shift + Enter</kbd>
                  </SettingRow>
                  <SettingRow label="Close Modals & Drawers" description="Dismiss open dialogs and overlays">
                    <kbd className="px-2 py-1 bg-zinc-100 border border-zinc-200 rounded text-xs font-mono text-zinc-700">Esc</kbd>
                  </SettingRow>
                </SettingSection>
              </div>
            )}

            {/* 6. ABOUT TAB */}
            {activeTab === "about" && (
              <div className="space-y-5">
                <SettingSection title="About GraphMind">
                  <SettingRow label="Version" description="GraphMind Cognitive AI Architecture">
                    <span className="font-mono text-xs text-zinc-700">v0.1.0-beta</span>
                  </SettingRow>
                  <SettingRow label="Engine" description="Next.js 15 App Router · FastAPI · PostgreSQL">
                    <span className="text-xs text-zinc-600">Phase 2 Branching</span>
                  </SettingRow>
                </SettingSection>
              </div>
            )}
          </div>

          {/* Modal Footer Actions */}
          <div className="px-6 py-3.5 bg-zinc-50/70 border-t border-zinc-100 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center space-x-1.5 text-xs text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
              title="Reset to default settings"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to defaults</span>
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
                className="text-xs bg-zinc-900 text-white hover:bg-zinc-800 h-8 px-4 rounded-lg shadow-xs cursor-pointer"
              >
                {savedFeedback ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400 mr-1" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <span>Save changes</span>
                )}
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
