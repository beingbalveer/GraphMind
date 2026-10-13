import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const defaultChatStreamState = {
  tree: null,
  activeMessages: [],
  isStreaming: false,
  streamingNodeId: null,
  error: null as string | null,
  activeBranch: null,
  setBranchContext: vi.fn(),
  clearBranchContext: vi.fn(),
  switchBranch: vi.fn(),
  clearError: vi.fn(),
  sendMessage: vi.fn(),
  retryLastMessage: vi.fn(),
  regenerateResponse: vi.fn(),
  editUserMessage: vi.fn(),
  stopStreaming: vi.fn(),
  clearMessages: vi.fn(),
  deleteBranch: vi.fn(),
  updateNodeMetadata: vi.fn(),
  loadTree: vi.fn((tree: unknown) => {
    streamTreeForTest = tree;
  }),
};

let streamTreeForTest: unknown = null;
const mockUseChatStream = vi.fn(() => ({ ...defaultChatStreamState, tree: streamTreeForTest }));

vi.mock("@/hooks/useChatStream", () => ({
  useChatStream: () => mockUseChatStream(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => roadmapState.path,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ logout: vi.fn(), user: null }),
}));

vi.mock("@/lib/workspaceApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/workspaceApi")>();

  return {
    ...actual,
    fetchWorkspace: vi.fn(async () => ({
      id: "ws_test",
      name: "Test workspace",
    })),
    fetchGraphSnapshot: vi.fn(async () => ({
      workspace: { id: "ws_test", name: "Test workspace" },
    })),
    fetchWorkspaceChats: vi.fn(async () => []),
  };
});

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/apiClient", () => ({ apiFetch: apiFetchMock }));

import { ChatContainer } from "../ChatContainer";
import { curriculumFixture } from "@/components/roadmap/__tests__/fixtures";
import { fetchGraphSnapshot } from "@/lib/workspaceApi";
const roadmapState = vi.hoisted(() => ({
  path: "/w/ws_test",
  view: null as import("@/lib/roadmapTypes").CurriculumView | null,
  loading: false,
  error: null as Error | null,
}));
vi.mock("@/hooks/useRoadmap", () => ({
  useRoadmap: () => ({
    ...roadmapState,
    refresh: vi.fn(),
    updateProgress: vi.fn(),
  }),
}));
vi.mock("@/components/roadmap/RoadmapCanvas", () => ({
  RoadmapCanvas: () => <div>Curriculum canvas</div>,
}));

