"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Download, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineFeedback } from "@/components/ui/feedback";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { buildWorkspaceUrl } from "@/lib/urls";
import {
  createRoadmapImports,
  listRoadmapImportFields,
  type RoadmapImportField,
} from "@/lib/roadmapImportApi";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Pick one or more curated roadmap.sh fields to import as ready-made,
 * self-paced roadmaps (no AI generation involved).
 */
export function RoadmapImportModal({ isOpen, onClose }: Props) {
  const router = useRouter();
  const [fields, setFields] = useState<RoadmapImportField[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const [createdWorkspaceId, setCreatedWorkspaceId] = useState<string | null>(null);
  const requestKey = useRef(0);

  const load = useCallback(async () => {
    if (!isOpen) return;
    const key = ++requestKey.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listRoadmapImportFields();
      if (key !== requestKey.current) return;
      setFields(list);
      setSelected(new Set(list.map((f) => f.slug)));
    } catch (failure) {
      if (key !== requestKey.current) return;
      setError(
        failure instanceof Error ? failure.message : "Could not load curated roadmaps.",
      );
    } finally {
      if (key === requestKey.current) setLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setOpened(false);
      void load();
    }
  }, [isOpen, load]);

  function toggle(slug: string) {
    setSelected((old) => {
      const next = new Set(old);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  async function importSelected() {
    const slugs = [...selected];
    if (!slugs.length) return;
    setImporting(true);
    setError(null);
    try {
      const response = await createRoadmapImports(slugs);
      await load();
      const first = response.results[0];
      if (first) {
        setOpened(true);
        setCreatedWorkspaceId(first.workspaceId);
      } else if (response.errors.length) {
        setError(response.errors[0].error || "Import failed for every selected field.");
      } else {
        setError("Nothing was imported.");
      }
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Could not import the selected roadmaps.",
      );
    } finally {
      setImporting(false);
    }
  }

  function openCreatedWorkspace() {
    onClose();
    if (createdWorkspaceId) router.push(buildWorkspaceUrl(createdWorkspaceId));
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      className="bg-background"
      ariaLabel="Import curated roadmaps"
    >
      <ModalHeader
        className="bg-background px-6 [&_h2]:text-xl"
        title="Browse curated roadmaps"
        description="Import complete, ready-made learning paths from roadmap.sh — no AI generation needed."
        icon={<BookOpen className="size-4" />}
        onClose={onClose}
      />
      <ModalBody className="space-y-5 p-6">
        {error && (
          <InlineFeedback tone="destructive">{error}</InlineFeedback>
        )}
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-10 text-sm text-foreground-muted">
            <Loader2 className="size-4 animate-spin" />
            Loading curated fields…
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {fields.map((field) => (
              <li key={field.slug} className="flex items-center gap-3 py-3">
                <Switch
                  checked={selected.has(field.slug)}
                  onCheckedChange={() => toggle(field.slug)}
                  id={`import-${field.slug}`}
                  aria-label={`Import ${field.title}`}
                />
                <label
                  htmlFor={`import-${field.slug}`}
                  className="min-w-0 flex-1 cursor-pointer"
                >
                  <span className="block truncate text-sm font-medium text-foreground">
                    {field.title}
                  </span>
                  <span className="block text-xs text-foreground-muted">
                    {field.topicCount} topics · self-paced
                  </span>
                </label>
                <a
                  href={field.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-foreground-muted transition-colors hover:text-foreground"
                  aria-label={`Open ${field.title} on roadmap.sh`}
                >
                  <ExternalLink className="size-4" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </ModalBody>
      <ModalFooter className="flex flex-wrap items-center justify-between gap-3 bg-background px-6">
        <p className="text-xs text-foreground-muted">
          {selected.size} of {fields.length} selected · imported as new workspaces
        </p>
        <div className="flex items-center gap-2">
          {opened && (
            <Button variant="outline" onClick={openCreatedWorkspace}>
              Go to my workspace
            </Button>
          )}
          <Button
            disabled={selected.size === 0 || importing}
            onClick={() => void importSelected()}
            loading={importing}
            loadingLabel="Importing…"
          >
            {importing ? null : <Download className="mr-2 size-4" />}
            Import {selected.size ? `${selected.size} ` : ""}roadmap{selected.size === 1 ? "" : "s"}
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}