"use client";

import React, { useState, Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  LearningStudioShell,
} from "@/components/studio/LearningStudioShell";
import {
  StudioHeader,
  StudioNavTab,
} from "@/components/studio/StudioHeader";
import {
  StudioCourseRail,
} from "@/components/studio/StudioCourseRail";
import {
  StudioTutorRail,
} from "@/components/studio/StudioTutorRail";
import {
  StudioHomeView,
} from "@/components/studio/StudioHomeView";
import { StudioGoalForm } from "@/components/studio/StudioGoalForm";
import {
  StudioMyLearningView,
} from "@/components/studio/StudioMyLearningView";
import {
  StudioCourseOutline,
} from "@/components/studio/StudioCourseOutline";
import {
  StudioCourseListView,
} from "@/components/studio/StudioCourseListView";
import {
  StudioLessonReader,
} from "@/components/studio/StudioLessonReader";
import { StudioChatDirectory } from "@/components/studio/StudioChatDirectory";
import { Button } from "@/components/ui/button";
import { NewWorkspaceChatModal } from "@/components/chat/NewWorkspaceChatModal";
import { WorkspaceItem } from "@/lib/workspaceApi";
import { readRoadmap } from "@/lib/roadmapApi";
import { CurriculumView, TopicProgressData } from "@/lib/roadmapTypes";
import { buildChatUrl, parseBranchNavigation } from "@/lib/urls";

/**
 * Gated / Internal Studio Preview Route
 * Used to verify LearningStudioShell layout, rails, responsive drawers, and semantic tokens.
 */
export default function StudioPreviewPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-background" />}>
      <StudioPreviewContent />
    </Suspense>
  );
}

function StudioPreviewContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { branchId, nodeId } = parseBranchNavigation(searchParams);

  const [activeNav, setActiveNav] = useState<StudioNavTab>("home");
  const [inCourse, setInCourse] = useState(true);
  const [isLeftRailOpen, setIsLeftRailOpen] = useState(true);
  const [isRightRailOpen, setIsRightRailOpen] = useState(true);
  const [isRightExpanded, setIsRightExpanded] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [activeTopicId, setActiveTopicId] = useState<string>("t2");
  const [tutorQuote, setTutorQuote] = useState<string | null>(null);
  const [activeTopic, setActiveTopic] = useState("FastAPI Asynchronous Architecture");
  const [showCourseListView, setShowCourseListView] = useState<boolean>(false);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);

  const handleBranchChange = (leafId: string | null) => {
    if (leafId) {
      router.replace(`${pathname}?branch=${encodeURIComponent(leafId)}`, { scroll: false });
    } else {
      router.replace(pathname, { scroll: false });
    }
  };

  const sampleCurriculumView: CurriculumView = {
    roadmapId: "rm_python",
    workspaceId: "ws_python_demo",
    canWrite: true,
    canvasAnchorChatId: "anchor_1",
    revisionId: "rev_python_1",
    profile: {
      title: "Backend Engineering with Python",
      prompt: "Learn modern Python backend engineering",
      level: "intermediate",
      background: null,
      duration: { value: 4, unit: "weeks" },
      hoursPerWeek: "6",
      studyWeeks: 4,
      weeklyMinutes: 360,
      outcome: "Build production-ready asynchronous backends with FastAPI and PostgreSQL",
      assumptions: [
        "Master async/await syntax and event loop concurrency",
        "Deploy connection pooling with asyncpg and SQLAlchemy 2.0",
      ],
      knownSkills: ["Python Basics", "REST APIs"],
    },
    candidate: {
      title: "Backend Engineering with Python",
      outcome: "Build production-ready asynchronous backends with FastAPI and PostgreSQL",
      assumptions: [
        "Master async/await syntax and event loop concurrency",
        "Deploy connection pooling with asyncpg and SQLAlchemy 2.0",
      ],
      items: [
        {
          id: "p1",
          kind: "phase",
          title: "Phase 1: Async Fundamentals",
          brief: "Event loops, coroutines, and async syntax",
          objectives: [],
          exercise: null,
          format: null,
          order: 1,
          path: "core",
          estimateMinutes: 65,
          participation: "active",
        },
        {
          id: "t1",
          kind: "topic",
          title: "Python Async & Await Fundamentals",
          brief: "Understanding event loop cooperative scheduling and tasks",
          objectives: ["Explain non-blocking I/O execution"],
          exercise: "Write concurrent gather routines",
          format: "concepts",
          order: 1,
          path: "core",
          estimateMinutes: 25,
          participation: "active",
        },
        {
          id: "t2",
          kind: "topic",
          title: "FastAPI Asynchronous Architecture",
          brief: "Design asynchronous route operations with Starlette",
          objectives: ["Implement async dependency injection"],
          exercise: "Build non-blocking API handlers",
          format: "practice",
          order: 2,
          path: "core",
          estimateMinutes: 40,
          participation: "active",
          contentMarkdown: `# FastAPI Asynchronous Architecture

FastAPI is built on top of Starlette and Pydantic, designed from the ground up to take full advantage of modern Python asynchronous programming (PEP 492).

## Concurrency & Event Loop

By writing asynchronous path operation functions using \`async def\`, your application can handle I/O-bound tasks concurrently without blocking the main event loop.

\`\`\`python
from fastapi import FastAPI
import asyncio

app = FastAPI()

@app.get("/items")
async def read_items():
    await asyncio.sleep(0.05)  # Non-blocking simulation
    return [{"id": 1, "name": "Async Task"}]
\`\`\`

## Dependency Injection with Async Contexts

FastAPI dependency injection system natively supports async generator dependencies with cleanup:

\`\`\`python
async def get_db_session():
    async with async_session_factory() as session:
        yield session
\`\`\`

Always avoid invoking CPU-bound or blocking synchronous routines directly in \`async def\` endpoints without running them in an executor.`,
        },
        {
          id: "p2",
          kind: "phase",
          title: "Phase 2: Database & Schemas",
          brief: "Pydantic v2 validation and async database persistence",
          objectives: [],
          exercise: null,
          format: null,
          order: 2,
          path: "core",
          estimateMinutes: 135,
          participation: "active",
        },
        {
          id: "t3",
          kind: "topic",
          title: "Pydantic v2 Schema Modeling",
          brief: "High performance data validation with Rust core",
          objectives: ["Configure model validators and serializers"],
          exercise: "Validate complex API payloads",
          format: "concepts",
          order: 1,
          path: "core",
          estimateMinutes: 30,
          participation: "active",
        },
        {
          id: "t4",
          kind: "topic",
          title: "SQLAlchemy 2.0 Async Session Engine",
          brief: "Asyncpg database driver and session lifecycle",
          objectives: ["Manage sessions with async context managers"],
          exercise: "Execute queries with AsyncSession",
          format: "practice",
          order: 2,
          path: "core",
          estimateMinutes: 45,
          participation: "active",
        },
        {
          id: "t5",
          kind: "topic",
          title: "PostgreSQL pgvector Embedding Search",
          brief: "Vector similarity search for RAG and semantic retrieval",
          objectives: ["Perform cosine similarity queries"],
          exercise: "Store and search vector embeddings",
          format: "project",
          order: 3,
          path: "core",
          estimateMinutes: 60,
          participation: "active",
        },
      ],
      relations: [
        { sourceId: "p1", targetId: "t1", kind: "contains" },
        { sourceId: "p1", targetId: "t2", kind: "contains" },
        { sourceId: "p2", targetId: "t3", kind: "contains" },
        { sourceId: "p2", targetId: "t4", kind: "contains" },
        { sourceId: "p2", targetId: "t5", kind: "contains" },
      ],
      choices: [],
      sessions: [],
      resources: [],
    },
    sources: [
      {
        id: "s1",
        title: "FastAPI Official Documentation",
        url: "https://fastapi.tiangolo.com/async/",
        referenceId: null,
        locator: "https://fastapi.tiangolo.com/async/",
        verifiedAt: "2026-10-10T12:00:00Z",
        status: "inspected",
        access: "free",
        kind: "article",
        evidence: "FastAPI supports async def routes natively.",
        provenance: {},
      },
    ],
    progress: {
      t1: { topicId: "t1", status: "completed", completedAt: "2026-10-15T08:00:00Z" },
      t2: { topicId: "t2", status: "in_progress", completedAt: null },
      t3: { topicId: "t3", status: "not_started", completedAt: null },
      t4: { topicId: "t4", status: "not_started", completedAt: null },
      t5: { topicId: "t5", status: "not_started", completedAt: null },
    },
    validation: {
      valid: true,
      issues: [],
      coreMinutes: 200,
      capacityMinutes: 360,
    },
    origins: [],
  };

  const demoWorkspaces: WorkspaceItem[] = [
    {
      id: "ws_python_demo",
      name: "Backend Engineering with Python",
      description: "Deep dive into async FastAPI, modern Pydantic v2 schemas, and pgvector embeddings.",
      viewportX: 0,
      viewportY: 0,
      zoom: 1,
      nodeCount: 15,
      createdAt: "2026-10-10T10:00:00Z",
      updatedAt: "2026-10-15T09:00:00Z",
      curriculum: {
        roadmapId: "rm_python",
        revisionId: "rev_python",
        title: "Backend Engineering with Python",
        status: "active",
        totalTopics: 5,
        completedTopics: 1,
        progressPercent: 20.0,
        sourceSnapshotRef: "python-backend",
        originJobId: null,
        updatedAt: "2026-10-15T09:00:00Z",
      },
    },
    {
      id: "ws_drawing_demo",
      name: "Beginner Drawing Exercises",
      description: "Observation, contour lines, and structural forms for beginning artists.",
      viewportX: 0,
      viewportY: 0,
      zoom: 1,
      nodeCount: 8,
      createdAt: "2026-10-08T10:00:00Z",
      updatedAt: "2026-10-14T14:00:00Z",
      curriculum: {
        roadmapId: "rm_drawing",
        revisionId: "rev_drawing",
        title: "Beginner Drawing Exercises",
        status: "active",
        totalTopics: 10,
        completedTopics: 10,
        progressPercent: 100.0,
        sourceSnapshotRef: "beginner-drawing",
        originJobId: null,
        updatedAt: "2026-10-14T14:00:00Z",
      },
    },
  ];

  const handleNavigate = (tab: StudioNavTab) => {
    setActiveNav(tab);
    if (tab === "home" || tab === "learning" || tab === "create") {
      setInCourse(false);
    }
  };

  const [progressMap, setProgressMap] = useState<Record<string, TopicProgressData>>(
    sampleCurriculumView.progress
  );
  // Single source of truth for the projected current revision. Every surface
  // (Lesson, List, Canvas) renders from this one view, so a saved edit or a
  // restored revision updates them coherently.
  const [curriculumView, setCurriculumView] =
    useState<CurriculumView>(sampleCurriculumView);
  const viewWithProgress: CurriculumView = {
    ...curriculumView,
    progress: progressMap,
  };

  const applySavedView = (next: CurriculumView) => {
    setCurriculumView(next);
    setProgressMap(next.progress);
  };

  const reloadCurriculum = async () => {
    try {
      const latest = await readRoadmap(curriculumView.workspaceId);
      applySavedView(latest);
    } catch {
      /* A stale edit keeps its draft visible until the authoritative revision loads. */
    }
  };
  const allTopics = viewWithProgress.candidate.items.filter((x) => x.kind === "topic");
  const currentTopic = allTopics.find((x) => x.id === activeTopicId) || allTopics[0];
  const currentIndex = allTopics.findIndex((x) => x.id === currentTopic.id);
  const isCompleted = progressMap[currentTopic.id]?.status === "completed";

  const phaseRelation = viewWithProgress.candidate.relations.find(
    (r) => r.kind === "contains" && r.targetId === currentTopic.id
  );
  const phase = phaseRelation
    ? viewWithProgress.candidate.items.find((x) => x.id === phaseRelation.sourceId)
    : undefined;

  const toggleComplete = () => {
    setProgressMap((prev) => ({
      ...prev,
      [currentTopic.id]: {
        topicId: currentTopic.id,
        status: prev[currentTopic.id]?.status === "completed" ? "in_progress" : "completed",
        completedAt:
          prev[currentTopic.id]?.status === "completed" ? null : new Date().toISOString(),
      },
    }));
  };

  const goToPrevLesson = () => {
    if (currentIndex > 0) {
      const prev = allTopics[currentIndex - 1];
      setActiveTopic(prev.title);
      setActiveTopicId(prev.id);
    }
  };

  const goToNextLesson = () => {
    if (currentIndex < allTopics.length - 1) {
      const next = allTopics[currentIndex + 1];
      setActiveTopic(next.title);
      setActiveTopicId(next.id);
    } else {
      setShowCourseListView(true);
    }
  };

  const handleToggleDark = () => {
    setIsDark((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      return next;
    });
  };

  return (
    <>
    <LearningStudioShell
      header={
        <StudioHeader
          activeNav={activeNav}
          onNavigate={handleNavigate}
          courseTitle={inCourse ? "Backend Engineering with Python" : undefined}
          isLeftRailOpen={isLeftRailOpen}
          onToggleLeftRail={() => setIsLeftRailOpen((v) => !v)}
          isRightRailOpen={isRightRailOpen}
          onToggleRightRail={() => setIsRightRailOpen((v) => !v)}
          showRails={inCourse}
          rightRailTitle="Tutor Companion"
          isDark={isDark}
          onToggleDark={handleToggleDark}
        />
      }
      showRails={inCourse}
      isLeftRailOpen={isLeftRailOpen}
      onToggleLeftRail={() => setIsLeftRailOpen((v) => !v)}
      isRightRailOpen={isRightRailOpen}
      onToggleRightRail={() => setIsRightRailOpen((v) => !v)}
      isRightRailExpanded={isRightExpanded}
      courseRail={
        <StudioCourseRail
          courseTitle="Backend Engineering with Python"
          progressPercent={20}
          workspaceId={viewWithProgress.workspaceId}
          topicId={activeTopicId}
          topicTitle={activeTopic}
          onClose={() => setIsLeftRailOpen(false)}
          onNewChat={() => setIsNewChatModalOpen(true)}
          outlineContent={
            <StudioCourseOutline
              view={viewWithProgress}
              activeTopicId={activeTopicId}
              onSelectTopic={(tId) => {
                const found = viewWithProgress.candidate.items.find((x) => x.id === tId);
                if (found) {
                  setActiveTopic(found.title);
                  setActiveTopicId(tId);
                  setShowCourseListView(false);
                }
              }}
            />
          }
          chatsContent={
            <StudioChatDirectory
              workspaceId={viewWithProgress.workspaceId}
              excludeChatId={viewWithProgress.canvasAnchorChatId}
              onOpenChat={(chat) =>
                router.push(buildChatUrl(chat.workspaceId, chat.id), {
                  scroll: false,
                })
              }
              onReturnToLesson={(chat) => {
                const topicId = chat.topicAssociation?.topicId;
                const found = viewWithProgress.candidate.items.find(
                  (item) => item.id === topicId,
                );
                if (found) {
                  setActiveTopic(found.title);
                  setActiveTopicId(found.id);
                  setShowCourseListView(false);
                }
              }}
            />
          }
        />
      }
      tutorRail={
        <StudioTutorRail
          workspaceId={viewWithProgress.workspaceId}
          topicId={activeTopicId}
          topicTitle={activeTopic}
          quotedPassage={tutorQuote}
          initialBranchId={branchId}
          initialNodeId={nodeId}
          onBranchChange={handleBranchChange}
          onClearQuote={() => setTutorQuote(null)}
          isExpanded={isRightExpanded}
          onToggleExpand={() => setIsRightExpanded((v) => !v)}
          onClose={() => setIsRightRailOpen(false)}
          resourcesContent={
            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-lg border border-border-subtle bg-surface">
                <div className="font-medium text-foreground">FastAPI Official Documentation</div>
                <div className="text-2xs text-foreground-muted truncate">https://fastapi.tiangolo.com/async/</div>
              </div>
            </div>
          }
        />
      }
    >
      {/* Dynamic Center Stage: Home, My Learning, or Lesson Stage */}
      {!inCourse && activeNav === "home" ? (
        <div className="flex-1 overflow-y-auto">
          <StudioHomeView
            workspaces={demoWorkspaces}
            onResume={(_wsId) => setInCourse(true)}
            onBrowse={() => setActiveNav("browse")}
            onCreate={() => setActiveNav("create")}
            displayName="Learner"
          />
        </div>
      ) : !inCourse && activeNav === "learning" ? (
        <div className="flex-1 overflow-y-auto">
          <StudioMyLearningView
            workspaces={demoWorkspaces}
            onOpen={(_wsId) => setInCourse(true)}
            onBrowse={() => setActiveNav("browse")}
          />
        </div>
      ) : !inCourse && activeNav === "create" ? (
        <div className="flex-1 overflow-y-auto">
          {/* Preview stub: LSI-022 replaces this with the owned job-creation flow. */}
          <StudioGoalForm onSubmit={() => undefined} />
        </div>
      ) : showCourseListView ? (
        /* Full Course Outline List / Canvas View */
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          <div className="max-w-5xl w-full mx-auto px-6 pt-4 flex justify-end shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCourseListView(false)}
            >
              Back to Lesson
            </Button>
          </div>
          <StudioCourseListView
            view={viewWithProgress}
            onSelectTopic={(tId) => {
              const found = viewWithProgress.candidate.items.find((x) => x.id === tId);
              if (found) {
                setActiveTopic(found.title);
                setActiveTopicId(tId);
                setShowCourseListView(false);
              }
            }}
            onSaved={applySavedView}
            onReload={reloadCurriculum}
          />
        </div>
      ) : (
        /* Main Course Stage: Persistent Lesson Reader & Sources */
        <StudioLessonReader
          workspaceId={viewWithProgress.workspaceId}
          topic={currentTopic}
          view={viewWithProgress}
          phaseTitle={phase?.title}
          lessonIndex={currentIndex}
          totalLessons={allTopics.length}
          sources={viewWithProgress.sources}
          isCompleted={isCompleted}
          isFirst={currentIndex === 0}
          isLast={currentIndex === allTopics.length - 1}
          onBackToOutline={() => setShowCourseListView(true)}
          onPrevLesson={goToPrevLesson}
          onNextLesson={goToNextLesson}
          onToggleComplete={toggleComplete}
          onSaved={applySavedView}
          onReload={reloadCurriculum}
          onAskTutor={(quote) => {
            setTutorQuote(quote || null);
            setIsRightRailOpen(true);
          }}
        />
      )}
    </LearningStudioShell>
    <NewWorkspaceChatModal
      isOpen={isNewChatModalOpen}
      workspaceId={viewWithProgress.workspaceId}
      provider="gemini"
      model="gemini-2.5-flash"
      roadmapTopics={viewWithProgress.candidate.items.slice(0, 4).map((it) => ({
        id: it.id,
        title: it.title,
        brief: it.brief || it.title,
      }))}
      isWorkspaceCurrent={() => true}
      onClose={() => setIsNewChatModalOpen(false)}
      onCreated={(chat) => {
        setIsNewChatModalOpen(false);
        router.push(buildChatUrl(chat.workspaceId, chat.rootNodeId), { scroll: false });
      }}
    />
    </>
  );
}
