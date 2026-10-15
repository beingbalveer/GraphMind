import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StudioRoadmapEditing } from "../StudioRoadmapEditing";
import { StudioCourseListView } from "../StudioCourseListView";
import { StudioLessonReader } from "../StudioLessonReader";
import { ApiError } from "@/lib/apiClient";
import * as roadmapApi from "@/lib/roadmapApi";
import type { CurriculumView } from "@/lib/roadmapTypes";

vi.mock("@/lib/roadmapApi", () => ({
  saveRoadmapEdits: vi.fn(),
  inspectRoadmapSource: vi.fn(),
  listRoadmapRevisions: vi.fn(),
  readArchivedTopics: vi.fn(),
  restoreRoadmapRevision: vi.fn(),
  readTopicPracticeState: vi.fn(),
  savePracticeDraft: vi.fn(),
  deletePracticeDraft: vi.fn(),
  submitPracticeAttempt: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

function fixture(): CurriculumView {
  return {
    roadmapId: "roadmap",
    workspaceId: "ws",
    canWrite: true,
    canvasAnchorChatId: "anchor",
    revisionId: "rev_original",
    profile: {
      title: "Drawing",
      prompt: "Learn drawing",
      level: "beginner",
      background: null,
      duration: null,
      hoursPerWeek: null,
      studyWeeks: null,
      weeklyMinutes: null,
      outcome: "Draw from observation",
      assumptions: [],
      knownSkills: [],
    },
    candidate: {
      title: "Drawing",
      outcome: "Draw from observation",
      assumptions: [],
      items: [
        {
          id: "root",
          kind: "root",
          order: 0,
          path: "core",
          title: "Drawing",
          brief: "",
          objectives: [],
          exercise: null,
          format: null,
          estimateMinutes: null,
          participation: "active",
        },
        {
          id: "phase",
          kind: "phase",
          order: 0,
          path: "core",
          title: "Phase one",
          brief: "",
          objectives: [],
          exercise: null,
          format: null,
          estimateMinutes: null,
          participation: "active",
        },
        {
          id: "chosen",
          kind: "topic",
          order: 0,
          path: "core",
          title: "Line control",
          brief: "Learn line control",
          objectives: ["Explain line control"],
          exercise: "Practice",
          format: "concepts",
          estimateMinutes: 30,
          participation: "active",
        },
      ],
      relations: [
        { sourceId: "root", targetId: "phase", kind: "contains" },
        { sourceId: "phase", targetId: "chosen", kind: "contains" },
      ],
      choices: [],
      sessions: [],
      resources: [],
    },
    sources: [],
    progress: {
      chosen: {
        topicId: "chosen",
        status: "completed",
        completedAt: "2026-10-08T00:00:00Z",
      },
    },
    validation: {
      valid: true,
      issues: [],
      coreMinutes: 30,
      capacityMinutes: null,
    },
    origins: [],
  };
}

function openMenu(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger, {
    button: 0,
    ctrlKey: false,
    pointerType: "mouse",
  });
}

describe("StudioRoadmapEditing (LSI-036)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(roadmapApi.readTopicPracticeState).mockResolvedValue({
      topicId: "chosen",
      activity: {
        id: "act_chosen",
        version: "2026-10-15.1",
        topicId: "chosen",
        kind: "reflection",
        prompt: "Reflect on line control.",
      },
      draft: null,
      attemptsCount: 0,
      latestAttempt: null,
      checks: [],
    });
  });

  it("edits a lesson through the existing topic editor and reports the new revision", async () => {
    const view = fixture();
    const edited = structuredClone(view);
    edited.revisionId = "rev_next";
    edited.candidate.items.find((i) => i.id === "chosen")!.title =
      "Focused line control";
    const changed = vi.fn();
    vi.mocked(roadmapApi.saveRoadmapEdits).mockResolvedValue(edited);

    render(
      <StudioRoadmapEditing view={view} topicId="chosen" onSaved={changed} />
    );

    openMenu(screen.getByTestId("studio-roadmap-editing"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit lesson" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
      target: { value: "Focused line control" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(changed).toHaveBeenCalledWith(
        expect.objectContaining({ revisionId: "rev_next" })
      )
    );
    expect(roadmapApi.saveRoadmapEdits).toHaveBeenCalledWith(
      "ws",
      expect.objectContaining({
        baseRevisionId: "rev_original",
        patches: expect.arrayContaining([
          expect.objectContaining({
            op: "update_item",
            itemId: "chosen",
            title: "Focused line control",
          }),
        ]),
      })
    );
  });

  it("recovers a stale edit through reload instead of overwriting silently", async () => {
    const view = fixture();
    const reload = vi.fn().mockResolvedValue(undefined);
    vi.mocked(roadmapApi.saveRoadmapEdits).mockRejectedValue(
      new ApiError(409, "Roadmap changed", { code: "REVISION_CONFLICT" })
    );

    render(
      <StudioRoadmapEditing
        view={view}
        topicId="chosen"
        onSaved={vi.fn()}
        onReload={reload}
      />
    );

    openMenu(screen.getByTestId("studio-roadmap-editing"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit lesson" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
      target: { value: "Unsaved work" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Roadmap changed"
    );
    // The draft is retained and no silent overwrite happened.
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue(
      "Unsaved work"
    );
    expect(reload).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Reload latest and discard draft" })
    );
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it("restores an earlier revision through the shared revision history", async () => {
    const view = fixture();
    const restored = structuredClone(view);
    restored.revisionId = "rev_restored";
    const changed = vi.fn();
    vi.mocked(roadmapApi.listRoadmapRevisions).mockResolvedValue([
      {
        id: view.revisionId,
        baseRevisionId: "rev_previous",
        status: "active",
        title: "Drawing",
        createdAt: "2026-10-08T00:00:00Z",
        added: [],
        changed: ["chosen"],
        removed: [],
        hasLearningHistory: false,
      },
    ]);
    vi.mocked(roadmapApi.readArchivedTopics).mockResolvedValue([]);
    vi.mocked(roadmapApi.restoreRoadmapRevision).mockResolvedValue(restored);

    render(<StudioRoadmapEditing view={view} onSaved={changed} />);

    openMenu(screen.getByTestId("studio-roadmap-editing"));
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Revision history" })
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Undo last change" })
    );

    await waitFor(() =>
      expect(changed).toHaveBeenCalledWith(restored)
    );
    expect(roadmapApi.restoreRoadmapRevision).toHaveBeenCalledWith(
      "ws",
      "rev_previous",
      "rev_original",
      false
    );
  });
});

describe("LSI-036 current-revision projection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(roadmapApi.readTopicPracticeState).mockResolvedValue({
      topicId: "chosen",
      activity: {
        id: "act_chosen",
        version: "2026-10-15.1",
        topicId: "chosen",
        kind: "reflection",
        prompt: "Reflect on line control.",
      },
      draft: null,
      attemptsCount: 0,
      latestAttempt: null,
      checks: [],
    });
  });

  it("updates Lesson and List coherently after an edit is saved", async () => {
    const initial = fixture();
    const edited = structuredClone(initial);
    edited.revisionId = "rev_next";
    edited.candidate.items.find((i) => i.id === "chosen")!.title =
      "Focused line control";
    vi.mocked(roadmapApi.saveRoadmapEdits).mockResolvedValue(edited);

    function Harness() {
      const [view, setView] = useState<CurriculumView>(initial);
      const topic = view.candidate.items.find((i) => i.id === "chosen")!;
      return (
        <>
          <StudioCourseListView view={view} mode="list" onSelectTopic={vi.fn()} />
          <StudioLessonReader
            workspaceId={view.workspaceId}
            topic={topic}
            view={view}
            onSaved={setView}
          />
        </>
      );
    }

    render(<Harness />);

    // Only the Lesson surface exposes the editing control in this harness.
    expect(screen.getAllByTestId("studio-roadmap-editing")).toHaveLength(1);
    expect(screen.getAllByText("Line control").length).toBeGreaterThan(0);

    openMenu(screen.getByTestId("studio-roadmap-editing"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit lesson" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
      target: { value: "Focused line control" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    // Both surfaces now project the same current revision and title.
    await waitFor(() =>
      expect(screen.getAllByText("Focused line control").length).toBeGreaterThan(0)
    );
    expect(screen.getByText(/Revision rev_next/)).toBeInTheDocument();
    expect(screen.queryByText("Line control")).not.toBeInTheDocument();
  });
});
