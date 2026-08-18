"use client";

import React, { useRef, useEffect } from "react";
import { Sparkles, Terminal, Cpu, GitBranch } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { useChatStream } from "@/hooks/useChatStream";
import { Navbar } from "../layout/Navbar";

export function ChatContainer() {
  const {
    messages,
    isStreaming,
    sendMessage,
    stopStreaming,
    clearMessages,
  } = useChatStream();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages / streaming tokens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const starterPrompts = [
    {
      title: "Explain LangGraph & State Machines",
      subtitle: "How cyclical graph workflows differ from DAGs in AI systems",
      icon: GitBranch,
      prompt: "Explain how LangGraph state machines manage cyclical multi-agent workflows and how they differ from linear DAG execution.",
    },
    {
      title: "FastAPI Dependency Injection & Async Architecture",
      subtitle: "Best practices for building high-concurrency AI APIs",
      icon: Terminal,
      prompt: "Explain the architecture of FastAPI dependency injection (`Depends`), async generators, and how to stream Server-Sent Events (SSE) efficiently.",
    },
    {
      title: "Graph-Native Knowledge Representation",
      subtitle: "Why linear conversations fail for deep technical learning",
      icon: Cpu,
      prompt: "Why is linear chat insufficient for complex knowledge exploration, and how does graph-based conversation branching improve learning retention?",
    },
  ];

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-50 overflow-hidden font-sans">
      <Navbar onClearChat={clearMessages} messageCount={messages.length} />

      {/* Main Scrollable Viewport */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        {messages.length === 0 ? (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto px-4 py-8 text-center space-y-6">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center font-bold text-2xl mx-auto shadow-md">
                🧠
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                GraphMind AI Workspace
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                Phase 1 Production Stream Engine. Every conversation built here will evolve into an explorable knowledge tree in Phase 2.
              </p>
            </div>

            {/* Quick Starter Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full text-left">
              {starterPrompts.map((item, index) => {
                const Icon = item.icon;
                return (
                  <button
                    key={index}
                    onClick={() => sendMessage(item.prompt)}
                    className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-sky-400 hover:shadow-md transition-all text-left group flex flex-col justify-between space-y-2"
                  >
                    <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center group-hover:bg-sky-600 group-hover:text-white transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 group-hover:text-sky-700">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                        {item.subtitle}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Messages Stream List */
          <div className="flex-1 w-full max-w-4xl mx-auto divide-y divide-slate-100/60 pb-8">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Floating / Bottom Input Section */}
        <div className="shrink-0 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent pt-4">
          <ChatInput
            onSendMessage={sendMessage}
            onStopStreaming={stopStreaming}
            isStreaming={isStreaming}
          />
        </div>
      </main>
    </div>
  );
}
