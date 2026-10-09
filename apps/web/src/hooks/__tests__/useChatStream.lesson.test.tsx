import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createConversationTree } from "@graphmind/shared";
import { useChatStream } from "../useChatStream";
afterEach(() => {
  vi.unstubAllGlobals();
  globalThis.localStorage?.clear();
});
it("reuses the stored root prompt and the server-owned initial assistant identity", async () => {
  const root = createConversationTree({
    role: "user",
    content: "Teach me this topic with a manageable first lesson.",
    metadata: { topicSessionId: "lesson" },
  });
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(
        'event: token\ndata: {"content":"A manageable lesson"}\n\nevent: done\ndata: [DONE]\n\n',
        { status: 200 },
      ),
    );
  vi.stubGlobal("fetch", fetcher);
  const hook = renderHook(() => useChatStream());
  await act(async () => hook.result.current.loadTree(root));
  await act(async () =>
    hook.result.current.sendMessage(
      root.nodes[root.rootNodeId].content,
      "gemini",
      "model",
      { workspaceId: "ws", topicSessionId: "lesson", lessonStart: true },
    ),
  );
  expect(
    Object.values(hook.result.current.tree!.nodes).filter(
      (n) => n.role === "user",
    ),
  ).toHaveLength(1);
  expect(
    hook.result.current.tree!.nodes[`${root.rootNodeId}_lesson`].content,
  ).toBe("A manageable lesson");
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
    topic_session_id: "lesson",
    lesson_start: true,
    parent_node_id: root.rootNodeId,
  });
});
