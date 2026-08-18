"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { User, Sparkles, Copy, Check } from "lucide-react";
import { Message } from "@/hooks/useChatStream";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!message.content) return;
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`py-4 px-4 sm:px-6 flex gap-3 sm:gap-4 transition-colors ${
        isUser ? "bg-white" : "bg-slate-50/60 border-y border-slate-100"
      }`}
    >
      {/* Role Avatar */}
      <div className="shrink-0 pt-0.5">
        {isUser ? (
          <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shadow-xs">
            <User className="w-4 h-4" />
          </div>
        ) : (
          <div className="w-7 h-7 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Message Content Container */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-900">
              {isUser ? "You" : "GraphMind Assistant"}
            </span>
            {message.model && !isUser && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-200/70 text-slate-600 rounded">
                {message.model}
              </span>
            )}
          </div>

          {!isUser && message.content && (
            <button
              onClick={handleCopy}
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              title="Copy message"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        {/* Markdown Rendered Body */}
        <div className="text-sm text-slate-800 leading-relaxed break-words prose prose-slate max-w-none prose-sm prose-p:my-1.5 prose-headings:my-2 prose-pre:p-0 prose-pre:bg-transparent">
          {message.content ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || "");
                  return !inline && match ? (
                    <div className="my-3 rounded-lg overflow-hidden border border-slate-200 bg-slate-900 text-slate-100 font-mono text-xs shadow-xs">
                      <div className="px-3 py-1.5 bg-slate-800 border-b border-slate-700 text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center justify-between">
                        <span>{match[1]}</span>
                      </div>
                      <div className="p-3 overflow-x-auto">
                        <code className={className} {...props}>
                          {children}
                        </code>
                      </div>
                    </div>
                  ) : (
                    <code
                      className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-sky-800 font-mono text-xs font-medium"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          ) : message.isStreaming ? (
            <span className="inline-flex items-center space-x-1 text-slate-400 text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
              <span>Thinking...</span>
            </span>
          ) : null}

          {message.isStreaming && message.content && (
            <span className="inline-block w-2 h-4 ml-0.5 bg-sky-600 animate-pulse align-middle" />
          )}
        </div>
      </div>
    </div>
  );
}
