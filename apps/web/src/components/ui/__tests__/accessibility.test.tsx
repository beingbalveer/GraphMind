import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { Plus, Trash2 } from "lucide-react";
import { expectNoA11yViolations } from "@/test/a11y";
import { Badge } from "../badge";
import { Button } from "../button";
import { IconButton } from "../icon-button";
import { Input } from "../input";
import { SegmentedTabs } from "../segmented-tabs";
import { Skeleton } from "../skeleton";
import { Surface } from "../surface";
import { Switch } from "../switch";
import { Textarea } from "../textarea";
import { ConfirmDialog } from "../confirm-dialog";
import { StudioCatalogView } from "@/components/studio/StudioCatalogView";
import { PublicLessonReader } from "@/components/studio/PublicLessonReader";
import { StudioGoalForm } from "@/components/studio/StudioGoalForm";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { FileLibraryView } from "@/components/library/FileLibraryView";
import * as workspaceApi from "@/lib/workspaceApi";
import type { PublicRoadmapSummary } from "@/lib/publicCatalogApi";
import type { PublicLessonDetail } from "@/lib/publicSnapshotApi";
import type { FileAttachment } from "@graphmind/shared";
import type { LLMConfig } from "@/hooks/useModelConfig";

/**
 * LSI-047 automated accessibility gate.
 *
 * Renders representative shared primitives and the named product surfaces and
 * asserts axe-core reports zero violations. The manual browser/keyboard/screen
 * reader/reduced-motion checklist that this cannot replace lives in
 * `docs/integration/evidence/LSI-047.md`.
 */

const CATALOG_ITEMS: PublicRoadmapSummary[] = [
  {
    id: "tmpl-python",
    slug: "python-backend",
    title: "Python Backend Engineering",
    summary: "Asynchronous FastAPI services.",
    category: "backend",
    level: "intermediate",
    estimatedWeeks: 4,
    hoursPerWeek: 6,
    topicCount: 12,
    snapshotVersion: "2026-10-15.1",
    tags: ["python", "fastapi"],
    updatedAt: "2026-10-15T10:00:00Z",
  },
  {
    id: "tmpl-drawing",
    slug: "beginner-drawing",
    title: "Beginner Drawing",
    summary: "Observation and contour line practice.",
    category: "design",
    level: "beginner",
    estimatedWeeks: 6,
    hoursPerWeek: 3,
    topicCount: 10,
    snapshotVersion: "2026-10-14.1",
    tags: [],
    updatedAt: "2026-10-14T10:00:00Z",
  },
];

const PUBLIC_LESSON: PublicLessonDetail = {
  templateId: "tmpl-python",
  snapshotVersion: "2026-10-15.1",
  topicId: "pub_topic_async",
  topicSlug: "async-basics",
  title: "Async basics",
  brief: "Cooperative scheduling.",
  objectives: ["Explain the event loop", "Use async/await"],
  contentMarkdown: "## Event loop\n\nA loop that schedules coroutines.",
  exercise: "Write a concurrent gather.",
  format: "practice",
  estimateMinutes: 30,
  sources: [
    {
      id: "pub_src_1",
      title: "FastAPI docs",
      url: "https://fastapi.tiangolo.com",
      locator: null,
      kind: "article",
    },
  ],
};

const LIBRARY_FILES: FileAttachment[] = [
  {
    id: "f-1",
    name: "architecture-diagram.png",
    sizeBytes: 204800,
    mimeType: "image/png",
    fileCategory: "image",
    url: "/files/arch.png",
    metadata: { status: "ready" },
  },
  {
    id: "f-2",
    name: "data-analysis.csv",
    sizeBytes: 10240,
    mimeType: "text/csv",
    fileCategory: "tabular",
    url: "/files/data.csv",
    metadata: { status: "processing", row_count: 50 },
  },
];

const LLM_CONFIG: LLMConfig = {
  provider: "gemini",
  model: "gemini-2.5-flash",
  temperature: 0.7,
  maxTokens: 4096,
  systemPrompt: "",
  geminiApiKey: "",
  openaiApiKey: "",
  anthropicApiKey: "",
  deepseekApiKey: "",
  ollamaBaseUrl: "http://localhost:11434",
};

