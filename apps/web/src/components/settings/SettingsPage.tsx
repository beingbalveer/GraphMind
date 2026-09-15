"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Eye, EyeOff, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import type { LLMConfig, LLMProvider } from "@/hooks/useModelConfig";
import type { WorkspaceItem } from "@/lib/workspaceApi";

export interface SettingsPageProps {
  config: LLMConfig;
  onSaveConfig: (updates: Partial<LLMConfig>) => void;
  onResetDefaults: () => void;
  currentWorkspace?: WorkspaceItem | null;
  onNavigateBack: () => void;
}

const models: Record<LLMProvider, string[]> = {
  gemini: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
  openai: ["gpt-4o", "gpt-4o-mini", "o3-mini"],
  anthropic: ["claude-3-7-sonnet", "claude-3-5-sonnet", "claude-3-5-haiku"],
  deepseek: ["deepseek-reasoner", "deepseek-chat"],
  ollama: ["deepseek-r1", "llama3.3", "qwen2.5-coder", "mistral"],
  mock: ["mock-stream"],
};

const providerLabels: Record<LLMProvider, string> = {
  gemini: "Google Gemini", openai: "OpenAI", anthropic: "Anthropic Claude",
  deepseek: "DeepSeek", ollama: "Ollama", mock: "Mock Engine",
};

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="space-y-1"><h2 className="text-sm font-medium text-foreground">{title}</h2><p className="text-sm text-foreground-muted">{description}</p><div className="mt-4 border-y border-border">{children}</div></section>;
}

function Row({ label, description, children, disabled = false }: { label: string; description: string; children: React.ReactNode; disabled?: boolean }) {
  return <div className={"flex flex-col gap-3 border-b border-border px-0 py-4 last:border-b-0 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6 " + (disabled ? "opacity-50" : "")}><div className="min-w-0"><p className="text-sm font-medium text-foreground">{label}</p><p className="mt-1 text-sm text-foreground-muted">{description}</p></div><div className="min-w-0 shrink-0">{children}</div></div>;
}

