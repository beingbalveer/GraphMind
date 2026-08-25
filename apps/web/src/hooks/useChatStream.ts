"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
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

export interface SendMessageOptions {
  branchOverride?: BranchContext | null;
  preserveActiveNodeId?: boolean;
  onNodeCreated?: (nodes: { userNodeId: string; assistantNodeId: string }) => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8008";
const STORAGE_KEY = "graphmind_active_tree_v1";

export function useChatStream() {
  const [tree, setTree] = useState<ConversationTree | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingNodeId, setStreamingNodeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeBranch, setActiveBranch] = useState<BranchContext | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 1. Initial LocalStorage Rehydration
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ConversationTree;
        if (parsed && parsed.rootNodeId && parsed.nodes) {
          setTree(parsed);
        }
      }
    } catch (e) {
      console.warn("Failed to rehydrate conversation tree from localStorage:", e);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // 2. Auto-persist tree state changes to LocalStorage
  useEffect(() => {
    if (!isHydrated) return;
    try {
      if (tree) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn("Failed to persist conversation tree to localStorage:", e);
    }
  }, [tree, isHydrated]);

  // Active messages path leading to activeNodeId
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
    setStreamingNodeId(null);
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

  const setBranchContext = useCallback((parentNodeId: string, highlightedText: string) => {
    setActiveBranch({ parentNodeId, highlightedText });
  }, []);

  const clearBranchContext = useCallback(() => {
    setActiveBranch(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const loadTree = useCallback((newTree: ConversationTree | null) => {
    setTree(newTree);
    if (newTree && typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newTree));
    }
  }, []);

  const deleteBranch = useCallback(
    async (nodeId: string, workspaceId: string) => {
      if (!workspaceId) return false;
      try {
        const { deleteWorkspaceBranch } = await import("@/lib/workspaceApi");
        const success = await deleteWorkspaceBranch(workspaceId, nodeId);
        if (success) {
          setTree((prev) => {
            if (!prev) return prev;
            const newNodes = { ...prev.nodes };
            
            // Helper to recursively collect all descendant IDs
            const getDescendants = (id: string): string[] => {
              const children = Object.values(newNodes).filter(n => n.parentId === id);
              let all = [id];
              for (const child of children) {
                all = all.concat(getDescendants(child.id));
              }
              return all;
            };

            const toDelete = getDescendants(nodeId);
            toDelete.forEach(id => {
              delete newNodes[id];
            });

            // If we deleted the active node, reset activeNodeId to root
            let newActiveId = prev.activeNodeId;
            if (toDelete.includes(newActiveId || "")) {
              newActiveId = prev.rootNodeId;
            }

            return {
              ...prev,
              nodes: newNodes,
              activeNodeId: newActiveId
            };
          });
        }
        return success;
      } catch (err) {
        console.error("Failed to delete branch:", err);
        return false;
      }
    },
    [setTree]
  );

  const updateNodeMetadata = useCallback(
    (nodeId: string, metadata: Record<string, unknown>) => {
      setTree((prev) => {
        if (!prev || !prev.nodes[nodeId]) return prev;
        const target = prev.nodes[nodeId];
        return {
          ...prev,
          nodes: {
            ...prev.nodes,
            [nodeId]: {
              ...target,
              metadata: {
                ...(target.metadata || {}),
                ...metadata,
              },
            },
          },
          updatedAt: new Date().toISOString(),
        };
      });
    },
    []
  );


  const clearMessages = useCallback(() => {
    stopStreaming();
    setTree(null);
    setActiveBranch(null);
    setError(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [stopStreaming]);

  const sendMessage = useCallback(
    async (
      prompt: string,
      provider = "gemini",
      model = "gemini-2.5-flash",
      optionsOrBranch?: BranchContext | SendMessageOptions | null
    ) => {
      if (!prompt.trim() || isStreaming) return null;

      setError(null);

      // Normalize options
      let branch: BranchContext | null = null;
      let preserveActiveNodeId = false;
      let onNodeCreated: ((nodes: { userNodeId: string; assistantNodeId: string }) => void) | undefined = undefined;

      if (optionsOrBranch) {
        if ("parentNodeId" in optionsOrBranch) {
          branch = optionsOrBranch;
          preserveActiveNodeId = true;
        } else {
          branch = optionsOrBranch.branchOverride || null;
          preserveActiveNodeId =
            optionsOrBranch.preserveActiveNodeId !== undefined
              ? Boolean(optionsOrBranch.preserveActiveNodeId)
              : Boolean(branch);
          onNodeCreated = optionsOrBranch.onNodeCreated;
        }
      } else {
        branch = activeBranch;
        preserveActiveNodeId = Boolean(activeBranch?.highlightedText);
      }

      setActiveBranch(null); // Clear branch input badge

      let currentTree = tree;
      const previousActiveNodeId = currentTree?.activeNodeId;
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

        // If preserving main conversation active node, revert activeNodeId on tree
        if (preserveActiveNodeId && previousActiveNodeId) {
          currentTree = {
            ...currentTree,
            activeNodeId: previousActiveNodeId,
          };
        }
      }

      // Synchronously notify caller immediately of created node IDs (e.g. to open side pane in 0ms)
      onNodeCreated?.({ userNodeId, assistantNodeId });

      setTree(currentTree);
      setIsStreaming(true);
      setStreamingNodeId(assistantNodeId);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      let accumulatedContent = "";
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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              } catch (parseError: any) {
                if (parseError.message && !parseError.message.includes("JSON")) {
                  throw parseError;
                }
              }
            }
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        if (err.name === "AbortError") {
          setTree((prev) => {
            if (!prev) return prev;
            const node = prev.nodes[assistantNodeId];
            if (!node || !node.content) {
              return updateNodeContent(prev, assistantNodeId, "*(Generation stopped by user)*");
            }
            return prev;
          });
        } else {
          const errorMsg = err.message || "Failed to generate AI response";
          setError(errorMsg);
          setTree((prev) => {
            if (!prev) return prev;
            return updateNodeContent(
              prev,
              assistantNodeId,
              `⚠️ **Error:** ${errorMsg}\n\nPlease verify that the backend API is running.`
            );
          });
        }
      } finally {
        setIsStreaming(false);
        setStreamingNodeId(null);
        abortControllerRef.current = null;
      }

      return { userNodeId, assistantNodeId, content: accumulatedContent };
    },
    [tree, isStreaming, activeBranch]
  );

  const retryLastMessage = useCallback(() => {
    if (!tree || !tree.activeNodeId) return;
    const activeNode = tree.nodes[tree.activeNodeId];
    if (!activeNode) return;

    if (activeNode.role === "assistant" && activeNode.parentId) {
      const userNode = tree.nodes[activeNode.parentId];
      if (userNode) {
        sendMessage(
          userNode.content,
          userNode.provider || "gemini",
          userNode.model || "gemini-2.5-flash",
          {
            parentNodeId: userNode.parentId || undefined,
            highlightedText: userNode.highlightedContext || undefined,
          } as unknown as BranchContext
        );
      }
    }
  }, [tree, sendMessage]);

  const regenerateResponse = useCallback(
    async (assistantNodeId: string) => {
      if (!tree || isStreaming) return;
      const assistantNode = tree.nodes[assistantNodeId];
      if (!assistantNode || !assistantNode.parentId) return;

      const userNode = tree.nodes[assistantNode.parentId];
      if (!userNode) return;

      let currentTree = tree;
      const provider = assistantNode.provider || userNode.provider || "gemini";
      const model = assistantNode.model || userNode.model || "gemini-2.5-flash";

      // Add a new alternative assistant child node under the same user node
      const { tree: treeWithAssistant, node: newAssistantNode } = addChildNode(
        currentTree,
        {
          role: "assistant",
          parentId: userNode.id,
          content: "",
          provider,
          model,
        }
      );
      currentTree = treeWithAssistant;
      const newAssistantNodeId = newAssistantNode.id;

      setTree(currentTree);
      setIsStreaming(true);
      setStreamingNodeId(newAssistantNodeId);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      let accumulatedContent = "";
      try {
        const ancestorPath = getAncestorPath(currentTree, userNode.id);
        const messagesPayload = ancestorPath.map((node) => {
          let content = node.content;
          if (node.id === userNode.id && node.highlightedContext) {
            content = `[Focusing on excerpt: "${node.highlightedContext.trim()}"]\n\n${node.content}`;
          }
          return {
            role: node.role,
            content,
          };
        });

        const formattedPrompt = userNode.highlightedContext
          ? `[Focusing on excerpt: "${userNode.highlightedContext.trim()}"]\n\n${userNode.content.trim()}`
          : userNode.content.trim();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload: Record<string, any> = {
          prompt: formattedPrompt,
          messages: messagesPayload,
          tree: currentTree,
          parent_node_id: userNode.id,
          highlighted_context: userNode.highlightedContext,
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
                    return updateNodeContent(prev, newAssistantNodeId, accumulatedContent);
                  });
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              } catch (parseError: any) {
                if (parseError.message && !parseError.message.includes("JSON")) {
                  throw parseError;
                }
              }
            }
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        if (err.name === "AbortError") {
          setTree((prev) => {
            if (!prev) return prev;
            const node = prev.nodes[newAssistantNodeId];
            if (!node || !node.content) {
              return updateNodeContent(prev, newAssistantNodeId, "*(Generation stopped by user)*");
            }
            return prev;
          });
        } else {
          const errorMsg = err.message || "Failed to regenerate AI response";
          setError(errorMsg);
          setTree((prev) => {
            if (!prev) return prev;
            return updateNodeContent(
              prev,
              newAssistantNodeId,
              `⚠️ **Error:** ${errorMsg}\n\nPlease verify that the backend API is running.`
            );
          });
        }
      } finally {
        setIsStreaming(false);
        setStreamingNodeId(null);
        abortControllerRef.current = null;
      }
    },
    [tree, isStreaming]
  );

  const editUserMessage = useCallback(
    async (userNodeId: string, newContent: string) => {
      if (!tree || isStreaming || !newContent.trim()) return;
      const userNode = tree.nodes[userNodeId];
      if (!userNode) return;

      const provider = userNode.provider || "gemini";
      const model = userNode.model || "gemini-2.5-flash";

      if (!userNode.parentId) {
        // 1. Editing Root Prompt
        let currentTree = updateNodeContent(tree, userNode.id, newContent.trim());

        const { tree: treeWithAssistant, node: assistantNode } = addChildNode(
          currentTree,
          {
            role: "assistant",
            parentId: userNode.id,
            content: "",
            provider,
            model,
          }
        );
        currentTree = treeWithAssistant;
        const assistantNodeId = assistantNode.id;

        setTree(currentTree);
        setIsStreaming(true);
        setStreamingNodeId(assistantNodeId);

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        let accumulatedContent = "";
        try {
          const payload = {
            prompt: newContent.trim(),
            messages: [{ role: "user", content: newContent.trim() }],
            tree: currentTree,
            parent_node_id: userNode.id,
            provider,
            model,
          };

          const response = await fetch(`${API_BASE_URL}/api/v1/chat/stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
                  if (parsed.error) throw new Error(parsed.error);
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
              if (!node || !node.content) {
                return updateNodeContent(prev, assistantNodeId, "*(Generation stopped by user)*");
              }
              return prev;
            });
          } else {
            const errorMsg = err.message || "Failed to generate AI response";
            setError(errorMsg);
            setTree((prev) => {
              if (!prev) return prev;
              return updateNodeContent(
                prev,
                assistantNodeId,
                `⚠️ **Error:** ${errorMsg}\n\nPlease verify that the backend API is running.`
              );
            });
          }
        } finally {
          setIsStreaming(false);
          setStreamingNodeId(null);
          abortControllerRef.current = null;
        }
      } else {
        // 2. Editing Child Turn: Fork from parent and switch active lineage immediately
        sendMessage(
          newContent.trim(),
          provider,
          model,
          {
            branchOverride: {
              parentNodeId: userNode.parentId,
              highlightedText: userNode.highlightedContext || "",
            },
            preserveActiveNodeId: false,
          }
        );
      }
    },
    [tree, isStreaming, sendMessage]
  );


  return {

    tree,
    activeMessages,
    isStreaming,
    streamingNodeId,
    error,
    activeBranch,
    setBranchContext,
    clearBranchContext,
    switchBranch,
    clearError,
    sendMessage,
    retryLastMessage,
    regenerateResponse,
    editUserMessage,
    stopStreaming,
    clearMessages,
    deleteBranch,
    updateNodeMetadata,
    loadTree,
  };
}
