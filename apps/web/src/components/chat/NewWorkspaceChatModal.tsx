"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { MessageSquarePlus } from "lucide-react";
import type { GraphSnapshotNode } from "@/lib/workspaceApi";
import { apiFetch } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";

export interface NewWorkspaceChatCreated {
  workspaceId: string;
  rootNodeId: string;
  prompt: string;
  provider: string;
  model: string;
  roadmapTopicIds: string[];
}

export interface NewWorkspaceChatTopic {
  id: string;
  title: string;
  brief: string;
}

interface NewWorkspaceChatModalProps {
  isOpen: boolean;
  workspaceId: string;
  provider: string;
  model: string;
  roadmapTopics?: NewWorkspaceChatTopic[];
  isWorkspaceCurrent: (workspaceId: string) => boolean;
  onClose: () => void;
  onCreated: (chat: NewWorkspaceChatCreated) => void | Promise<void>;
}

interface DraftRequest {
  workspaceId: string;
  prompt: string;
  id: string;
}

function createRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `node_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

/**
 * Creates a persisted general-chat root before handing control to navigation.
 * The request ID is retained for retries of the same draft, making a replay
 * after an ambiguous network failure safe against duplicate roots.
 */
export function NewWorkspaceChatModal({
  isOpen,
  workspaceId,
  provider,
  model,
  roadmapTopics = [],
  isWorkspaceCurrent,
  onClose,
  onCreated,
}: NewWorkspaceChatModalProps) {
  const [prompt, setPrompt] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const operationRef = useRef(0);
  const draftRequestRef = useRef<DraftRequest | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    operationRef.current += 1;
    inFlightRef.current = false;
    setIsSaving(false);
    setError(null);
    setSelectedTopicIds([]);
  }, [workspaceId, isOpen]);

  const close = () => {
    operationRef.current += 1;
    inFlightRef.current = false;
    setIsSaving(false);
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || inFlightRef.current) return;

    const previousDraft = draftRequestRef.current;
    const request =
      previousDraft?.workspaceId === workspaceId &&
      previousDraft.prompt === trimmedPrompt
        ? previousDraft
        : { workspaceId, prompt: trimmedPrompt, id: createRequestId() };
    draftRequestRef.current = request;
    const operation = ++operationRef.current;
    inFlightRef.current = true;
    setError(null);
    setIsSaving(true);

    try {
      const savedRoot = await apiFetch<GraphSnapshotNode>(
        `/workspaces/${workspaceId}/nodes`,
        {
          method: "POST",
          body: JSON.stringify({
            id: request.id,
            parentId: null,
            role: "user",
            content: trimmedPrompt,
            highlightedContext: null,
            provider,
            model,
            positionX: 0,
            positionY: 0,
            metadata: { roadmapTopicIds: selectedTopicIds },
          }),
        },
      );

      // The root is now durably created. Do not reuse this id if the handoff
      // closes the modal before this handler resumes, or if navigation fails.
      if (draftRequestRef.current === request) draftRequestRef.current = null;
      if (
        operation !== operationRef.current ||
        !isWorkspaceCurrent(workspaceId)
      ) {
        return;
      }
      if (operation === operationRef.current) setPrompt("");

      await onCreated({
        workspaceId,
        rootNodeId: savedRoot.id,
        prompt: trimmedPrompt,
        provider,
        model,
        roadmapTopicIds: [...selectedTopicIds],
      });
      if (operation === operationRef.current) {
        close();
      }
    } catch (submitError) {
      if (operation === operationRef.current) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Could not save this conversation. Please try again.",
        );
      }
    } finally {
      if (operation === operationRef.current) {
        inFlightRef.current = false;
        setIsSaving(false);
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      size="lg"
      closeOnClickOutside={!isSaving}
      ariaLabel="Start a general conversation"
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
        <ModalHeader
          title="Start a conversation"
          description="Ask anything about your workspace or beyond."
          icon={<MessageSquarePlus aria-hidden="true" />}
          onClose={close}
        />
        <ModalBody className="space-y-3">
          <label htmlFor="new-workspace-chat-prompt" className="text-sm font-medium">
            Your first message
          </label>
          <Textarea
            id="new-workspace-chat-prompt"
            autoFocus
            value={prompt}
            onChange={(event) => {
              setPrompt(event.target.value);
              setError(null);
            }}
            placeholder="What would you like to explore?"
            disabled={isSaving}
            rows={5}
            aria-describedby={error ? "new-workspace-chat-error" : undefined}
          />
          {roadmapTopics.length > 0 && (
            <fieldset className="space-y-1 rounded-xl border border-border-subtle p-3">
              <legend className="px-1 text-sm font-medium">
                Roadmap topic context <span className="text-xs text-foreground-muted">(optional, up to 3)</span>
              </legend>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {roadmapTopics.map((topic) => {
                  const checked = selectedTopicIds.includes(topic.id);
                  const atLimit = selectedTopicIds.length >= 3 && !checked;
                  return (
                    <label
                      key={topic.id}
                      className="flex items-start gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-hover"
                    >
                      <Input
                        type="checkbox"
                        className="mt-0.5 size-4 w-4 accent-primary"
                        checked={checked}
                        disabled={isSaving || atLimit}
                        onChange={(event) =>
                          setSelectedTopicIds((current) =>
                            event.target.checked
                              ? current.length < 3 && !current.includes(topic.id)
                                ? [...current, topic.id]
                                : current
                              : current.filter((id) => id !== topic.id),
                          )
                        }
                        aria-label={`Include ${topic.title} in conversation context`}
                      />
                      <span className="min-w-0">
                        <span className="block font-medium text-foreground">{topic.title}</span>
                        <span className="block text-xs text-foreground-muted">{topic.brief}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
          {error && (
            <p id="new-workspace-chat-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" loading={isSaving} loadingLabel="Saving conversation" disabled={!prompt.trim()}>
            Start chat
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