function PrimitivesScene() {
  const [view, setView] = React.useState("list");
  const [enabled, setEnabled] = React.useState(true);
  return (
    <section aria-label="Primitives sample">
      <h2>Shared primitives</h2>
      <Surface radius="card" className="space-y-4 p-4">
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Delete</Button>
          <Button variant="link">Learn more</Button>
          <Button loading loadingLabel="Saving changes">
            Save
          </Button>
          <Button disabled>Disabled</Button>
          <IconButton label="Add item">
            <Plus />
          </IconButton>
          <IconButton label="Delete item" tooltip="Delete">
            <Trash2 />
          </IconButton>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="mono">v1</Badge>
        </div>

        <div className="space-y-1">
          <label htmlFor="a11y-title" className="text-sm text-foreground">
            Roadmap title
          </label>
          <Input id="a11y-title" defaultValue="Async APIs" />
        </div>
        <div className="space-y-1">
          <label htmlFor="a11y-email" className="text-sm text-foreground">
            Email
          </label>
          <Input
            id="a11y-email"
            invalid
            errorMessage="Enter a valid email address"
            defaultValue="nope"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="a11y-notes" className="text-sm text-foreground">
            Notes
          </label>
          <Textarea id="a11y-notes" defaultValue="A short note" />
        </div>

        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
          aria-label="Enable notifications"
        />
        <SegmentedTabs
          ariaLabel="View mode"
          value={view}
          onChange={setView}
          items={[
            { id: "list", label: "List" },
            { id: "canvas", label: "Canvas", badge: "3" },
          ]}
        />
        <Skeleton label="Loading lesson content" className="h-4 w-40" />
      </Surface>
    </section>
  );
}

describe("LSI-047 automated accessibility (axe-core)", () => {
  it("passes on the shared UI primitives", async () => {
    const { container } = render(<PrimitivesScene />);
    await expectNoA11yViolations(container);
  });

  it("passes on an open confirmation dialog (portalled)", async () => {
    render(
      <ConfirmDialog
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Delete file permanently?"
        description="This file and its extracted text will be removed. This cannot be undone."
        confirmText="Delete file"
      />,
    );
    await waitFor(() =>
      expect(document.body.textContent).toContain("Delete file permanently?"),
    );
    // The dialog is portalled to document.body, outside the render container.
    await expectNoA11yViolations(document.body);
  });

  it("passes on the public catalog (/learn)", async () => {
    const { container } = render(
      <StudioCatalogView
        items={CATALOG_ITEMS}
        total={CATALOG_ITEMS.length}
        page={1}
        pageCount={1}
        query=""
        category={null}
        level={null}
        categories={["backend", "design"]}
        onQueryChange={vi.fn()}
        onCategoryChange={vi.fn()}
        onLevelChange={vi.fn()}
        onPageChange={vi.fn()}
        onRetry={vi.fn()}
        onResetFilters={vi.fn()}
        onOpen={vi.fn()}
      />,
    );
    await expectNoA11yViolations(container);
  });

  it("passes on the public lesson reader (/learn/{slug}/lessons/{topic})", async () => {
    const { container } = render(
      <PublicLessonReader
        lesson={PUBLIC_LESSON}
        roadmapTitle="Python Backend"
        phaseTitle="Phase 1: Async"
        lessonIndex={0}
        totalLessons={3}
        prev={{ slug: "intro", title: "Intro" }}
        next={{ slug: "databases", title: "Async databases" }}
        onBack={vi.fn()}
        onOpenTopic={vi.fn()}
        onRequireSignIn={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    await expectNoA11yViolations(container);
  });

  it("passes on the generator goal form (studio)", async () => {
    const { container } = render(<StudioGoalForm onSubmit={vi.fn()} />);
    await expectNoA11yViolations(container);
  });

  it("passes on the settings surface", async () => {
    const { container } = render(
      <SettingsPage
        config={LLM_CONFIG}
        onSaveConfig={vi.fn()}
        onResetDefaults={vi.fn()}
        onNavigateBack={vi.fn()}
      />,
    );
    await expectNoA11yViolations(container);
  });

  it("passes on the files/library surface once loaded", async () => {
    vi.spyOn(workspaceApi, "fetchWorkspaceFiles").mockResolvedValue(LIBRARY_FILES);
    const { container } = render(<FileLibraryView workspaceId="ws-1" />);
    await waitFor(() =>
      expect(container.textContent).toContain("architecture-diagram.png"),
    );
    await expectNoA11yViolations(container);
  });
});
