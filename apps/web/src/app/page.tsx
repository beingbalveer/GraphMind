import React from "react";
import { GitFork, Network, Cpu, Shield, Layers, FileText, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-[#fcfcfc] text-slate-900">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            🧠
          </div>
          <div>
            <span className="font-bold text-slate-900 tracking-tight text-lg">GraphMind</span>
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-medium">
              v0.1.0 (M0)
            </span>
          </div>
        </div>
        <nav className="flex items-center space-x-6 text-sm font-medium text-slate-600">
          <a href="#features" className="hover:text-slate-900 transition-colors">Philosophy</a>
          <a href="#milestones" className="hover:text-slate-900 transition-colors">Milestones</a>
          <a href="#docs" className="hover:text-slate-900 transition-colors">Documentation</a>
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-1.5 rounded-md bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-sm"
          >
            API Specs ↗
          </a>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl mx-auto px-6 pt-16 pb-24 w-full">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-medium text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Milestone 0: Repository Foundation Active</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Knowledge is the Product.<br />
            <span className="text-sky-600">Chat is Only the Interface.</span>
          </h1>

          <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            An open-source, AI-native knowledge workspace where linear conversations branch into 
            living visual knowledge maps.
          </p>

          <div className="pt-4 flex items-center justify-center space-x-4">
            <button className="px-6 py-3 rounded-lg bg-sky-600 text-white font-medium text-sm hover:bg-sky-700 transition-all shadow-md flex items-center space-x-2">
              <span>Open Graph Workspace (M1)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3 rounded-lg border border-slate-300 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors"
            >
              GitHub Repository
            </a>
          </div>
        </div>

        {/* Core Pillars */}
        <div id="features" className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20">
          <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Network className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Graph-First Workspace</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Every prompt and response creates an interactive node. Zoom, pan, and structure your understanding visually.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <GitFork className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Highlight-to-Branch</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Highlight any sentence in a node to spawn a child branch without disrupting parent context or main line of thought.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">AI-Provider Agnostic</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Built on an internal provider-agnostic abstraction (<code className="text-xs bg-slate-100 px-1 py-0.5 rounded">packages/ai-core</code>) supporting OpenAI, Anthropic, and local models.
            </p>
          </div>
        </div>

        {/* Milestone Tracker */}
        <div id="milestones" className="mt-16 p-8 rounded-2xl bg-slate-900 text-white shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Layers className="w-6 h-6 text-sky-400" />
              <h2 className="text-xl font-bold tracking-tight">Milestone Execution Strategy</h2>
            </div>
            <span className="text-xs px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 font-medium">
              80% Shipping / 20% Planning
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-slate-800/80 border border-emerald-500/40 space-y-1">
              <div className="flex justify-between text-xs font-semibold text-emerald-400">
                <span>M0: Foundation</span>
                <span>Active</span>
              </div>
              <p className="text-xs text-slate-300">Monorepo, FastAPI backend, Next.js, Docker setup.</p>
            </div>

            <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700 space-y-1 opacity-75">
              <div className="flex justify-between text-xs font-semibold text-slate-400">
                <span>M1: UI Shell</span>
                <span>Next</span>
              </div>
              <p className="text-xs text-slate-400">React Flow canvas scaffold & Zustand store.</p>
            </div>

            <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700 space-y-1 opacity-75">
              <div className="flex justify-between text-xs font-semibold text-slate-400">
                <span>M2: AI Streaming</span>
                <span>Upcoming</span>
              </div>
              <p className="text-xs text-slate-400">AI Core provider streaming via FastAPI SSE.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 px-6 text-center text-xs text-slate-500">
        GraphMind Open Source Project • Licensed under Apache License 2.0
      </footer>
    </div>
  );
}
