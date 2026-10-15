import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatsView } from "./chats-view";
import { initial, reducer, topicThreadId } from "./state";
import { allLessons, roadmaps } from "./catalog";
import { scopedKey } from "./state";

describe("Chats view", () => {
  it("projects existing lesson history and offers a working return to its tutor composer", () => {
    let state = reducer(initial, { type: "sign-in" });
    state = reducer(state, { type: "save-roadmap", roadmapId: roadmaps[0].id });
    const topicId = allLessons(roadmaps[0])[0].id;
    const key = scopedKey(state.enrollmentId!, topicId);
    state = { ...state, view: "chats", conversations: { [key]: [{ id: 1, role: "learner", text: "Explain the difference" }, { id: 2, role: "tutor", text: "Here is the distinction." }] } };
    state = reducer(state, { type: "chat-open", id: topicThreadId(key) });
    render(<ChatsView state={state} small={false} onCreate={vi.fn()} onOpen={vi.fn()} onRename={vi.fn()} onDraft={vi.fn()} onSend={vi.fn()} onStop={vi.fn()} onRetry={vi.fn()} onBranch={vi.fn()} onContinueTopic={vi.fn()} onHome={vi.fn()} />);
    expect(screen.getAllByText("Explain the difference").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Continue in lesson" })).toHaveLength(2);
    expect(state.chats).toHaveLength(0);
  });

  it("shows an expandable nested branch tree and offers selected replies as branch origins", async () => {
    let state = reducer(initial, { type: "sign-in" });
    state = reducer(state, { type: "chat-create", id: "root-chat", workspaceId: "personal-workspace" });
    state = reducer(state, { type: "chat-message", id: "root-chat", message: { id: "assistant-root", role: "tutor", text: "A concrete label example is an email field." } });
    const callbacks = { onCreate: vi.fn(), onOpen: vi.fn(), onRename: vi.fn(), onDraft: vi.fn(), onSend: vi.fn(), onStop: vi.fn(), onRetry: vi.fn(), onBranch: vi.fn(), onContinueTopic: vi.fn(), onHome: vi.fn() };
    const view = render(<ChatsView state={state} small={false} {...callbacks} />);
    const paragraph = screen.getByText("A concrete label example is an email field.");
    const textNode = paragraph.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 2);
    range.setEnd(textNode, textNode.textContent!.indexOf(" is"));
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    fireEvent.mouseUp(paragraph);
    fireEvent.click(screen.getByRole("button", { name: /Branch from selection/ }));
    expect(callbacks.onBranch).toHaveBeenCalledWith("root-chat", expect.objectContaining({ id: "assistant-root" }), "concrete label example");

    state = reducer(state, { type: "chat-branch", id: "child-chat", parentThreadId: "root-chat", workspaceId: "personal-workspace", sourceMessageId: "assistant-root", quote: "email field" });
    state = reducer(state, { type: "chat-message", id: "child-chat", message: { id: "assistant-child", role: "tutor", text: "A label names the field's purpose." } });
    state = reducer(state, { type: "chat-branch", id: "nested-chat", parentThreadId: "child-chat", workspaceId: "personal-workspace", sourceMessageId: "assistant-child", quote: "names the field's purpose" });
    state = reducer(state, { type: "chat-rename", id: "nested-chat", title: "Follow-up thread" });
    view.rerender(<ChatsView state={state} small={false} {...callbacks} />);
    expect(await screen.findByRole("button", { name: "Follow-up thread" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Conversation ancestry" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Open branch/ })).toBeTruthy();
  });

  it("does not reopen an existing parent peek on navigation, but opens a newly created child", async () => {
    let state = reducer(initial, { type: "sign-in" });
    state = reducer(state, { type: "chat-create", id: "root-chat", workspaceId: "personal-workspace" });
    state = reducer(state, { type: "chat-message", id: "root-chat", message: { id: "root-reply", role: "tutor", text: "A concrete example explains labels." } });
    state = reducer(state, { type: "chat-branch", id: "existing-child", parentThreadId: "root-chat", workspaceId: "personal-workspace", sourceMessageId: "root-reply", quote: "example" });
    state = reducer(state, { type: "chat-rename", id: "existing-child", title: "Existing branch" });
    state = reducer(state, { type: "chat-open", id: "existing-child" });
    const callbacks = { onCreate: vi.fn(), onOpen: vi.fn(), onRename: vi.fn(), onDraft: vi.fn(), onSend: vi.fn(), onStop: vi.fn(), onRetry: vi.fn(), onBranch: vi.fn(), onContinueTopic: vi.fn(), onHome: vi.fn() };
    const view = render(<ChatsView state={state} small {...callbacks} />);
    expect(screen.queryByRole("dialog", { name: "Parent conversation" })).toBeNull();

    state = reducer(state, { type: "chat-open", id: "root-chat" });
    view.rerender(<ChatsView state={state} small {...callbacks} />);
    expect(screen.queryByRole("dialog", { name: "Child branch" })).toBeNull();

    state = reducer(state, { type: "chat-branch", id: "new-child", parentThreadId: "root-chat", workspaceId: "personal-workspace", sourceMessageId: "root-reply", quote: "labels" });
    state = reducer(state, { type: "chat-rename", id: "new-child", title: "Second branch" });
    view.rerender(<ChatsView state={state} small {...callbacks} />);
    const drawer = await screen.findByRole("dialog", { name: "Child branch" });
    expect(within(drawer).getAllByText("Second branch")).toHaveLength(2);
  });

  it("keeps a course branch in the lesson side pane without showing other workspaces", () => {
    let state = reducer(initial, { type: "sign-in" });
    state = reducer(state, { type: "save-roadmap", roadmapId: roadmaps[0].id });
    const enrollmentId = state.enrollmentId!;
    const topicId = allLessons(roadmaps[0])[0].id;
    state = reducer(state, { type: "open-enrollment", enrollmentId, topicId });
    const key = scopedKey(enrollmentId, topicId);
    state = reducer(state, { type: "tutor-upsert", key, message: { id: 4, role: "tutor", text: "A lesson explanation", status: "complete" } });
    const rootId = topicThreadId(key);
    state = reducer(state, { type: "course-chat-branch", id: "course-child", parentThreadId: rootId, workspaceId: enrollmentId, sourceMessageId: "4", quote: "lesson explanation" });
    state = reducer(state, { type: "chat-message", id: "course-child", message: { id: "child-reply", role: "tutor", text: "A focused child response", status: "complete" } });
    state = { ...state, chats: [...state.chats, { id: "private-personal", workspaceId: "personal-workspace", title: "Personal private thread", kind: "general", messages: [], draft: "", updatedAt: 1 }] };
    const callbacks = { onCreate: vi.fn(), onOpen: vi.fn(), onRename: vi.fn(), onDraft: vi.fn(), onSend: vi.fn(), onStop: vi.fn(), onRetry: vi.fn(), onBranch: vi.fn(), onContinueTopic: vi.fn(), onHome: vi.fn(), onOpenCourse: vi.fn(), onExpandCourse: vi.fn() };
    render(<ChatsView state={state} small={false} scopeId={enrollmentId} coursePanel {...callbacks} />);
    expect(screen.getByText("A focused child response")).toBeTruthy();
    expect(screen.queryByText("Personal private thread")).toBeNull();
    expect(screen.queryByRole("complementary")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Open full conversation/ }));
    expect(callbacks.onExpandCourse).toHaveBeenCalledWith("course-child");

    const mobileView = render(<ChatsView state={state} small scopeId={enrollmentId} coursePanel {...callbacks} />);
    fireEvent.click(screen.getAllByRole("button", { name: /Open full conversation/ })[1]);
    expect(callbacks.onExpandCourse).toHaveBeenCalledTimes(2);
    mobileView.unmount();
  });

  it("does not show the unavailable All chats drawer control in the embedded course pane", () => {
    let state = reducer(initial, { type: "sign-in" });
    state = reducer(state, { type: "save-roadmap", roadmapId: roadmaps[0].id });
    const enrollmentId = state.enrollmentId!;
    state = reducer(state, { type: "course-chat-create", id: "mobile-course-chat" });
    state = reducer(state, { type: "chat-message", id: "mobile-course-chat", message: { id: "mobile-root-reply", role: "tutor", text: "A useful course reply." } });
    state = reducer(state, { type: "chat-branch", id: "mobile-course-child", parentThreadId: "mobile-course-chat", workspaceId: enrollmentId, sourceMessageId: "mobile-root-reply", quote: "course reply" });
    state = reducer(state, { type: "chat-message", id: "mobile-course-child", message: { id: "mobile-child-reply", role: "tutor", text: "A focused follow-up." } });
    state = reducer(state, { type: "course-chat-open", id: "mobile-course-child" });
    const onOpen = vi.fn();
    render(<ChatsView state={state} small embedded scopeId={enrollmentId} onCreate={vi.fn()} onOpen={onOpen} onRename={vi.fn()} onDraft={vi.fn()} onSend={vi.fn()} onStop={vi.fn()} onRetry={vi.fn()} onBranch={vi.fn()} onContinueTopic={vi.fn()} onHome={vi.fn()} onOpenCourse={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "All chats" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Parent" }));
    expect(onOpen).toHaveBeenCalledWith("mobile-course-chat");
  });

  it("shows a searchable, renameable nested course directory and returns to the directory from a thread", () => {
    let state = reducer(initial, { type: "sign-in" });
    state = reducer(state, { type: "save-roadmap", roadmapId: roadmaps[0].id });
    const enrollmentId = state.enrollmentId!;
    state = reducer(state, { type: "course-chat-create", id: "directory-root" });
    state = reducer(state, { type: "chat-rename", id: "directory-root", title: "Foundations" });
    state = reducer(state, { type: "chat-message", id: "directory-root", message: { id: "directory-root-reply", role: "tutor", text: "A useful reply about labels." } });
    state = reducer(state, { type: "chat-branch", id: "directory-child", parentThreadId: "directory-root", workspaceId: enrollmentId, sourceMessageId: "directory-root-reply", quote: "about labels" });
    state = reducer(state, { type: "chat-rename", id: "directory-child", title: "Email fields" });
    state = reducer(state, { type: "course-chat-open", id: "directory-child" });
    state = reducer(state, { type: "course-conversations" });
    expect(state.view).toBe("chats");
    expect(state.activeChatId).toBeUndefined();
    const onOpenCourse = vi.fn();
    const onRename = vi.fn();
    render(<ChatsView state={state} small scopeId={enrollmentId} embedded onCreate={vi.fn()} onOpen={vi.fn()} onRename={onRename} onDraft={vi.fn()} onSend={vi.fn()} onStop={vi.fn()} onRetry={vi.fn()} onBranch={vi.fn()} onContinueTopic={vi.fn()} onHome={vi.fn()} onOpenCourse={onOpenCourse} />);
    expect(screen.queryByRole("complementary")).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Search chats" }), { target: { value: "Email fields" } });
    expect(screen.getByRole("button", { name: "Foundations" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Rename Foundations" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Chat title" }), { target: { value: "Course foundations" } });
    fireEvent.click(screen.getByRole("button", { name: "Save chat title" }));
    expect(onRename).toHaveBeenCalledWith("directory-root", "Course foundations");
    fireEvent.click(screen.getByRole("button", { name: "Email fields" }));
    expect(onOpenCourse).toHaveBeenCalledWith("directory-child");
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect((screen.getByRole("textbox", { name: "Search chats" }) as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("button", { name: "Foundations" })).toBeTruthy();
  });
});
