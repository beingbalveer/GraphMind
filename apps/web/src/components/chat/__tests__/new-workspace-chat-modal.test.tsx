import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NewWorkspaceChatModal } from "../NewWorkspaceChatModal";
import { apiFetch } from "@/lib/apiClient";

vi.mock("@/lib/apiClient", () => ({ apiFetch: vi.fn() }));

afterEach(() => vi.resetAllMocks());

const baseProps = {
  isOpen: true,
  workspaceId: "workspace-1",
  provider: "gemini",
  model: "gemini-2.5-flash",
  roadmapTopics: [
    { id: "topic-a", title: "Topic A", brief: "First topic" },
    { id: "topic-b", title: "Topic B", brief: "Second topic" },
    { id: "topic-c", title: "Topic C", brief: "Third topic" },
    { id: "topic-d", title: "Topic D", brief: "Fourth topic" },
  ],
  isWorkspaceCurrent: () => true,
  onClose: vi.fn(),
  onCreated: vi.fn(),
};

it("saves the actual first prompt before handing the root to navigation", async () => {
  vi.mocked(apiFetch).mockResolvedValue({ id: "root-1" });
  const onCreated = vi.fn();
  render(<NewWorkspaceChatModal {...baseProps} onCreated={onCreated} />);

  fireEvent.change(screen.getByLabelText("Your first message"), {
    target: { value: "  Explain graph theory  " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Start chat" }));

  await waitFor(() => expect(onCreated).toHaveBeenCalledWith({
    workspaceId: "workspace-1",
    rootNodeId: "root-1",
    prompt: "Explain graph theory",
    provider: "gemini",
    model: "gemini-2.5-flash",
    roadmapTopicIds: [],
  }));
  expect(apiFetch).toHaveBeenCalledWith(
    "/workspaces/workspace-1/nodes",
    expect.objectContaining({ method: "POST" }),
  );
  const payload = JSON.parse(vi.mocked(apiFetch).mock.calls[0][1]?.body as string);
  expect(payload).toMatchObject({
    parentId: null,
    role: "user",
    content: "Explain graph theory",
    metadata: { roadmapTopicIds: [] },
  });
  expect(payload.id).toBeTruthy();
});

it("persists up to three selected topics with the first root before onCreated", async () => {
  vi.mocked(apiFetch).mockResolvedValue({ id: "root-topics" });
  const onCreated = vi.fn();
  render(<NewWorkspaceChatModal {...baseProps} onCreated={onCreated} />);

  fireEvent.change(screen.getByLabelText("Your first message"), {
    target: { value: "Help me connect these topics" },
  });
  fireEvent.click(screen.getByLabelText("Include Topic A in conversation context"));
  fireEvent.click(screen.getByLabelText("Include Topic B in conversation context"));
  fireEvent.click(screen.getByLabelText("Include Topic C in conversation context"));
  expect(screen.getByLabelText("Include Topic D in conversation context")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Start chat" }));

  await waitFor(() => expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({
    rootNodeId: "root-topics",
    roadmapTopicIds: ["topic-a", "topic-b", "topic-c"],
  })));
  const payload = JSON.parse(vi.mocked(apiFetch).mock.calls[0][1]?.body as string);
  expect(payload.metadata).toEqual({ roadmapTopicIds: ["topic-a", "topic-b", "topic-c"] });
});

it("keeps the draft after a failed save and retries with the same root ID", async () => {
  vi.mocked(apiFetch)
    .mockRejectedValueOnce(new Error("workspace is read-only"))
    .mockResolvedValueOnce({ id: "root-2" });
  const onCreated = vi.fn();
  render(<NewWorkspaceChatModal {...baseProps} onCreated={onCreated} />);
  const prompt = screen.getByLabelText("Your first message");
  fireEvent.change(prompt, { target: { value: "Compare these ideas" } });

  fireEvent.click(screen.getByRole("button", { name: "Start chat" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("workspace is read-only");
  expect(prompt).toHaveValue("Compare these ideas");

  fireEvent.click(screen.getByRole("button", { name: "Start chat" }));
  await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
  const firstPayload = JSON.parse(vi.mocked(apiFetch).mock.calls[0][1]?.body as string);
  const retryPayload = JSON.parse(vi.mocked(apiFetch).mock.calls[1][1]?.body as string);
  expect(retryPayload.id).toBe(firstPayload.id);
});

it("does not navigate when a pending save completes after cancel", async () => {
  let resolveSave!: (value: { id: string }) => void;
  vi.mocked(apiFetch).mockReturnValue(
    new Promise((resolve) => {
      resolveSave = resolve;
    }),
  );
  const onClose = vi.fn();
  const onCreated = vi.fn();
  render(
    <NewWorkspaceChatModal {...baseProps} onClose={onClose} onCreated={onCreated} />,
  );
  fireEvent.change(screen.getByLabelText("Your first message"), {
    target: { value: "Keep this conversation" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Start chat" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

  await act(async () => resolveSave({ id: "late-root" }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onCreated).not.toHaveBeenCalled();
});
