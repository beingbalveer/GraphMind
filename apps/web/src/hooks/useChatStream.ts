"use client";

import { useState, useRef, useCallback } from "react";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  createdAt: string;
  isStreaming?: boolean;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8008";

export function useChatStream() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (prompt: string, provider = "gemini", model = "gemini-2.5-flash") => {
      if (!prompt.trim() || isStreaming) return;

      setError(null);
      const userMessageId = `user-${Date.now()}`;
      const assistantMessageId = `assistant-${Date.now()}`;

      const userMessage: Message = {
        id: userMessageId,
        role: "user",
        content: prompt.trim(),
        createdAt: new Date().toISOString(),
      };

      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        model: model,
        createdAt: new Date().toISOString(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/chat/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: prompt.trim(),
            provider,
            model,
          }),
          signal: abortController.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Server returned HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = "";
        let lineBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          lineBuffer += decoder.decode(value, { stream: true });
          const lines = lineBuffer.split("\n");
          // Keep the last incomplete fragment in lineBuffer
          lineBuffer = lines.pop() || "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith("data: ")) {
              const rawData = trimmedLine.slice(6).trim();
              if (rawData === "[DONE]") break;

              try {
                const parsed = JSON.parse(rawData);
                if (parsed.error) {
                  throw new Error(parsed.error);
                }
                if (parsed.content) {
                  accumulatedContent += parsed.content;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: accumulatedContent }
                        : msg
                    )
                  );
                }
              } catch (parseError: any) {
                if (parseError.message && !parseError.message.includes("JSON")) {
                  throw parseError;
                }
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          console.log("Stream generation stopped by user");
        } else {
          console.error("Chat streaming error:", err);
          const isConnectionError =
            err.name === "TypeError" || err.message?.includes("fetch");
          const errorText = isConnectionError
            ? `⚠️ Cannot connect to backend at ${API_BASE_URL}. Please verify the FastAPI server is running.`
            : `⚠️ ${err.message || "An unexpected error occurred during streaming."}`;

          setError(errorText);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    content: msg.content || errorText,
                  }
                : msg
            )
          );
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg
          )
        );
      }
    },
    [isStreaming]
  );

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearMessages,
  };
}
