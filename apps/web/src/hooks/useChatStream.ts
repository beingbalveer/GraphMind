"use client";

import { useState, useRef, useCallback } from "react";

export interface Message {
  id: string;
  parentId?: string | null;
  role: "user" | "assistant";
  content: string;
  highlightedContext?: string | null;
  model?: string;
  createdAt: string;
  isStreaming?: boolean;
  isError?: boolean;
}

export interface BranchContext {
  parentNodeId: string;
  highlightedText: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8008";

export function useChatStream() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeBranch, setActiveBranch] = useState<BranchContext | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setMessages((prev) =>
      prev.map((msg) =>
        msg.isStreaming
          ? {
              ...msg,
              isStreaming: false,
              content: msg.content || "*(Generation stopped)*",
            }
          : msg
      )
    );
  }, []);

  const sendMessage = useCallback(
    async (
      prompt: string,
      provider = "gemini",
      model = "gemini-2.5-flash",
      branchOverride?: BranchContext | null
    ) => {
      if (!prompt.trim() || isStreaming) return;

      setError(null);
      const branch = branchOverride !== undefined ? branchOverride : activeBranch;
      const userMessageId = `user-${Date.now()}`;
      const assistantMessageId = `assistant-${Date.now()}`;

      const userMessage: Message = {
        id: userMessageId,
        parentId: branch?.parentNodeId || null,
        role: "user",
        content: prompt.trim(),
        highlightedContext: branch?.highlightedText || null,
        createdAt: new Date().toISOString(),
      };

      const assistantMessage: Message = {
        id: assistantMessageId,
        parentId: userMessageId,
        role: "assistant",
        content: "",
        model: model,
        createdAt: new Date().toISOString(),
        isStreaming: true,
        isError: false,
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);
      setActiveBranch(null); // Clear branch badge once sent

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        // Collect existing non-error, non-streaming messages for conversational context
        const history = messages
          .filter((m) => m.content && !m.isStreaming && !m.isError)
          .map((m) => ({
            role: m.role,
            content: m.content,
          }));

        // Format user message with highlighted excerpt if branching
        const formattedPrompt = branch?.highlightedText
          ? `[Focusing on excerpt: "${branch.highlightedText.trim()}"]\n\n${prompt.trim()}`
          : prompt.trim();

        const messagesPayload = [
          ...history,
          { role: "user", content: formattedPrompt },
        ];

        const payload: Record<string, any> = {
          prompt: formattedPrompt,
          messages: messagesPayload,
          provider,
          model,
        };

        if (branch?.parentNodeId) {
          payload.parent_node_id = branch.parentNodeId;
        }
        if (branch?.highlightedText) {
          payload.highlighted_context = branch.highlightedText;
        }

        const response = await fetch(`${API_BASE_URL}/api/v1/chat/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
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
          // Keep incomplete line fragment in buffer
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
                        ? { ...msg, content: accumulatedContent, isError: false }
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
          // Clean user cancellation
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    isStreaming: false,
                    isError: false,
                    content: msg.content || "*(Generation stopped)*",
                  }
                : msg
            )
          );
        } else {
          console.error("Chat streaming error:", err);
          const isConnectionError =
            err.name === "TypeError" || err.message?.includes("fetch");
          const errorText = isConnectionError
            ? `Cannot connect to backend at ${API_BASE_URL}. Please verify the FastAPI server is running.`
            : err.message || "An unexpected error occurred during streaming.";

          setError(errorText);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    isStreaming: false,
                    isError: true,
                    content: msg.content || `⚠️ ${errorText}`,
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
    [isStreaming, activeBranch, messages]
  );

  const retryLastMessage = useCallback(() => {
    // Find the last user message and re-send
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMessage) {
      // Remove trailing failed assistant messages
      setMessages((prev) => {
        const lastIdx = prev.findLastIndex((m) => m.role === "user");
        return prev.slice(0, lastIdx);
      });
      sendMessage(lastUserMessage.content);
    }
  }, [messages, sendMessage]);

  const setBranchContext = useCallback(
    (parentNodeId: string, highlightedText: string) => {
      setActiveBranch({ parentNodeId, highlightedText });
    },
    []
  );

  const clearBranchContext = useCallback(() => {
    setActiveBranch(null);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    setActiveBranch(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
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
  };
}
