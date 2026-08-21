"use client";

import React, { useEffect } from "react";
import { Terminal, Cpu, GitBranch, ArrowDown } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { Toast } from "@/components/ui/toast";
import { useChatStream } from "@/hooks/useChatStream";
import { useScrollAnchor } from "@/hooks/useScrollAnchor";
import { Navbar } from "../layout/Navbar";

export function ChatContainer() {
  const {
    messages,
    isStreaming,
    error,
    activeBranch,
    setBranchContext,
    clearBranchContext,
    clearError,
    sendMessage,
    retryLastMessage,
    stopStreaming,
    clearMessages,
  } = useChatStream();

  const {
    scrollRef,
    bottomRef,
    isAtBottom,
    showScrollButton,
    scrollToBottom,
  } = useScrollAnchor({ threshold: 80 });

  // Auto-scroll when user is at the bottom
  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom(false);
    }
  }, [messages, isStreaming, isAtBottom, scrollToBottom]);

  const starterPrompts = [
    {
      title: "Explain LangGraph & State Machines",
      subtitle: "How cyclical graph workflows differ from DAGs in AI systems",
      icon: GitBranch,
      prompt: "Explain how LangGraph state machines manage cyclical multi-agent workflows and how they differ from linear DAG execution.",
    },
    {
      title: "FastAPI Dependency Injection & Async Architecture",
      subtitle: "Best practices for high-concurrency streaming APIs",
      icon: Terminal,
      prompt: "Explain the architecture of FastAPI dependency injection (`Depends`), async generators, and how to stream Server-Sent Events (SSE) efficiently.",
    },
    {
      title: "Graph-Native Knowledge Trees",
      subtitle: "Why linear chat is insufficient for deep technical learning",
      icon: Cpu,
      prompt: "Why is linear chat insufficient for complex knowledge exploration, and how does graph-based conversation branching improve learning retention?",
    },
  ];

  return (
    <div className="w-screen h-screen flex flex-col bg-white overflow-hidden font-sans selection:bg-zinc-200 selection:text-zinc-900">
      <Navbar onClearChat={clearMessages} messageCount={messages.length} />

      {/* Dedicated Scrollable Feed */}
      <main
        ref={scrollRef}
        className="flex-1 overflow-y-auto min-h-0 flex flex-col bg-white"
      >
        {messages.length === 0 ? (
          /* Clean Empty State */
          <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto px-4 py-8 text-center space-y-8 my-auto">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center font-bold text-lg mx-auto shadow-xs">
                🧠
              </div>
              <h2 className="text-xl font-semibold text-zinc-900 tracking-tight">
                Where knowledge connects
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 max-w-sm mx-auto leading-relaxed">
                Ask a technical question, explore system architecture, or test streaming.
              </p>
            </div>

            {/* Quick Starter Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full text-left">
              {starterPrompts.map((item, index) => {
                const Icon = item.icon;
                return (
                  <button
                    key={index}
                    onClick={() => {
                      sendMessage(item.prompt);
                      scrollToBottom(true);
                    }}
                    className="p-3.5 rounded-xl border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/70 transition-all text-left group flex flex-col justify-between space-y-2 cursor-pointer"
                  >
                    <Icon className="w-4 h-4 text-zinc-400 group-hover:text-zinc-700 transition-colors" />
                    <div>
                      <div className="text-xs font-semibold text-zinc-800">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">
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
          <div className="w-full pb-4">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onRetry={retryLastMessage}
                onExploreBranch={(id, text) => {
                  setBranchContext(id, text);
                  scrollToBottom(true);
                }}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </main>

      {/* Permanently Static Bottom Input Bar with Floating Jump Button */}
      <div className="relative shrink-0 bg-gradient-to-t from-white via-white to-transparent pt-2 z-20">
        {showScrollButton && messages.length > 0 && (
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            className="absolute -top-9 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white border border-zinc-200 shadow-md text-zinc-700 hover:text-zinc-950 hover:border-zinc-300 text-xs font-medium flex items-center space-x-1.5 transition-all animate-in fade-in-50 slide-in-from-bottom-2 duration-150 cursor-pointer select-none"
            title="Scroll to bottom"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            <span>Latest messages</span>
          </button>
        )}

        <ChatInput
          onSendMessage={(prompt, provider, model) => {
            sendMessage(prompt, provider, model);
            scrollToBottom(true);
          }}
          onStopStreaming={stopStreaming}
          isStreaming={isStreaming}
          activeBranch={activeBranch}
          onClearBranch={clearBranchContext}
        />
      </div>

      {/* Non-intrusive Floating Toast Notification */}
      <Toast message={error} onDismiss={clearError} />
    </div>
  );
}
