"use client";

import { useState } from "react";
import { History, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { TopicEditor } from "@/components/roadmap/TopicEditor";
import { RevisionHistory } from "@/components/roadmap/RevisionHistory";
import type { CurriculumView } from "@/lib/roadmapTypes";

export interface StudioRoadmapEditingProps {
  view: CurriculumView;
  /**
   * When provided, exposes a lesson-scoped "Edit lesson" action for this topic.
   * The List and Canvas surfaces omit it and offer topic creation + history.
   */
  topicId?: string | null;
  /** Receives the authoritative current-revision view after an edit or restore. */
  onSaved: (view: CurriculumView) => void;
  /** Reloads the authoritative revision so a stale edit can recover without overwriting. */
  onReload?: () => Promise<void>;
  className?: string;
}

/**
 * StudioRoadmapEditing — exposes the existing topic editor, revision history,
 * diff, and restore contracts to the Learning Studio surfaces.
 *
 * It deliberately reuses `TopicEditor` and `RevisionHistory`, so optimistic
 * concurrency (REVISION_CONFLICT), history-removal acknowledgement, and the
 * no-silent-overwrite behaviour stay identical to the roadmap workspace. It
 * never introduces new revision semantics and reports the freshly saved
 * current-revision projection back through `onSaved`.
 */
export function StudioRoadmapEditing({
  view,
  topicId,
  onSaved,
  onReload,
  className,
}: StudioRoadmapEditingProps) {
  const [dialog, setDialog] = useState<"edit" | "add" | "history" | null>(
    null,
  );
  const canWrite = view.canWrite !== false;
  if (!canWrite) return null;

  const close = () => setDialog(null);

  return (
    <>
      <DropdownMenu
        className={className}
        trigger={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Edit lesson or view revision history"
            data-testid="studio-roadmap-editing"
          >
            <MoreHorizontal />
          </Button>
        }
        items={[
          ...(topicId
            ? [
                {
                  label: "Edit lesson",
                  icon: <Pencil />,
                  onClick: () => setDialog("edit"),
                },
              ]
            : []),
          {
            label: "Add topic",
            icon: <Plus />,
            onClick: () => setDialog("add"),
          },
          {
            label: "Revision history",
            icon: <History />,
            onClick: () => setDialog("history"),
          },
        ]}
      />
      {dialog === "edit" && topicId && (
        <TopicEditor
          view={view}
          topicId={topicId}
          onClose={close}
          onSaved={onSaved}
          onReload={onReload}
        />
      )}
      {dialog === "add" && (
        <TopicEditor
          view={view}
          topicId={null}
          onClose={close}
          onSaved={onSaved}
          onReload={onReload}
        />
      )}
      {dialog === "history" && (
        <RevisionHistory
          view={view}
          onClose={close}
          onSaved={onSaved}
          onReload={onReload}
        />
      )}
    </>
  );
}
