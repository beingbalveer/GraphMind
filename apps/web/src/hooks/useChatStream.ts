"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  ConversationTree,
  createConversationTree,
  addChildNode,
  updateNodeContent,
  getAncestorPath,
  FileAttachment,
} from "@graphmind/shared";


export interface BranchContext {
  parentNodeId: string;
  highlightedText: string;
}

export interface SendMessageOptions {
  branchOverride?: BranchContext | null;
  targetParentId?: string | null;
  preserveActiveNodeId?: boolean;
  onNodeCreated?: (nodes: { userNodeId: string; assistantNodeId: string; parentId: string | null }) => void;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  attachments?: FileAttachment[];
}


import { safeGetItem, safeSetItem, safeRemoveItem } from "@/lib/storage";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8300";

const STORAGE_KEY = "graphmind_tree_state";

export function useChatStream() {
  const [tree, setTree] = useState<ConversationTree | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingNodeId, setStreamingNodeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeBranch, setActiveBranch] = useState<BranchContext | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 1. Initial rehydration from LocalStorage on client mount
  useEffect(() => {
    try {
      const stored = safeGetItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ConversationTree;
        if (parsed && parsed.nodes && parsed.rootNodeId) {
          setTree(parsed);
        }
      }
    } catch (e) {
      console.warn("Failed to rehydrate conversation tree from localStorage:", e);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // 2. Auto-persist tree state changes to LocalStorage with QuotaExceededError protection
  useEffect(() => {
    if (!isHydrated) return;
    if (tree) {
      safeSetItem(STORAGE_KEY, JSON.stringify(tree));
    } else {
      safeRemoveItem(STORAGE_KEY);
    }
  }, [tree, isHydrated]);

  // Active messages path for the current screen view:
  // If activeNodeId is on a branch (an ancestor has highlightedContext), display only that branch's messages.
  // If activeNodeId is on the root mainline, display the full mainline conversation.
  const activeMessages = useMemo(() => {
    if (!tree || !tree.rootNodeId) return [];
    const targetId = tree.activeNodeId || tree.rootNodeId;
    const fullPath = getAncestorPath(tree, targetId);

    // Find the last branch divergence point in this lineage (if any)
    let branchRootIndex = -1;
    for (let i = fullPath.length - 1; i >= 0; i--) {
      if (fullPath[i].highlightedContext) {
        branchRootIndex = i;
        break;
      }
    }

    // If viewing a branch, replace main chat view with that branch's conversation
    if (branchRootIndex !== -1) {
      return fullPath.slice(branchRootIndex);
    }

    return fullPath;
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
    safeRemoveItem(STORAGE_KEY);
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
      const explicitOptions =
        optionsOrBranch && !("parentNodeId" in optionsOrBranch)
          ? optionsOrBranch
          : undefined;

      let branch: BranchContext | null = null;
      let preserveActiveNodeId = false;
      let onNodeCreated: ((nodes: { userNodeId: string; assistantNodeId: string; parentId: string | null }) => void) | undefined = undefined;

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
          attachments: explicitOptions?.attachments,
          metadata: explicitOptions?.attachments ? { attachments: explicitOptions.attachments } : {},
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
        targetParentId =
          explicitOptions?.targetParentId !== undefined
            ? explicitOptions.targetParentId
            : (branch?.parentNodeId || currentTree.activeNodeId);

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
            attachments: explicitOptions?.attachments,
            metadata: explicitOptions?.attachments ? { attachments: explicitOptions.attachments } : {},
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

      // Synchronously notify caller immediately of created node IDs with exact parentId
      onNodeCreated?.({ userNodeId, assistantNodeId, parentId: targetParentId });

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
          api_key: explicitOptions?.apiKey,
          base_url: explicitOptions?.baseUrl,
          temperature: explicitOptions?.temperature,
          max_tokens: explicitOptions?.maxTokens,
          system_prompt: explicitOptions?.systemPrompt,
          attachments: explicitOptions?.attachments,
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

      const provider = assistantNode.provider || userNode.provider || "gemini";
      const model = assistantNode.model || userNode.model || "gemini-2.5-flash";

      // Clear assistant content in-place and set active
      const currentTree = {
        ...updateNodeContent(tree, assistantNodeId, ""),
        activeNodeId: assistantNodeId,
      };

      setTree(currentTree);
      setIsStreaming(true);
      setStreamingNodeId(assistantNodeId);

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
          const errorMsg = err.message || "Failed to regenerate AI response";
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

      // 1. Update user message content in-place
      let currentTree = updateNodeContent(tree, userNode.id, newContent.trim());

      // 2. Find or create assistant child under userNode
      let assistantNodeId = userNode.childrenIds.find(
        (id) => currentTree.nodes[id]?.role === "assistant"
      );

      if (assistantNodeId) {
        // Clear previous assistant response in-place
        currentTree = updateNodeContent(currentTree, assistantNodeId, "");
      } else {
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
        assistantNodeId = assistantNode.id;
      }

      currentTree = {
        ...currentTree,
        activeNodeId: assistantNodeId,
      };

      setTree(currentTree);
      setIsStreaming(true);
      setStreamingNodeId(assistantNodeId);

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
          ? `[Focusing on excerpt: "${userNode.highlightedContext.trim()}"]\n\n${newContent.trim()}`
          : newContent.trim();

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
    },
    [tree, isStreaming]
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
