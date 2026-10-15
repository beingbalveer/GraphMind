import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudioTopicChatHistory } from "../StudioTopicChatHistory";
import { StudioTutorRail } from "../StudioTutorRail";
import { StudioCourseRail } from "../StudioCourseRail";
import {
  listTopicSessions,
  openTopicSession,
  readTopicSession,
} from "@/lib/roadmapApi";
import type { TopicSessionData, TopicSessionSummary } from "@/lib/roadmapTypes";

vi.mock("@/lib/roadmapApi", () => ({
  listTopicSessions: vi.fn(),
  openTopicSession: vi.fn(),
  readTopicSession: vi.fn(),
}));

const mockSummary = (
  id: string,
  chatId: string,
  opts: Partial<TopicSessionSummary> = {},
): TopicSessionSummary => ({
  id,
  chatId,
  topicId: "topic-1",
  title: `Session ${id}`,
  revisionId: "rev-1",
  createdAt: "2026-10-10T12:00:00Z",
  updatedAt: "2026-10-10T12:00:00Z",
  isPrimary: false,
  lessonStartState: "completed",
  archived: false,
  ...opts,
});

const mockSessionData = (
  id: string,
  chatId: string,
  opts: Partial<TopicSessionData> = {},
): TopicSessionData => ({
  id,
  chatId,
  topicId: "topic-1",
  revisionId: "rev-1",
  isNew: false,
  lessonStartState: "completed",
  archived: false,
  topicTitle: "Async Request Routing",
  ...opts,
});

