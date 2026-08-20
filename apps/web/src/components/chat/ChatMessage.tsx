"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { User, Sparkles, Copy, Check } from "lucide-react";
import { Message } from "@/hooks/useChatStream";
import { Button } from "@/components/ui/button";

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
      className={`py-5 px-4 sm:px-6 transition-colors group ${
        isUser ? "bg-transparent" : "bg-slate-50/50"
      }`}
    >
      <div className="max-w-3xl mx-auto flex gap-3 sm:gap-4">
        {/* Role Avatar */}
        <div className="shrink-0 pt-0.5">
          {isUser ? (
            <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs">
              <User className="w-3.5 h-3.5" />
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          )}
        </div>

        {/* Message Content Container */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Markdown Rendered Body */}
          <div className="text-[15px] text-slate-800 leading-relaxed break-words prose prose-slate max-w-none prose-p:my-2 prose-headings:my-3 prose-pre:p-0 prose-pre:bg-transparent">
            {message.content ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || "");
                    return !inline && match ? (
                      <div className="my-3.5 rounded-xl overflow-hidden border border-slate-200/80 bg-slate-900 text-slate-100 font-mono text-xs shadow-xs">
                        <div className="px-3.5 py-1.5 bg-slate-800/80 border-b border-slate-700/60 text-[11px] text-slate-400 font-medium flex items-center justify-between">
                          <span className="lowercase">{match[1]}</span>
                        </div>
                        <div className="p-3.5 overflow-x-auto">
                          <code className={className} {...props}>
                            {children}
                          </code>
                        </div>
                      </div>
                    ) : (
                      <code
                        className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200/60 text-sky-800 font-mono text-xs font-medium"
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
              <div className="flex items-center space-x-1.5 text-slate-400 text-xs pt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                <span>Thinking...</span>
              </div>
            ) : null}

            {message.isStreaming && message.content && (
              <span className="inline-block w-1.5 h-4 ml-0.5 bg-sky-600 animate-pulse align-middle" />
            )}
          </div>

          {/* Action Row */}
          {!isUser && message.content && (
            <div className="pt-2 flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-6 px-2 text-[11px] text-slate-400 hover:text-slate-700 flex items-center space-x-1"
                title="Copy response"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-600">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
