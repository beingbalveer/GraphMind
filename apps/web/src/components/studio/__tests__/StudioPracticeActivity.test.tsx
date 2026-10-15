import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StudioPracticeActivity } from "../StudioPracticeActivity";
import * as roadmapApi from "@/lib/roadmapApi";
import type { PracticeStateData, KnowledgeCheckData } from "@/lib/roadmapTypes";

vi.mock("@/lib/roadmapApi", () => ({
  readTopicPracticeState: vi.fn(),
  savePracticeDraft: vi.fn(),
  deletePracticeDraft: vi.fn(),
  submitPracticeAttempt: vi.fn(),
}));

describe("StudioPracticeActivity", () => {
  const mockChoiceState: PracticeStateData = {
    topicId: "topic_py_01",
    activity: {
      id: "act_py_01",
      version: "2026-10-15.1",
      topicId: "topic_py_01",
      kind: "choice",
      prompt: "Which of the following built-in Python sequences is immutable?",
      choices: ["list", "tuple", "dict", "bytearray"],
      hint: "Think about which container cannot be modified in-place after creation.",
      explanation: "A tuple is an immutable sequence in Python; items cannot be added, removed, or reassigned.",
    },
    draft: null,
    attemptsCount: 0,
    latestAttempt: null,
    checks: [],
  };

  const mockShortAnswerState: PracticeStateData = {
    topicId: "topic_py_02",
    activity: {
      id: "act_py_02",
      version: "2026-10-15.1",
      topicId: "topic_py_02",
      kind: "short_answer",
      prompt: "Explain why coroutines must be awaited or scheduled onto an event loop to execute.",
      hint: "Calling a coroutine function returns a coroutine object rather than running its body immediately.",
      explanation: "Coroutines in Python are generators under the hood; execution is driven cooperatively by the event loop.",
    },
    draft: {
      topicId: "topic_py_02",
      activityId: "act_py_02",
      activityVersion: "2026-10-15.1",
      draft: "Because calling a coroutine only creates an un-evaluated generator object.",
      selectedChoice: null,
      updatedAt: "2026-10-15T12:00:00Z",
    },
    attemptsCount: 1,
    latestAttempt: null,
    checks: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and renders choice activity with choices and hint toggle", async () => {
    vi.mocked(roadmapApi.readTopicPracticeState).mockResolvedValueOnce(mockChoiceState);

    render(
      <StudioPracticeActivity
        workspaceId="ws_1"
        topicId="topic_py_01"
        topicTitle="Data Structures"
      />
    );

    expect(screen.getByText("Loading practice activity...")).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText("Which of the following built-in Python sequences is immutable?")
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Multiple Choice Check")).toBeInTheDocument();
    expect(screen.getByText("tuple")).toBeInTheDocument();
    expect(screen.getByText("list")).toBeInTheDocument();

    // Toggle hint
    const hintBtn = screen.getByRole("button", { name: /need a hint/i });
    expect(hintBtn).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(hintBtn);

    expect(hintBtn).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText(/Think about which container cannot be modified in-place/)
    ).toBeInTheDocument();

    fireEvent.click(hintBtn);
    expect(hintBtn).toHaveAttribute("aria-expanded", "false");
  });

  it("handles choice selection and submits practice attempt successfully", async () => {
    vi.mocked(roadmapApi.readTopicPracticeState).mockResolvedValueOnce(mockChoiceState);

    const mockResponse: KnowledgeCheckData = {
      id: "chk_101",
      topicId: "topic_py_01",
      createdAt: "2026-10-15T12:30:00Z",
      rubric: {},
      result: {
        assessmentType: "practice-activity",
        attemptId: "attempt_1",
        attemptNumber: 1,
        activityId: "act_py_01",
        activityVersion: "2026-10-15.1",
        selectedChoice: "tuple",
        correct: true,
        feedback: "Correct! That matches the Python object model.",
        explanation: "A tuple is an immutable sequence in Python.",
        canRetry: true,
        nextAction: "continue",
      },
    };
    vi.mocked(roadmapApi.submitPracticeAttempt).mockResolvedValueOnce(mockResponse);

    render(
      <StudioPracticeActivity
        workspaceId="ws_1"
        topicId="topic_py_01"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("tuple")).toBeInTheDocument();
    });

    const checkBtn = screen.getByRole("button", { name: /check answer/i });
    expect(checkBtn).toBeDisabled();

    // Select "tuple"
    const tupleOption = screen.getByRole("radio", { name: /tuple/i });
    fireEvent.click(tupleOption);
    expect(checkBtn).not.toBeDisabled();

    // Submit attempt
    fireEvent.click(checkBtn);

    await waitFor(() => {
      expect(roadmapApi.submitPracticeAttempt).toHaveBeenCalledWith(
        "ws_1",
        "topic_py_01",
        expect.objectContaining({
          activityId: "act_py_01",
          activityVersion: "2026-10-15.1",
          selectedChoice: "tuple",
        })
      );
    });

    // Feedback rendered in role="status"
    const statusBox = screen.getByRole("status");
    expect(statusBox).toHaveTextContent("Great check! Your reasoning matches.");
    expect(statusBox).toHaveTextContent("Correct! That matches the Python object model.");
    expect(statusBox).toHaveTextContent("Explanation: A tuple is an immutable sequence in Python.");
    expect(statusBox).toHaveTextContent("Attempt #1");
  });

  it("loads existing draft into short_answer activity and autosaves modifications", async () => {
    vi.mocked(roadmapApi.readTopicPracticeState).mockResolvedValueOnce(mockShortAnswerState);
    vi.mocked(roadmapApi.savePracticeDraft).mockResolvedValueOnce({
      topicId: "topic_py_02",
      activityId: "act_py_02",
      activityVersion: "2026-10-15.1",
      draft: "Updated draft response",
      selectedChoice: null,
      updatedAt: "2026-10-15T12:05:00Z",
    });

    render(
      <StudioPracticeActivity
        workspaceId="ws_1"
        topicId="topic_py_02"
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText("Explain why coroutines must be awaited or scheduled onto an event loop to execute.")
      ).toBeInTheDocument();
    });

    // Verify existing draft loaded
    const textarea = screen.getByLabelText("Your practice answer");
    expect(textarea).toHaveValue(
      "Because calling a coroutine only creates an un-evaluated generator object."
    );

    // Edit textarea
    fireEvent.change(textarea, { target: { value: "Updated draft response" } });

    // Wait for debounced draft autosave
    await waitFor(
      () => {
        expect(roadmapApi.savePracticeDraft).toHaveBeenCalledWith(
          "ws_1",
          "topic_py_02",
          expect.objectContaining({
            activityId: "act_py_02",
            activityVersion: "2026-10-15.1",
            draft: "Updated draft response",
          })
        );
      },
      { timeout: 1500 }
    );
  });

  it("handles retry flow and start over draft reset", async () => {
    const stateWithAttempt: PracticeStateData = {
      ...mockChoiceState,
      attemptsCount: 1,
      latestAttempt: {
        id: "chk_099",
        attemptId: "att_099",
        attemptNumber: 1,
        activityId: "act_py_01",
        activityVersion: "2026-10-15.1",
        selectedChoice: "list",
        correct: false,
        feedback: "Lists can be resized and mutated via append() or slice assignment.",
        explanation: "Try again. Look for the container that does not support item assignment.",
        canRetry: true,
        nextAction: "retry",
        submittedAt: "2026-10-15T11:00:00Z",
      },
    };
    vi.mocked(roadmapApi.readTopicPracticeState).mockResolvedValueOnce(stateWithAttempt);
    vi.mocked(roadmapApi.deletePracticeDraft).mockResolvedValueOnce();

    render(
      <StudioPracticeActivity
        workspaceId="ws_1"
        topicId="topic_py_01"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Review and try once more")).toBeInTheDocument();
    });

    expect(screen.getByText(/Lists can be resized and mutated/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /check again/i })).toBeInTheDocument();

    // Click "Start over"
    const startOverBtn = screen.getByRole("button", { name: /start over/i });
    fireEvent.click(startOverBtn);

    expect(roadmapApi.deletePracticeDraft).toHaveBeenCalledWith("ws_1", "topic_py_01");
    expect(screen.queryByText("Review and try once more")).not.toBeInTheDocument();
  });

  it("renders honest empty state when practice activity has no prompt", async () => {
    const unconfiguredState: PracticeStateData = {
      topicId: "topic_py_empty",
      activity: {
        id: "act_empty",
        version: "1.0",
        topicId: "topic_py_empty",
        kind: "reflection",
        prompt: "",
      },
      attemptsCount: 0,
      checks: [],
    };
    vi.mocked(roadmapApi.readTopicPracticeState).mockResolvedValueOnce(unconfiguredState);

    render(
      <StudioPracticeActivity
        workspaceId="ws_1"
        topicId="topic_py_empty"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Practice activity not yet configured")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/No interactive practice activity is available for this topic yet/)
    ).toBeInTheDocument();
  });

  it("renders locked state when enabled is false and triggers onEnablePractice", async () => {
    vi.mocked(roadmapApi.readTopicPracticeState).mockResolvedValueOnce(mockChoiceState);
    const onEnablePractice = vi.fn();

    render(
      <StudioPracticeActivity
        workspaceId="ws_1"
        topicId="topic_py_01"
        enabled={false}
        onEnablePractice={onEnablePractice}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Private practice is locked")).toBeInTheDocument();
    });

    const enableBtn = screen.getByRole("button", { name: /enable private practice/i });
    fireEvent.click(enableBtn);
    expect(onEnablePractice).toHaveBeenCalled();
  });

  it("enforces decoupling and displays anti-mastery disclaimer", async () => {
    vi.mocked(roadmapApi.readTopicPracticeState).mockResolvedValueOnce(mockChoiceState);

    render(
      <StudioPracticeActivity
        workspaceId="ws_1"
        topicId="topic_py_01"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Practice checks are self-directed exercises for reinforcement/)).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Submitting an answer does not automatically complete the topic or infer mastery\./)
    ).toBeInTheDocument();
  });
});
