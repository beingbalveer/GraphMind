"use client";
import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import type { CurriculumView } from "@/lib/roadmapTypes";
import { TopicEditor } from "./TopicEditor";
import { RevisionHistory } from "./RevisionHistory";
export function RoadmapActions({
  view,
  onSaved,
  onReload,
}: {
  view: CurriculumView;
  onSaved: (view: CurriculumView) => void;
  onReload?: () => Promise<void>;
}) {
  const [dialog, setDialog] = useState<"add" | "history" | null>(null);
  return (
    <>
      <DropdownMenu
        trigger={
          <Button variant="ghost" size="icon" aria-label="Roadmap actions">
            <MoreHorizontal />
          </Button>
        }
        items={[
          { label: "Add topic", onClick: () => setDialog("add") },
          { label: "Revision history", onClick: () => setDialog("history") },
        ]}
      />
      {dialog === "add" && (
        <TopicEditor
          view={view}
          topicId={null}
          onClose={() => setDialog(null)}
          onSaved={onSaved}
          onReload={onReload}
        />
      )}{" "}
      {dialog === "history" && (
        <RevisionHistory
          view={view}
          onClose={() => setDialog(null)}
          onSaved={onSaved}
          onReload={onReload}
        />
      )}
    </>
  );
}
