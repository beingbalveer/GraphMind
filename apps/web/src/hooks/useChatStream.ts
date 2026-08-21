"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import {
  ConversationTree,
  createConversationTree,
  addChildNode,
  updateNodeContent,
  getAncestorPath,
} from "@graphmind/shared";

export interface BranchContext {
  parentNodeId: string;
  highlightedText: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8008";

export function useChatStream() {
  const [tree, setTree] = useState<ConversationTree | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeBranch, setActiveBranch] = useState<BranchContext | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Active path messages to display in the main chat feed
  const activeMessages = useMemo(() => {
    if (!tree || !tree.activeNodeId) return [];
    return getAncestorPath(tree, tree.activeNodeId);
  }, [tree]);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const switchBranch = useCallback((nodeId: string) => {
    setTree((prev) => {
      if (!prev || !prev.nodes[nodeId]) return prev;
      return {
        ...prev,
        activeNodeId: nodeId,
        updatedAt: new Date().toISOString(),
      };
    });
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
      setActiveBranch(null); // Clear branch input badge

      let currentTree = tree;
      let targetParentId: string | null = null;
      let userNodeId: string;
      let assistantNodeId: string;

      if (!currentTree) {
        // 1. Initial Root Prompt
        currentTree = createConversationTree({
          role: "user",
          content: prompt.trim(),
          provider,
          model,
        });
        userNodeId = currentTree.rootNodeId;

        // Add streaming assistant child node
        const { tree: treeWithAssistant, node: assistantNode } = addChildNode(
          currentTree,
          {
            role: "assistant",
            parentId: userNodeId,
            content: "",
            provider,
            model,
          }
        );
        currentTree = treeWithAssistant;
        assistantNodeId = assistantNode.id;
      } else {
        // 2. Subsequent Turn or Branch from Parent
        targetParentId = branch?.parentNodeId || currentTree.activeNodeId;

        // Add user child node
        const { tree: treeWithUser, node: userNode } = addChildNode(
          currentTree,
          {
            role: "user",
            parentId: targetParentId,
            content: prompt.trim(),
            highlightedContext: branch?.highlightedText || null,
            provider,
            model,
          }
        );
        userNodeId = userNode.id;

        // Add assistant child node
        const { tree: treeWithAssistant, node: assistantNode } = addChildNode(
          treeWithUser,
          {
            role: "assistant",
            parentId: userNodeId,
            content: "",
            provider,
            model,
          }
        );
        currentTree = treeWithAssistant;
        assistantNodeId = assistantNode.id;
      }

      setTree(currentTree);
      setIsStreaming(true);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        // Build ancestor conversation lineage to forward to API
        const ancestorPath = getAncestorPath(currentTree, userNodeId);
        const messagesPayload = ancestorPath.map((node) => {
          let content = node.content;
          if (node.id === userNodeId && node.highlightedContext) {
            content = `[Focusing on excerpt: "${node.highlightedContext.trim()}"]\n\n${node.content}`;
          }
          return {
            role: node.role,
            content,
          };
        });

        const formattedPrompt = branch?.highlightedText
          ? `[Focusing on excerpt: "${branch.highlightedText.trim()}"]\n\n${prompt.trim()}`
          : prompt.trim();

        const payload: Record<string, any> = {
          prompt: formattedPrompt,
          messages: messagesPayload,
          tree: currentTree,
          parent_node_id: targetParentId,
          highlighted_context: branch?.highlightedText,
          provider,
          model,
        };

        const response = await fetch(`${API_BASE_URL}/api/v1/chat/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: abortController.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(
            `Server returned HTTP ${response.status}: ${response.statusText}`
          );
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
                  setTree((prev) => {
                    if (!prev) return prev;
                    return updateNodeContent(prev, assistantNodeId, accumulatedContent);
                  });
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
          setTree((prev) => {
            if (!prev) return prev;
            const node = prev.nodes[assistantNodeId];
            return updateNodeContent(
              prev,
              assistantNodeId,
              node?.content || "*(Generation stopped)*"
            );
          });
        } else {
          console.error("Chat streaming error:", err);
          const isConnectionError =
            err.name === "TypeError" || err.message?.includes("fetch");
          const errorText = isConnectionError
            ? `Cannot connect to backend at ${API_BASE_URL}. Please verify the FastAPI server is running.`
            : err.message || "An unexpected error occurred during streaming.";

          setError(errorText);
          setTree((prev) => {
            if (!prev) return prev;
            return updateNodeContent(
              prev,
              assistantNodeId,
              `⚠️ ${errorText}`
            );
          });
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [isStreaming, activeBranch, tree]
  );

  const retryLastMessage = useCallback(() => {
    if (!tree) return;
    const activeNodes = getAncestorPath(tree, tree.activeNodeId);
    const lastUserNode = [...activeNodes].reverse().find((n) => n.role === "user");
    if (lastUserNode) {
      sendMessage(lastUserNode.content);
    }
  }, [tree, sendMessage]);

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
    setTree(null);
    setError(null);
    setActiveBranch(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    tree,
    activeMessages,
    isStreaming,
    error,
    activeBranch,
    setBranchContext,
    clearBranchContext,
    switchBranch,
    clearError,
    sendMessage,
    retryLastMessage,
    stopStreaming,
    clearMessages,
  };
}
