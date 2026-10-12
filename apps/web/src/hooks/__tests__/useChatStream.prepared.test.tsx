import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { addChildNode, createConversationTree } from "@graphmind/shared";
import { useChatStream } from "../useChatStream";

afterEach(() => {
  vi.unstubAllGlobals();
  globalThis.localStorage?.clear();
});

function stream(content: string) {
  return new Response(
    `event: token\ndata: ${JSON.stringify({ content })}\n\nevent: done\ndata: [DONE]\n\n`,
    { status: 200 },
  );
}

it("streams from the saved general root exactly once and clears inherited lesson context", async () => {
  const root = createConversationTree({
    id: "saved-general-root",
    role: "user",
    content: "Explain graph theory",
    metadata: { topicSessionId: "stale-lesson" },
  });
  const fetcher = vi.fn().mockResolvedValue(stream("A graph is a set of nodes."));
  vi.stubGlobal("fetch", fetcher);
  const hook = renderHook(() => useChatStream());
  await act(async () => hook.result.current.loadTree(root));

  let result!: Awaited<ReturnType<typeof hook.result.current.sendMessage>>;
  await act(async () => {
    result = await hook.result.current.sendMessage(
      "ignored because the persisted root is authoritative",
      "gemini",
      "gemini-2.5-flash",
      {
        workspaceId: "workspace-1",
        topicSessionId: "stale-lesson",
        preparedUserMessageId: root.rootNodeId,
        roadmapTopicIds: ["topic-a"],
      },
    );
  });

  expect(result?.success).toBe(true);
  expect(Object.values(hook.result.current.tree!.nodes).filter((node) => node.role === "user")).toHaveLength(1);
  expect(hook.result.current.tree!.nodes["saved-general-root_response"].content).toBe(
    "A graph is a set of nodes.",
  );
  const payload = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(payload).toMatchObject({
    prompt: "Explain graph theory",
    parent_node_id: "saved-general-root",
    lesson_start: false,
    roadmap_topic_ids: ["topic-a"],
  });
  expect(payload).not.toHaveProperty("topic_session_id");
});

it("waits for persistence before streaming and rejects duplicate sends during the save", async () => {
  const root = createConversationTree({
    id: "persisted-root",
    role: "user",
    content: "First question",
  });
  const fetcher = vi.fn().mockResolvedValue(stream("Answer"));
  vi.stubGlobal("fetch", fetcher);
  const hook = renderHook(() => useChatStream());
  await act(async () => hook.result.current.loadTree(root));

  let releaseSave!: () => void;
  const onNodeCreated = vi.fn(
    () => new Promise<void>((resolve) => {
      releaseSave = resolve;
    }),
  );
  let firstSend!: Promise<unknown>;
  await act(async () => {
    firstSend = hook.result.current.sendMessage(
      "First question",
      "gemini",
      "model",
      { workspaceId: "ws", onNodeCreated },
    );
    await Promise.resolve();
  });

  expect(fetcher).not.toHaveBeenCalled();
  expect(onNodeCreated).toHaveBeenCalledTimes(1);
  expect(onNodeCreated).toHaveBeenCalledWith(expect.objectContaining({
    preparedUserMessage: false,
  }));
  await act(async () => {
    await hook.result.current.sendMessage("Duplicate", "gemini", "model");
  });
  expect(onNodeCreated).toHaveBeenCalledTimes(1);

  await act(async () => releaseSave());
  await act(async () => firstSend);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("does not stream when awaited root persistence fails", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const hook = renderHook(() => useChatStream());
  const onNodeCreated = vi.fn(async () => {
    throw new Error("root save failed");
  });

  let result!: Awaited<ReturnType<typeof hook.result.current.sendMessage>>;
  await act(async () => {
    result = await hook.result.current.sendMessage(
      "First question",
      "gemini",
      "model",
      { workspaceId: "ws", onNodeCreated },
    );
  });
  expect(result).toBeNull();
  expect(hook.result.current.error).toBe("root save failed");
  expect(fetcher).not.toHaveBeenCalled();
});

it("allows retrying an unanswered root but preserves a completed response", async () => {
  const root = createConversationTree({
    id: "unanswered-root",
    role: "user",
    content: "Question",
  });
  const fetcher = vi.fn().mockResolvedValue(stream("Answer"));
  vi.stubGlobal("fetch", fetcher);
  const hook = renderHook(() => useChatStream());
  await act(async () => hook.result.current.loadTree(root));
  await act(async () => {
    await hook.result.current.sendMessage("Question", "gemini", "model", {
      preparedUserMessageId: root.rootNodeId,
    });
  });
  expect(fetcher).toHaveBeenCalledTimes(1);

  await act(async () => {
    await hook.result.current.sendMessage("Question", "gemini", "model", {
      preparedUserMessageId: root.rootNodeId,
    });
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(hook.result.current.error).toBe("This conversation already has a response.");
  expect(hook.result.current.tree!.nodes["unanswered-root_response"].content).toBe("Answer");
});

it("persists failed response state so the same saved root can be explicitly retried", async () => {
  const root = createConversationTree({
    id: "failed-root",
    role: "user",
    content: "Question",
  });
  const fetcher = vi.fn().mockRejectedValueOnce(new Error("provider unavailable"));
  vi.stubGlobal("fetch", fetcher);
  const hook = renderHook(() => useChatStream());
  await act(async () => hook.result.current.loadTree(root));
  let failedResult!: Awaited<ReturnType<typeof hook.result.current.sendMessage>>;
  await act(async () => {
    failedResult = await hook.result.current.sendMessage("Question", "gemini", "model", {
      preparedUserMessageId: root.rootNodeId,
    });
  });
  expect(failedResult?.responseState).toBe("failed");
  expect(hook.result.current.tree!.nodes["failed-root_response"].metadata?.responseState).toBe("failed");

  fetcher.mockResolvedValueOnce(stream("Recovered answer"));
  let retriedResult!: Awaited<ReturnType<typeof hook.result.current.sendMessage>>;
  await act(async () => {
    retriedResult = await hook.result.current.sendMessage("Question", "gemini", "model", {
      preparedUserMessageId: root.rootNodeId,
    });
  });
  expect(retriedResult?.responseState).toBe("completed");
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(hook.result.current.tree!.nodes["failed-root_response"].content).toBe("Recovered answer");
});

it("does not replace an interrupted response that already has follow-up descendants", async () => {
  const root = createConversationTree({
    id: "branched-root",
    role: "user",
    content: "Question",
  });
  const withAssistant = addChildNode(root, {
    id: "branched-root_response",
    role: "assistant",
    parentId: root.rootNodeId,
    content: "Partial response",
  }).tree;
  const withFollowUp = addChildNode(withAssistant, {
    role: "user",
    parentId: "branched-root_response",
    content: "Follow-up question",
  }).tree;
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const hook = renderHook(() => useChatStream());
  await act(async () => hook.result.current.loadTree({
    ...withFollowUp,
    nodes: {
      ...withFollowUp.nodes,
      "branched-root_response": {
        ...withFollowUp.nodes["branched-root_response"],
        metadata: { responseState: "interrupted" },
      },
    },
  }));

  await act(async () => {
    await hook.result.current.sendMessage("Question", "gemini", "model", {
      preparedUserMessageId: root.rootNodeId,
    });
  });
  expect(fetcher).not.toHaveBeenCalled();
  expect(hook.result.current.tree!.nodes["branched-root_response"].content).toBe("Partial response");
  expect(hook.result.current.tree!.nodes["branched-root_response"].childrenIds).toHaveLength(1);
});