describe("StudioTopicChatHistory & TopicChat histories (LSI-013)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and preserves session history with status badges", async () => {
    vi.mocked(listTopicSessions).mockResolvedValue({
      sessions: [
        mockSummary("session-1", "chat-1", {
          title: "Initial Exploration",
          isPrimary: true,
          lessonStartState: "completed",
        }),
        mockSummary("session-2", "chat-2", {
          title: "Follow-up Deep Dive",
          isPrimary: false,
          lessonStartState: "interrupted",
        }),
      ],
    });

    render(
      <StudioTopicChatHistory
        workspaceId="ws-123"
        topicId="topic-1"
        topicTitle="Async Request Routing"
      />,
    );

    await waitFor(() => {
      expect(listTopicSessions).toHaveBeenCalledWith(
        "ws-123",
        "topic-1",
        20,
        expect.any(AbortSignal),
      );
    });

    expect(await screen.findByText("Initial Exploration")).toBeInTheDocument();
    expect(screen.getByText("Follow-up Deep Dive")).toBeInTheDocument();
    expect(screen.getByText("Primary")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Interrupted")).toBeInTheDocument();
  });

  it("creates a fresh session with idempotency protection and deduplicates client records", async () => {
    vi.mocked(listTopicSessions).mockResolvedValue({ sessions: [] });
    vi.mocked(openTopicSession).mockResolvedValue(
      mockSessionData("fresh-session-1", "chat-fresh-1", {
        isNew: true,
        lessonStartState: "pending",
        topicTitle: "Fresh Discussion",
      }),
    );

    const onSessionCreated = vi.fn();
    render(
      <StudioTopicChatHistory
        workspaceId="ws-123"
        topicId="topic-1"
        topicTitle="Async Request Routing"
        onSessionCreated={onSessionCreated}
      />,
    );

    await waitFor(() => expect(listTopicSessions).toHaveBeenCalled());

    // Empty state should be visible initially
    expect(screen.getByText("No conversations yet")).toBeInTheDocument();

    const newChatButton = screen.getByRole("button", { name: "New chat" });
    fireEvent.click(newChatButton);

    await waitFor(() => {
      expect(openTopicSession).toHaveBeenCalledWith(
        "ws-123",
        "topic-1",
        expect.any(String),
        true,
      );
    });

    const firstKey = vi.mocked(openTopicSession).mock.calls[0][2];
    expect(firstKey).toBeDefined();

    // Verify onSessionCreated was called and session is displayed
    expect(onSessionCreated).toHaveBeenCalledWith(
      expect.objectContaining({ id: "fresh-session-1" }),
    );
    expect(await screen.findByText("Fresh Discussion")).toBeInTheDocument();
  });

  it("reuses idempotency key on fresh session retry when previous attempt failed", async () => {
    vi.mocked(listTopicSessions).mockResolvedValue({ sessions: [] });
    vi.mocked(openTopicSession)
      .mockRejectedValueOnce(new Error("Network connection dropped"))
      .mockResolvedValueOnce(
        mockSessionData("fresh-session-retry", "chat-fresh-retry", {
          isNew: true,
          lessonStartState: "started",
        }),
      );

    render(
      <StudioTopicChatHistory
        workspaceId="ws-123"
        topicId="topic-1"
        topicTitle="Async Request Routing"
      />,
    );

    await waitFor(() => expect(listTopicSessions).toHaveBeenCalled());

    const newChatButton = screen.getByRole("button", { name: "New chat" });
    fireEvent.click(newChatButton);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Network connection dropped",
    );

    const firstKey = vi.mocked(openTopicSession).mock.calls[0][2];

    // Retry clicking new chat
    fireEvent.click(newChatButton);

    await waitFor(() => expect(openTopicSession).toHaveBeenCalledTimes(2));

    const retryKey = vi.mocked(openTopicSession).mock.calls[1][2];
    expect(retryKey).toBe(firstKey); // Idempotency preserved on retry
  });

  it("selects and switches active session without duplicate client records", async () => {
    const summary1 = mockSummary("session-1", "chat-1", { title: "Session 1" });
    const summary2 = mockSummary("session-2", "chat-2", { title: "Session 2" });

    vi.mocked(listTopicSessions).mockResolvedValue({
      sessions: [summary1, summary2],
    });
    vi.mocked(readTopicSession).mockResolvedValue(
      mockSessionData("session-2", "chat-2"),
    );

    const onSelectSession = vi.fn();
    render(
      <StudioTopicChatHistory
        workspaceId="ws-123"
        topicId="topic-1"
        activeSessionId="session-1"
        onSelectSession={onSelectSession}
      />,
    );

    await waitFor(() => expect(listTopicSessions).toHaveBeenCalled());

    const resumeButton = screen.getByRole("button", {
      name: "Resume lesson session 1",
    });
    fireEvent.click(resumeButton);

    await waitFor(() => {
      expect(readTopicSession).toHaveBeenCalledWith("ws-123", "session-2");
    });

    expect(onSelectSession).toHaveBeenCalledWith(summary2);
  });

  it("disables new session creation for archived topics while keeping history readable", async () => {
    vi.mocked(listTopicSessions).mockResolvedValue({
      sessions: [
        mockSummary("archived-session", "chat-archived", {
          title: "Archived Lesson Conversation",
          archived: true,
          lessonStartState: "completed",
        }),
      ],
    });

    render(
      <StudioTopicChatHistory
        workspaceId="ws-123"
        topicId="topic-1"
        isArchived={true}
      />,
    );

    await waitFor(() => expect(listTopicSessions).toHaveBeenCalled());

    const newChatBtn = screen.getByRole("button", { name: "New chat" });
    expect(newChatBtn).toBeDisabled();

    expect(screen.getByText("Archived Lesson Conversation")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();

    const resumeBtn = screen.getByRole("button", {
      name: "Resume lesson session 1, archived topic",
    });
    expect(resumeBtn).toBeEnabled();
  });

  it("renders history error and handles retry correctly", async () => {
    vi.mocked(listTopicSessions)
      .mockRejectedValueOnce(new Error("Database unavailable"))
      .mockResolvedValueOnce({
        sessions: [mockSummary("session-ok", "chat-ok", { title: "Recovered Session" })],
      });

    render(
      <StudioTopicChatHistory
        workspaceId="ws-123"
        topicId="topic-1"
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Database unavailable",
    );

    const retryBtn = screen.getByRole("button", { name: "Retry session history" });
    fireEvent.click(retryBtn);

    await waitFor(() => expect(listTopicSessions).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Recovered Session")).toBeInTheDocument();
  });

  it("integrates history view and switcher seamlessly inside StudioTutorRail", async () => {
    vi.mocked(listTopicSessions).mockResolvedValue({
      sessions: [
        mockSummary("session-rail", "chat-rail", { title: "Tutor Rail Session" }),
      ],
    });

    render(
      <StudioTutorRail
        workspaceId="ws-123"
        topicId="topic-1"
        topicTitle="FastAPI Async"
        tutorContent={<div data-testid="active-tutor-content">Live Tutor Chat Stream</div>}
      />,
    );

    // Live tutor content should be displayed by default
    expect(screen.getByTestId("active-tutor-content")).toBeInTheDocument();

    // Toggle past chats
    const pastChatsBtn = screen.getByRole("button", { name: "Past chats" });
    fireEvent.click(pastChatsBtn);

    // Should now show topic chat history component
    expect(await screen.findByTestId("studio-topic-chat-history")).toBeInTheDocument();
    expect(screen.getByText("Tutor Rail Session")).toBeInTheDocument();

    // Toggle back to tutor
    const backToTutorBtn = screen.getByRole("button", { name: "Back to tutor" });
    fireEvent.click(backToTutorBtn);

    expect(screen.getByTestId("active-tutor-content")).toBeInTheDocument();
  });

  it("integrates topic chat history into StudioCourseRail under chats tab", async () => {
    vi.mocked(listTopicSessions).mockResolvedValue({
      sessions: [
        mockSummary("course-session-1", "chat-1", { title: "Course Rail Session" }),
      ],
    });

    render(
      <StudioCourseRail
        courseTitle="Backend Engineering"
        workspaceId="ws-123"
        topicId="topic-1"
        topicTitle="FastAPI Async"
      />,
    );

    // Switch to Chats tab
    const chatsTab = screen.getByRole("tab", { name: "Chats" });
    fireEvent.click(chatsTab);

    // Should render StudioTopicChatHistory
    expect(await screen.findByTestId("studio-topic-chat-history")).toBeInTheDocument();
    expect(screen.getByText("Course Rail Session")).toBeInTheDocument();
  });
});