describe("ChatContainer canonical composition", () => {
  it("constrains the conversation column and keeps the composer at the bottom", () => {
    render(
      <ChatContainer initialWorkspaceId="ws_test" initialViewMode="chat" />,
    );

    expect(screen.getByTestId("chat-content-column")).toHaveClass(
      "max-w-[var(--chat-content-max)]",
    );
    expect(screen.getByTestId("chat-composer-shell")).toBeVisible();
  });

  it("keeps contextual mastery outside the answer body", () => {
    render(
      <ChatContainer initialWorkspaceId="ws_test" initialViewMode="chat" />,
    );

    expect(
      screen.getByRole("button", { name: "Open right panel" }),
    ).toBeVisible();
    expect(
      screen.queryByText("Mastery", { selector: "article *" }),
    ).not.toBeInTheDocument();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    streamTreeForTest = null;
    mockUseChatStream.mockReturnValue({ ...defaultChatStreamState });
    roadmapState.path = "/w/ws_test";
    roadmapState.view = null;
    roadmapState.loading = false;
    roadmapState.error = null;
    vi.unstubAllEnvs();
  });

  it("saves a new root before the fast snapshot activates its prepared response", async () => {
    vi.stubEnv("NEXT_PUBLIC_ROADMAP_GENERATOR_ENABLED", "true");
    roadmapState.view = { ...curriculumFixture(), workspaceId: "ws_test" };
    roadmapState.path = "/w/ws_test";
    apiFetchMock.mockResolvedValue({
      id: "new-root", workspaceId: "ws_test", parentId: null, role: "user",
      content: "Explain topic one", metadata: { roadmapTopicIds: ["chosen"] },
      positionX: 0, positionY: 0, createdAt: "now", updatedAt: "now",
    });
    vi.mocked(fetchGraphSnapshot).mockResolvedValueOnce({
      workspace: { id: "ws_test", name: "Test workspace" } as never,
      rootNodeId: "new-root",
      nodes: [{
        id: "new-root", workspaceId: "ws_test", parentId: null, role: "user",
        content: "Explain topic one", metadata: { roadmapTopicIds: ["chosen"] },
        positionX: 0, positionY: 0, createdAt: "now", updatedAt: "now",
      }],
      edges: [],
    });
    const sendMessage = vi.fn(async (..._args: unknown[]) => ({
      assistantNodeId: "answer", content: "A useful answer", responseState: "completed" as const,
    }));
    mockUseChatStream.mockImplementation(() => ({
      ...defaultChatStreamState,
      tree: streamTreeForTest,
      sendMessage,
    }));

    render(<ChatContainer initialWorkspaceId="ws_test" />);
    fireEvent.click(await screen.findByRole("button", { name: "New Chat" }));
    fireEvent.change(screen.getByLabelText("Your first message"), {
      target: { value: "Explain topic one" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Include chosen in conversation context" }));
    fireEvent.click(screen.getByRole("button", { name: "Start chat" }));

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
    const options = (sendMessage.mock.calls[0] as unknown[] | undefined)?.[3];
    expect(options).toMatchObject({
      preparedUserMessageId: "new-root",
      roadmapTopicIds: ["chosen"],
    });
    expect(apiFetchMock.mock.invocationCallOrder[0]).toBeLessThan(sendMessage.mock.invocationCallOrder[0]);
    expect(fetchGraphSnapshot).toHaveBeenCalledWith("ws_test", "new-root");
  });

  it("does not start the stream or save an assistant when the first root cannot be saved", async () => {
    vi.stubEnv("NEXT_PUBLIC_ROADMAP_GENERATOR_ENABLED", "true");
    roadmapState.view = { ...curriculumFixture(), workspaceId: "ws_test" };
    roadmapState.path = "/w/ws_test";
    apiFetchMock.mockRejectedValue(new Error("Root save failed"));
    const sendMessage = vi.fn();
    mockUseChatStream.mockImplementation(() => ({
      ...defaultChatStreamState,
      tree: streamTreeForTest,
      sendMessage,
    }));

    render(<ChatContainer initialWorkspaceId="ws_test" />);
    fireEvent.click(await screen.findByRole("button", { name: "New Chat" }));
    fireEvent.change(screen.getByLabelText("Your first message"), {
      target: { value: "Start with a failed save" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start chat" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Root save failed");
    expect(sendMessage).not.toHaveBeenCalled();
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(fetchGraphSnapshot).not.toHaveBeenCalled();
  });

  it("renders starter prompt buttons without raw buttons and allows clicking them", () => {
    render(
      <ChatContainer initialWorkspaceId="ws_test" initialViewMode="chat" />,
    );

    const starterBtn = screen.getByRole("button", {
      name: /Explain LangGraph & State Machines/i,
    });
    expect(starterBtn).toBeVisible();
    fireEvent.click(starterBtn);
  });

  it("renders stream error inline feedback with retry and dismiss actions", () => {
    const retryMock = vi.fn();
    const clearErrorMock = vi.fn();
    mockUseChatStream.mockReturnValue({
      ...defaultChatStreamState,
      error: "Connection timeout while streaming",
      retryLastMessage: retryMock,
      clearError: clearErrorMock,
    });

    render(
      <ChatContainer initialWorkspaceId="ws_test" initialViewMode="chat" />,
    );

    const alert = screen.getByText("Stream error").closest('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert).toHaveTextContent("Connection timeout while streaming");

    const retryBtn = screen.getByRole("button", { name: "Retry" });
    const dismissBtn = screen.getByRole("button", { name: "Dismiss" });

    fireEvent.click(retryBtn);
    expect(retryMock).toHaveBeenCalled();

    fireEvent.click(dismissBtn);
    expect(clearErrorMock).toHaveBeenCalled();
  });

  it("keeps ChatContainer styles on semantic color tokens and uses no raw buttons", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/components/chat/ChatContainer.tsx"),
      "utf8",
    );

    expect(source).not.toMatch(/\b(?:bg|text|border|ring)-(?:white|zinc)-/);
    expect(source).not.toMatch(/<button\b/);
  });

  it("renders the active conversation title in breadcrumbs", () => {
    render(
      <ChatContainer initialWorkspaceId="ws_test" initialViewMode="chat" />,
    );

    const breadcrumbs = screen.getByRole("navigation", {
      name: "Branch lineage",
    });
    expect(breadcrumbs).toHaveTextContent("New Chat");
  });
});

describe("Roadmap shell routing", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_ROADMAP_GENERATOR_ENABLED", "true");
    roadmapState.view = { ...curriculumFixture(), workspaceId: "ws_test" };
  });
  it("renders roadmap landing instead of empty chat", () => {
    render(<ChatContainer initialWorkspaceId="ws_test" />);
    expect(screen.getByRole("heading", { name: "Drawing" })).toBeVisible();
    expect(screen.queryByTestId("chat-composer-shell")).not.toBeInTheDocument();
  });
  it("uses only the published anchor for curriculum canvas", () => {
    roadmapState.path = "/w/ws_test/chat/anchor/canvas";
    render(
      <ChatContainer
        initialWorkspaceId="ws_test"
        initialChatId="anchor"
        initialViewMode="canvas"
      />,
    );
    expect(screen.getByText("Curriculum canvas")).toBeVisible();
  });
  it("shows loading without empty chat flash", () => {
    roadmapState.path = "/w/ws_test";
    roadmapState.view = null;
    roadmapState.loading = true;
    render(<ChatContainer initialWorkspaceId="ws_test" />);
    expect(screen.getByText("Loading roadmap…")).toBeVisible();
    expect(screen.queryByTestId("chat-composer-shell")).not.toBeInTheDocument();
  });

  it("continues a general chat without sending archived roadmap topic IDs", async () => {
    vi.stubEnv("NEXT_PUBLIC_ROADMAP_GENERATOR_ENABLED", "true");
    roadmapState.path = "/w/ws_test/chat/general-root";
    const view = { ...curriculumFixture(), workspaceId: "ws_test" };
    view.candidate.items.find((item) => item.id === "chosen")!.participation = "archived";
    roadmapState.view = view;
    const root = {
      id: "general-root", role: "user" as const, content: "Explore this", parentId: null,
      childrenIds: [], metadata: { roadmapTopicIds: ["chosen"] },
    };
    const sendMessage = vi.fn(async (..._args: unknown[]) => null);
    mockUseChatStream.mockReturnValue({
      ...defaultChatStreamState,
      tree: {
        id: "tree", rootNodeId: root.id, activeNodeId: root.id,
        nodes: { [root.id]: root }, createdAt: "now", updatedAt: "now",
      } as never,
      sendMessage,
    });

    render(<ChatContainer initialWorkspaceId="ws_test" initialChatId="general-root" />);
    const input = await screen.findByPlaceholderText("Message GraphMind, attach code or paste images...");
    fireEvent.change(input, { target: { value: "Continue without archived context" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
    const options = (sendMessage.mock.calls[0] as unknown[] | undefined)?.[3];
    expect(options).toMatchObject({ roadmapTopicIds: [] });
  });
});

it("keeps conversation-only creation actions out of curriculum landing", () => {
  vi.stubEnv("NEXT_PUBLIC_ROADMAP_GENERATOR_ENABLED", "true");
  roadmapState.view = { ...curriculumFixture(), workspaceId: "ws_test", canWrite: false };
  roadmapState.path = "/w/ws_test";
  render(<ChatContainer initialWorkspaceId="ws_test" />);
  expect(
    screen.queryByRole("button", { name: "New Chat" }),
  ).not.toBeInTheDocument();
});

it("does not show generic mastery recommendations in a roadmap topic lesson", () => {
  roadmapState.path = "/w/ws_test/chat/tutor";
  roadmapState.view = { ...curriculumFixture(), workspaceId: "ws_test" };
  mockUseChatStream.mockReturnValue({
    ...defaultChatStreamState,
    tree: {
      id: "tree",
      rootNodeId: "tutor",
      activeNodeId: "tutor",
      nodes: {
        tutor: {
          id: "tutor",
          role: "user",
          content: "Teach me",
          metadata: { topicSessionId: "lesson" },
          childrenIds: [],
          parentId: null,
        },
      },
      createdAt: "now",
      updatedAt: "now",
    } as never,
  });
  render(<ChatContainer initialWorkspaceId="ws_test" initialChatId="tutor" />);
  expect(screen.getByTestId("main-header")).toBeVisible();
  expect(screen.getByText("Teach me")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Back to roadmap" })).not.toBeInTheDocument();
  expect(screen.queryByText("Learning details")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Mark completed" })).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Open right panel" }),
  ).not.toBeInTheDocument();
});
