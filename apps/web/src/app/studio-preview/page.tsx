"use client";

import React, { useState } from "react";
import {
  Clock,
  FileText,
  Sparkles,
} from "lucide-react";
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
import {
  StudioMyLearningView,
} from "@/components/studio/StudioMyLearningView";
import {
  StudioCourseOutline,
} from "@/components/studio/StudioCourseOutline";
import {
  StudioCourseListView,
} from "@/components/studio/StudioCourseListView";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WorkspaceItem } from "@/lib/workspaceApi";
import { CurriculumView } from "@/lib/roadmapTypes";

/**
 * Gated / Internal Studio Preview Route
 * Used to verify LearningStudioShell layout, rails, responsive drawers, and semantic tokens.
 */
export default function StudioPreviewPage() {
  const [activeNav, setActiveNav] = useState<StudioNavTab>("home");
  const [inCourse, setInCourse] = useState(true);
  const [isLeftRailOpen, setIsLeftRailOpen] = useState(true);
  const [isRightRailOpen, setIsRightRailOpen] = useState(true);
  const [isRightExpanded, setIsRightExpanded] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [activeTopicId, setActiveTopicId] = useState<string>("t2");
  const [activeTopic, setActiveTopic] = useState("FastAPI Asynchronous Architecture");
  const [showCourseListView, setShowCourseListView] = useState<boolean>(false);

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
    if (tab === "home" || tab === "learning") {
      setInCourse(false);
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
          onClose={() => setIsLeftRailOpen(false)}
          onNewChat={() => alert("New course conversation triggered")}
          outlineContent={
            <StudioCourseOutline
              view={sampleCurriculumView}
              activeTopicId={activeTopicId}
              onSelectTopic={(tId) => {
                const found = sampleCurriculumView.candidate.items.find((x) => x.id === tId);
                if (found) {
                  setActiveTopic(found.title);
                  setActiveTopicId(tId);
                  setShowCourseListView(false);
                }
              }}
            />
          }
          chatsContent={
            <div className="p-3 text-xs text-foreground-muted">
              Course conversations will appear here when connected to the backend.
            </div>
          }
        />
      }
      tutorRail={
        <StudioTutorRail
          topicTitle={activeTopic}
          isExpanded={isRightExpanded}
          onToggleExpand={() => setIsRightExpanded((v) => !v)}
          onClose={() => setIsRightRailOpen(false)}
          tutorContent={
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-surface-hover/60 rounded-xl border border-border-subtle">
                <div className="flex items-center gap-1.5 text-primary font-medium mb-1">
                  <Sparkles className="size-3.5" />
                  <span>AI Tutor Active</span>
                </div>
                <p className="text-foreground-muted leading-relaxed">
                  Ready to explain async request routing, event loops, or dependency injection in FastAPI.
                </p>
              </div>
            </div>
          }
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
      ) : showCourseListView ? (
        /* Full Course Outline List View */
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 pt-4 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCourseListView(false)}
            >
              Back to Lesson
            </Button>
          </div>
          <StudioCourseListView
            view={sampleCurriculumView}
            onSelectTopic={(tId) => {
              const found = sampleCurriculumView.candidate.items.find((x) => x.id === tId);
              if (found) {
                setActiveTopic(found.title);
                setActiveTopicId(tId);
                setShowCourseListView(false);
              }
            }}
          />
        </div>
      ) : (
        /* Main Course Stage */
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 max-w-4xl mx-auto w-full">
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline">Lesson 2 of 5</Badge>
                  <span className="text-xs text-foreground-muted flex items-center gap-1">
                    <Clock className="size-3" /> 40 minutes
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  {activeTopic}
                </h1>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCourseListView(true)}
                >
                  Roadmap Outline
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setInCourse((v) => !v)}
                >
                  {inCourse ? "Preview Catalog Mode" : "Preview Course Mode"}
                </Button>
              </div>
            </div>

            <div className="prose dark:prose-invert max-w-none text-sm text-foreground-muted space-y-4 leading-relaxed">
              <p>
                FastAPI is built on top of Starlette and Pydantic, designed from the ground up to take full advantage
                of modern Python asynchronous programming (PEP 492). By writing asynchronous path operation functions
                using <code className="bg-surface-hover px-1.5 py-0.5 rounded text-foreground">async def</code>, your application can handle I/O-bound tasks concurrently without blocking the main event loop.
              </p>

              <div className="p-4 rounded-xl border border-border bg-surface">
                <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <FileText className="size-4 text-primary" /> Key Learning Objectives
                </h4>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Understand the difference between async def and standard def in FastAPI endpoints</li>
                  <li>Leverage FastAPI Dependency Injection with async context managers</li>
                  <li>Integrate non-blocking SQLAlchemy 2.0 AsyncSessions without connection starvation</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </LearningStudioShell>
  );
}