export function SettingsPage({ config, onSaveConfig, onResetDefaults, currentWorkspace, onNavigateBack }: SettingsPageProps) {
  const [provider, setProvider] = useState<LLMProvider>(config.provider);
  const [model, setModel] = useState(config.model);
  const [temperature, setTemperature] = useState(config.temperature);
  const [maxTokens, setMaxTokens] = useState(config.maxTokens);
  const [systemPrompt, setSystemPrompt] = useState(config.systemPrompt);
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState(config.ollamaBaseUrl);
  const [keys, setKeys] = useState({ gemini: config.geminiApiKey, openai: config.openaiApiKey, anthropic: config.anthropicApiKey, deepseek: config.deepseekApiKey });
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => { setProvider(config.provider); setModel(config.model); setTemperature(config.temperature); setMaxTokens(config.maxTokens); setSystemPrompt(config.systemPrompt); setOllamaBaseUrl(config.ollamaBaseUrl); setKeys({ gemini: config.geminiApiKey, openai: config.openaiApiKey, anthropic: config.anthropicApiKey, deepseek: config.deepseekApiKey }); }, [config]);
  const hasChanges = useMemo(() => provider !== config.provider || model !== config.model || temperature !== config.temperature || maxTokens !== config.maxTokens || systemPrompt !== config.systemPrompt || ollamaBaseUrl !== config.ollamaBaseUrl || keys.gemini !== config.geminiApiKey || keys.openai !== config.openaiApiKey || keys.anthropic !== config.anthropicApiKey || keys.deepseek !== config.deepseekApiKey, [provider, model, temperature, maxTokens, systemPrompt, ollamaBaseUrl, keys, config]);

  const selectProvider = (next: LLMProvider) => { setProvider(next); setModel(models[next][0]); };
  const save = () => {
    setError(null);
    if (provider === "ollama") { try { new URL(ollamaBaseUrl); } catch { setError("Invalid Ollama Server URL. Please enter a valid http:// or https:// URL."); return; } }
    onSaveConfig({ provider, model, temperature, maxTokens, systemPrompt, ollamaBaseUrl: ollamaBaseUrl.trim(), geminiApiKey: keys.gemini.trim(), openaiApiKey: keys.openai.trim(), anthropicApiKey: keys.anthropic.trim(), deepseekApiKey: keys.deepseek.trim() });
  };
  const currentKey = provider === "gemini" || provider === "openai" || provider === "anthropic" || provider === "deepseek" ? provider : null;

  return <main className="flex min-h-0 flex-1 flex-col bg-background" aria-label="Settings">
    <Tabs defaultValue="models" orientation="vertical" className="min-h-0 flex-1 p-6 sm:flex-row">
      <TabsList variant="line" className="w-full shrink-0 sm:w-44">
        <TabsTrigger value="models">Models</TabsTrigger><TabsTrigger value="workspaces">Workspaces</TabsTrigger><TabsTrigger value="general">General</TabsTrigger><TabsTrigger value="appearance">Appearance</TabsTrigger><TabsTrigger value="shortcuts">Shortcuts</TabsTrigger><TabsTrigger value="about">About</TabsTrigger>
      </TabsList>
      <div className="min-w-0 flex-1 overflow-y-auto sm:ps-8">
        <TabsContent value="models"><div className="max-w-2xl space-y-8"><Section title="Models" description="Choose the provider and model used for new responses."><Row label="Provider" description="The model service used by GraphMind."><Select value={provider} onValueChange={(value) => selectProvider(value as LLMProvider)}><SelectTrigger aria-label="Provider"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(providerLabels).map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent></Select></Row><Row label="Model" description="The model identifier sent to the selected provider."><Select value={model} onValueChange={(value) => setModel(value as string)}><SelectTrigger aria-label="Model"><SelectValue /></SelectTrigger><SelectContent>{models[provider].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Row>{currentKey && <Row label={providerLabels[currentKey] + " API Key"} description="Stored locally in this browser."><div className="flex gap-2"><Input className="w-72" aria-label={providerLabels[currentKey] + " API Key"} type={showKey ? "text" : "password"} value={keys[currentKey]} onChange={(event) => setKeys({ ...keys, [currentKey]: event.target.value })} /><Button size="icon-sm" variant="ghost" aria-label="Toggle API key visibility" onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff /> : <Eye />}</Button></div></Row>}{provider === "ollama" && <Row label="Ollama Server URL" description="The local OpenAI-compatible Ollama endpoint."><Input className="w-72" aria-label="Ollama Server URL" value={ollamaBaseUrl} onChange={(event) => setOllamaBaseUrl(event.target.value)} /></Row>}<Row label="Temperature" description="Controls the balance between consistency and variation."><Input className="w-24" aria-label="Temperature" type="number" min="0" max="2" step="0.1" value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} /></Row><Row label="Maximum tokens" description="The response length limit requested from the provider."><Input className="w-28" aria-label="Maximum tokens" type="number" min="1" step="1" value={maxTokens} onChange={(event) => setMaxTokens(Number(event.target.value))} /></Row><Row label="System instructions" description="Additional guidance applied to every response."><Textarea aria-label="System instructions" value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} className="min-h-24 w-80" /></Row></Section></div></TabsContent>
        <TabsContent value="workspaces"><Section title="Workspace" description="Storage and current workspace details."><Row label="Current workspace" description={currentWorkspace?.description ?? "Primary workspace for conversation trees."}><span className="text-sm font-medium">{currentWorkspace?.name ?? "Main Workspace"}</span></Row><Row label="Persistence" description="Conversations and nodes are stored in PostgreSQL."><Badge variant="secondary">Connected</Badge></Row></Section></TabsContent>
        <TabsContent value="general"><Section title="General" description="Preferences that are planned for a future release."><Row label="Auto-scroll" description="Follow streamed responses." disabled><Switch checked onCheckedChange={() => {}} disabled /></Row><Row label="Math rendering" description="Render LaTeX equations." disabled><Switch checked onCheckedChange={() => {}} disabled /></Row></Section></TabsContent>
        <TabsContent value="appearance"><Section title="Appearance" description="Display preferences follow the system theme."><Row label="Compact density" description="Reduce message spacing." disabled><Switch checked={false} onCheckedChange={() => {}} disabled /></Row></Section></TabsContent>
        <TabsContent value="shortcuts"><Section title="Keyboard shortcuts" description="Commands available across the workspace."><Row label="Open settings" description="Open this page."><kbd className="rounded-md border border-border bg-muted px-2 py-1 text-xs">⌘,</kbd></Row><Row label="Command palette" description="Search commands and conversations."><kbd className="rounded-md border border-border bg-muted px-2 py-1 text-xs">⌘K</kbd></Row></Section></TabsContent>
        <TabsContent value="about"><Section title="About GraphMind" description="Application information."><Row label="Version" description="Graph-first workspace for structured AI conversations."><span className="font-mono text-sm">v0.1.0</span></Row></Section></TabsContent>
      </div>
    </Tabs>
    <footer className="flex items-center justify-between border-t border-border px-6 py-3"><Button variant="ghost" onClick={() => setResetOpen(true)}><RotateCcw />Reset to defaults</Button><div className="flex items-center gap-2">{error && <span role="alert" className="text-sm text-destructive">{error}</span>}{hasChanges && <span className="text-sm text-foreground-muted">Unsaved changes</span>}<Button variant="outline" onClick={onNavigateBack}>Cancel</Button><Button onClick={save}><Check />Save changes</Button></div></footer>
    <ConfirmDialog isOpen={resetOpen} onClose={() => setResetOpen(false)} onConfirm={() => { onResetDefaults(); setResetOpen(false); }} title="Reset settings to defaults" description="Your model preferences will be restored." confirmText="Reset defaults" variant="destructive" />
  </main>;
}
