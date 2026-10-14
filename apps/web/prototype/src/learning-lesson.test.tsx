import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { roadmaps, allLessons } from "./catalog";
import { Conversation, LearningLesson, MyLearning } from "./learner-views";
import { LessonActivity, type ActivityProgress } from "./lesson-activity";
import { initial, scopedKey, type State } from "./state";

describe("lesson practice", () => {
  it("checks an answer, explains a miss, and allows a meaningful retry", () => {
    let progress: ActivityProgress | undefined;
    const onChange = vi.fn((next: ActivityProgress) => { progress = next; });
    const { rerender } = render(<LessonActivity topicId="py-01" enabled progress={progress} onChange={onChange} onEnablePractice={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "An error because spaces are present" }));
    rerender(<LessonActivity topicId="py-01" enabled progress={progress} onChange={onChange} onEnablePractice={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
    expect(progress).toMatchObject({ attempts: 1, submitted: true, correct: false });
    rerender(<LessonActivity topicId="py-01" enabled progress={progress} onChange={onChange} onEnablePractice={vi.fn()} />);
    expect(screen.getByText(/strip\(\) removes the surrounding spaces/)).toBeTruthy();
    expect(screen.getByText(/That option does not match this example/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show hint" }));
    expect(screen.getByText("Apply strip before lower.")).toBeTruthy();
    rerender(<LessonActivity topicId="py-01" enabled progress={progress} onChange={onChange} onEnablePractice={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "ada@example.com" }));
    rerender(<LessonActivity topicId="py-01" enabled progress={progress} onChange={onChange} onEnablePractice={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
    expect(progress).toMatchObject({ attempts: 2, submitted: true, correct: true });
    rerender(<LessonActivity topicId="py-01" enabled progress={progress} onChange={onChange} onEnablePractice={vi.fn()} />);
    expect(screen.getByText("This check uses a fixed example answer and explanation; it is not an AI assessment.")).toBeTruthy();
    const checkCount = onChange.mock.calls.length;
    expect(screen.getByRole("button", { name: "Answer checked" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Answer checked" }));
    expect(onChange).toHaveBeenCalledTimes(checkCount);
  });

  it("keeps the draft controlled and asks the parent to enable private practice", () => {
    const onChange = vi.fn();
    const onEnablePractice = vi.fn();
    const { rerender } = render(<LessonActivity topicId="py-04" enabled progress={{ draft: "", attempts: 0, submitted: false }} onChange={onChange} onEnablePractice={onEnablePractice} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Your practice answer" }), { target: { value: "assert empty boundary" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ draft: "assert empty boundary" }));
    rerender(<LessonActivity topicId="py-04" enabled={false} onChange={onChange} onEnablePractice={onEnablePractice} />);
    fireEvent.click(screen.getByRole("button", { name: "Enable private practice" }));
    expect(onEnablePractice).toHaveBeenCalledOnce();
    expect(screen.queryByRole("textbox", { name: "Your practice answer" })).toBeNull();
  });
});

describe("lesson navigation and completion", () => {
  it("disables sending while the tutor is busy and exposes stop", () => {
    const send = vi.fn();
    const onStop = vi.fn();
    const onRetry = vi.fn();
    render(<Conversation state={{ ...initial, roadmapId: roadmaps[0].id, topicId: allLessons(roadmaps[0])[0].id }} messages={[]} prompt="A question" setPrompt={vi.fn()} send={send} busy onStop={onStop} error="Tutor request failed" onRetry={onRetry} onReturn={vi.fn()} onTopic={vi.fn()} clearQuote={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Send message" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Stop generating" }));
    expect(onStop).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Retry response" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert").textContent).toContain("Tutor request failed");
    fireEvent.submit(screen.getByRole("textbox", { name: "Write a message in this lesson conversation" }).closest("form")!);
    expect(send).not.toHaveBeenCalled();
  });

  it("does not complete a lesson when continuing; completion remains explicit", () => {
    const onComplete = vi.fn();
    const props = {
      roadmapId: roadmaps[0].id,
      topicId: allLessons(roadmaps[0])[0].id,
      guest: false,
      onPrev: vi.fn(), onRoadmap: vi.fn(), onNext: vi.fn(), onComplete,
      onAsk: vi.fn(), onQuote: vi.fn(), note: false, onNote: vi.fn(),
      onActivityChange: vi.fn(), onEnablePractice: vi.fn(),
    };
    render(<LearningLesson {...props} enrollment={{ id: "copy-1", templateId: roadmaps[0].id, sourceSnapshotRef: "snapshot", title: "Python copy", completedTopicIds: [] }} />);
    fireEvent.click(screen.getByRole("button", { name: /Continue to next lesson/ }));
    expect(props.onNext).toHaveBeenCalledOnce();
    expect(onComplete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Mark complete" }));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("explains missing passage selection and excludes practice text from quote capture", () => {
    const onQuote = vi.fn();
    const onAsk = vi.fn();
    const props = {
      roadmapId: roadmaps[0].id,
      topicId: allLessons(roadmaps[0])[0].id,
      guest: false,
      enrollment: { id: "copy-1", templateId: roadmaps[0].id, sourceSnapshotRef: "snapshot", title: "Python copy", completedTopicIds: [] },
      onPrev: vi.fn(), onRoadmap: vi.fn(), onNext: vi.fn(), onComplete: vi.fn(),
      onAsk, onQuote, note: false, onNote: vi.fn(), onActivityChange: vi.fn(), onEnablePractice: vi.fn(),
    };
    render(<LearningLesson {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask about selected passage" }));
    expect(screen.getByRole("status").textContent).toContain("Select text from the lesson reading first");
    const practicePrompt = screen.getByText(/What does normalize_email/);
    const range = document.createRange();
    range.selectNodeContents(practicePrompt);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    fireEvent.click(screen.getByRole("button", { name: "Ask about selected passage" }));
    expect(onQuote).not.toHaveBeenCalled();
    expect(onAsk).not.toHaveBeenCalled();
  });
});

describe("collection study status", () => {
  it("shows an attempted but incomplete activity as in progress while completion remains zero", () => {
    const course = roadmaps[0];
    const topic = allLessons(course)[0];
    const enrollment = { id: "copy-1", templateId: course.id, sourceSnapshotRef: "snapshot", title: "Python copy", completedTopicIds: [] };
    const key = scopedKey(enrollment.id, topic.id);
    const state: State = {
      ...initial,
      mode: "learner",
      enrollmentId: enrollment.id,
      enrollments: [enrollment],
      activity: { [key]: { draft: "", selectedAnswer: "A wrong choice", attempts: 2, submitted: true, correct: false } },
    };
    render(<MyLearning state={state} onOpen={vi.fn()} onBrowse={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "In progress" }));
    expect(screen.getByText("0/12 complete")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Resume learning" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Not started" }));
    expect(screen.queryByText("Python copy")).toBeNull();
    expect(screen.getByText("No matching roadmaps")).toBeTruthy();
  });
});
